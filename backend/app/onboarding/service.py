"""Onboarding state and the rules it resolves into.

The screens are thin: they collect answers, and this module decides what those
answers mean. Keeping the decisions here means the API, the tests, and any
future client all see the same resolved caps and the same gate.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.db import Checkin, Consent, Plan, PlanStatus, Profile, User
from app.onboarding.catalog import (
    CONSENT_VERSION,
    EQUIPMENT_KEYS,
    EXERCISES,
    MAX_CONDITIONS,
    MAX_INTERESTS,
    MIN_INTERESTS,
    NONE_ALIASES,
    ExerciseOption,
)
from app.safety.models import EffectiveRules
from app.safety.registry import PackRegistry
from app.safety.resolution import resolve_rules


class IntakeError(ValueError):
    """An answer the intake cannot accept."""


@dataclass(frozen=True, slots=True)
class Readiness:
    """Whether a plan may be generated, and why not when it may not."""

    ready: bool
    blocked_reason: str | None
    message: str | None


@dataclass(frozen=True, slots=True)
class Snapshot:
    """Everything the client needs to draw onboarding and the gate."""

    profile: Profile
    rules: EffectiveRules
    fingerprint: str
    consent: Consent | None
    readiness: Readiness
    eligible_exercises: tuple[ExerciseOption, ...]


def clean_text(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit].strip()


def canonicalize_conditions(values: list[str], registry: PackRegistry) -> list[str]:
    """Tidy declared conditions, fold aliases onto pack labels, and drop "none"."""
    ordered: list[str] = []
    seen: set[str] = set()

    for raw in values:
        text = clean_text(raw, 120)
        if not text or text.casefold() in NONE_ALIASES:
            continue

        pack = registry.find(text)
        canonical = pack.label if pack is not None else text
        key = canonical.casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(canonical)

    if len(ordered) > MAX_CONDITIONS:
        raise IntakeError(f"Choose at most {MAX_CONDITIONS} conditions.")

    return ordered


def canonicalize_interests(values: list[str]) -> list[str]:
    """Deduplicate while keeping the order the user chose."""
    ordered: list[str] = []
    seen: set[str] = set()

    for raw in values:
        text = clean_text(raw, 80)
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(text)

    if len(ordered) < MIN_INTERESTS:
        raise IntakeError(f"Choose at least {MIN_INTERESTS} things you enjoy.")
    if len(ordered) > MAX_INTERESTS:
        raise IntakeError(f"Choose at most {MAX_INTERESTS} things you enjoy.")

    return ordered


def canonicalize_equipment(values: list[str]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()

    for raw in values:
        key = clean_text(raw, 60).casefold()
        if not key:
            continue
        if key not in EQUIPMENT_KEYS:
            raise IntakeError(f"Unknown equipment: {raw!r}.")
        if key in seen:
            continue
        seen.add(key)
        ordered.append(key)

    return ordered


def get_or_create_profile(session: Session, user: User) -> Profile:
    profile = session.execute(
        select(Profile).where(Profile.user_id == user.id)
    ).scalar_one_or_none()
    if profile is None:
        profile = Profile(user_id=user.id)
        session.add(profile)
        session.flush()
    return profile


def current_consent(session: Session, user_id: str) -> Consent | None:
    return session.execute(
        select(Consent).where(
            Consent.user_id == user_id,
            Consent.version == CONSENT_VERSION,
        )
    ).scalar_one_or_none()


def has_current_consent(session: Session, user_id: str) -> bool:
    return current_consent(session, user_id) is not None


def resolve_for_profile(profile: Profile, registry: PackRegistry) -> EffectiveRules:
    return resolve_rules(profile.conditions, registry=registry)


def rules_fingerprint(rules: EffectiveRules) -> str:
    """A stable hash of every field that can change what a plan may contain."""
    payload: dict[str, Any] = {
        "pack_ids": list(rules.pack_ids),
        "max_intensity": rules.max_intensity.value,
        "max_block_minutes": rules.max_block_minutes,
        "min_block_minutes": rules.min_block_minutes,
        "max_daily_minutes": rules.max_daily_minutes,
        "blocked_tags": sorted(rules.blocked_tags),
        "red_flags": list(rules.red_flags),
        "requires_doctor_clearance": rules.requires_doctor_clearance,
        "is_conservative": rules.is_conservative,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def eligible_exercises(equipment: list[str], rules: EffectiveRules) -> tuple[ExerciseOption, ...]:
    """Movements the user's kit and safety rules both allow.

    An empty equipment list is honest: it means no kit was selected, so
    bodyweight/floor work is not offered. Selecting "None / Bodyweight only" is
    what makes bed and floor movements available.
    """
    available = set(equipment)
    return tuple(
        exercise
        for exercise in EXERCISES
        if exercise.requires <= available and not (exercise.tags & rules.blocked_tags)
    )


def planning_readiness(
    profile: Profile, consent: Consent | None, rules: EffectiveRules
) -> Readiness:
    """The gate in front of plan generation.

    Deliberately a state, not an exception: a user whose doctor has not cleared
    them should see an explanation, not an error and not a silent baseline plan.
    """
    if profile.onboarding_step < 4 or consent is None:
        return Readiness(
            ready=False,
            blocked_reason="onboarding",
            message="Finish the four setup steps before we build a plan.",
        )

    if rules.requires_doctor_clearance and not profile.doctor_clearance:
        return Readiness(
            ready=False,
            blocked_reason="doctor_clearance",
            message=(
                "Your doctor has not cleared you for light exercise yet. This is not "
                "an error — it is a safety step. Once you have that clearance, update "
                "your health answers and we will build a gentle plan."
            ),
        )

    return Readiness(ready=True, blocked_reason=None, message=None)


def snapshot(session: Session, user: User, registry: PackRegistry) -> Snapshot:
    profile = get_or_create_profile(session, user)
    rules = resolve_for_profile(profile, registry)
    consent = current_consent(session, user.id)
    return Snapshot(
        profile=profile,
        rules=rules,
        fingerprint=rules_fingerprint(rules),
        consent=consent,
        readiness=planning_readiness(profile, consent, rules),
        eligible_exercises=eligible_exercises(profile.equipment, rules),
    )


def mark_plans_stale(session: Session, user_id: str, fingerprint: str) -> int:
    """Flag plans built under a different rule set.

    A plan that looks correct while the limits under it have changed is worse
    than no plan, so the flag is explicit and the caller can tell the user.
    """
    plan_ids = (
        select(Plan.id)
        .join(Checkin, Plan.checkin_id == Checkin.id)
        .where(
            Checkin.user_id == user_id,
            Plan.status != PlanStatus.COMPLETED,
            or_(Plan.rules_fingerprint.is_(None), Plan.rules_fingerprint != fingerprint),
        )
    )
    result = session.execute(update(Plan).where(Plan.id.in_(plan_ids)).values(stale=True))
    return int(result.rowcount or 0)
