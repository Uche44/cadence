"""Morning check-in state and the day it describes.

The check-in is the only place the real day enters the system. Everything here
is about making that entry trustworthy: one record per local day, commitments
that cannot run backwards, symptoms kept as constraints, and a red flag that
stops the day before any planning can begin.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.checkin.catalog import MAX_COMMITMENTS, MAX_LABEL, MAX_SYMPTOM_LENGTH, MAX_SYMPTOMS
from app.db import Checkin, Commitment, Energy, Profile
from app.safety.models import EffectiveRules
from app.safety.validation import StopSignal, red_flag_stop
from app.scheduling.free_windows import Commitment as ScheduledCommitment
from app.scheduling.free_windows import TimeWindow, compute_free_windows
from app.timeutil import to_time


class CheckinError(ValueError):
    """A check-in the server cannot accept."""


@dataclass(frozen=True, slots=True)
class CommitmentInput:
    label: str
    start_minute: int
    end_minute: int
    id: str | None = None


@dataclass(frozen=True, slots=True)
class CheckinView:
    day: date
    exists: bool
    energy: Energy | None
    symptoms: list[str]
    notes: str | None
    commitments: list[Commitment]
    windows: list[TimeWindow]
    stop: StopSignal | None


def clean_text(value: str, limit: int) -> str:
    return " ".join(value.split())[:limit].strip()


def local_today(now: datetime, utc_offset_minutes: int) -> date:
    """The user's local date, given their offset east of UTC.

    Deriving this from the offset rather than from the server's date is what
    keeps a 00:30 check-in in UTC-3 on the previous day, where the user is.
    """
    moment = now if now.tzinfo is not None else now.replace(tzinfo=UTC)
    return (moment.astimezone(UTC) + timedelta(minutes=utc_offset_minutes)).date()


def canonicalize_symptoms(values: list[str]) -> list[str]:
    """Trim, dedupe, and bound the reported symptoms without reordering them."""
    ordered: list[str] = []
    seen: set[str] = set()

    for raw in values:
        text = clean_text(raw, MAX_SYMPTOM_LENGTH)
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(text)

    if len(ordered) > MAX_SYMPTOMS:
        raise CheckinError(f"Choose at most {MAX_SYMPTOMS} symptoms.")

    return ordered


def canonicalize_notes(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


def canonicalize_commitments(values: list[CommitmentInput]) -> list[CommitmentInput]:
    if len(values) > MAX_COMMITMENTS:
        raise CheckinError(f"Add at most {MAX_COMMITMENTS} commitments.")

    cleaned: list[CommitmentInput] = []
    for value in values:
        label = clean_text(value.label, MAX_LABEL)
        if not label:
            raise CheckinError("Every commitment needs a name.")
        if value.end_minute <= value.start_minute:
            raise CheckinError(f"{label!r} must end after it starts.")
        cleaned.append(
            CommitmentInput(
                id=value.id,
                label=label,
                start_minute=value.start_minute,
                end_minute=value.end_minute,
            )
        )
    return cleaned


def get_checkin(session: Session, user_id: str, day: date) -> Checkin | None:
    return session.execute(
        select(Checkin).where(Checkin.user_id == user_id, Checkin.local_date == day)
    ).scalar_one_or_none()


def windows_for(
    profile: Profile, commitments: list[Commitment] | list[CommitmentInput]
) -> list[TimeWindow]:
    """Free time inside the user's waking day, with overlaps merged."""
    scheduled = [
        ScheduledCommitment(
            start=to_time(commitment.start_minute),
            end=to_time(min(commitment.end_minute, 1439)),
            label=commitment.label,
        )
        for commitment in commitments
        if commitment.end_minute > commitment.start_minute
    ]
    return compute_free_windows(
        to_time(profile.wake_minute),
        to_time(profile.bed_minute),
        scheduled,
        min_window_minutes=5,
    )


def build_view(
    session: Session,
    user_id: str,
    day: date,
    profile: Profile,
    rules: EffectiveRules,
) -> CheckinView:
    checkin = get_checkin(session, user_id, day)
    if checkin is None:
        return CheckinView(
            day=day,
            exists=False,
            energy=None,
            symptoms=[],
            notes=None,
            commitments=[],
            windows=windows_for(profile, []),
            stop=None,
        )

    commitments = list(checkin.commitments)
    symptoms = list(checkin.symptoms)
    return CheckinView(
        day=day,
        exists=True,
        energy=checkin.energy,
        symptoms=symptoms,
        notes=checkin.notes,
        commitments=commitments,
        windows=windows_for(profile, commitments),
        stop=red_flag_stop(symptoms, rules),
    )


def upsert_checkin(
    session: Session,
    user_id: str,
    day: date,
    *,
    energy: Energy,
    symptoms: list[str],
    notes: str | None,
    commitments: list[CommitmentInput],
) -> Checkin:
    """Create or update the one check-in for ``day``.

    Re-checking in is an edit, never a second record: the unique constraint on
    (user_id, local_date) is the backstop, and this lookup is the normal path.
    """
    checkin = get_checkin(session, user_id, day)
    if checkin is None:
        checkin = Checkin(user_id=user_id, local_date=day, energy=energy)
        session.add(checkin)

    checkin.energy = energy
    checkin.symptoms = symptoms
    checkin.notes = notes
    _sync_commitments(checkin, commitments)
    session.flush()
    return checkin


def _sync_commitments(checkin: Checkin, values: list[CommitmentInput]) -> None:
    """Apply adds, edits, and deletes by id, preserving the submitted order."""
    existing = {commitment.id: commitment for commitment in checkin.commitments}
    ordered: list[Commitment] = []

    for value in values:
        current = existing.get(value.id) if value.id else None
        if current is None:
            current = Commitment(
                label=value.label,
                start_minute=value.start_minute,
                end_minute=value.end_minute,
            )
        else:
            current.label = value.label
            current.start_minute = value.start_minute
            current.end_minute = value.end_minute
        ordered.append(current)

    checkin.commitments = ordered
