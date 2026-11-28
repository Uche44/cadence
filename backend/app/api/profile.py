"""Editing the intake after onboarding.

An edit re-resolves the rules immediately. If the resolved limits changed, every
plan still in play is marked stale in the same transaction — a plan that silently
outlives the rules it was built under is a safety problem, not a UX detail.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, sessionmaker

from app.api.onboarding import OnboardingOut, onboarding_state
from app.auth.dependencies import current_user, require_same_origin
from app.db import User
from app.deps import app_registry, app_session_factory
from app.onboarding.service import (
    IntakeError,
    canonicalize_conditions,
    canonicalize_equipment,
    canonicalize_interests,
    get_or_create_profile,
    mark_plans_stale,
    resolve_for_profile,
    rules_fingerprint,
)
from app.safety.registry import PackRegistry

router = APIRouter(
    prefix="/profile",
    tags=["profile"],
    dependencies=[Depends(require_same_origin)],
)


class ProfileUpdate(BaseModel):
    conditions: list[str] | None = None
    interests: list[str] | None = None
    equipment: list[str] | None = None
    wake_minute: int | None = Field(default=None, ge=0, le=1439)
    bed_minute: int | None = Field(default=None, ge=1, le=1439)
    doctor_clearance: bool | None = None

    @field_validator("interests")
    @classmethod
    def _interests_are_usable(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else canonicalize_interests(value)

    @field_validator("equipment")
    @classmethod
    def _equipment_is_known(cls, value: list[str] | None) -> list[str] | None:
        return None if value is None else canonicalize_equipment(value)


@router.put("", response_model=OnboardingOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
) -> OnboardingOut:
    session = factory()
    try:
        profile = get_or_create_profile(session, user)
        before = rules_fingerprint(resolve_for_profile(profile, registry))

        if payload.conditions is not None:
            try:
                profile.conditions = canonicalize_conditions(payload.conditions, registry)
            except IntakeError as error:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
                ) from error
        if payload.interests is not None:
            profile.interests = list(payload.interests)
        if payload.equipment is not None:
            profile.equipment = list(payload.equipment)
        if payload.wake_minute is not None:
            profile.wake_minute = payload.wake_minute
        if payload.bed_minute is not None:
            profile.bed_minute = payload.bed_minute
        if payload.doctor_clearance is not None:
            profile.doctor_clearance = payload.doctor_clearance

        if profile.bed_minute <= profile.wake_minute:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="bedtime must be after your wake-up time",
            )

        after = rules_fingerprint(resolve_for_profile(profile, registry))
        if after != before:
            mark_plans_stale(session, user.id, after)

        session.commit()
        return onboarding_state(session, user, registry)
    finally:
        session.close()
