"""Morning check-in endpoints.

One check-in per local day, updated in place on re-entry. The response always
carries the merged free windows and, when a red flag is reported, the stop
signal — so the client never has to wait for a plan to learn the day is over.
"""

from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session, sessionmaker

from app.api.onboarding import PlanningOut
from app.auth.dependencies import require_same_origin
from app.checkin.catalog import (
    MAX_COMMITMENTS,
    MAX_LABEL,
    MAX_NOTES,
    MAX_UTC_OFFSET,
    MIN_UTC_OFFSET,
    SYMPTOM_OPTIONS,
)
from app.checkin.service import (
    CheckinError,
    CommitmentInput,
    build_view,
    canonicalize_commitments,
    canonicalize_notes,
    canonicalize_symptoms,
    local_today,
    upsert_checkin,
    windows_for,
)
from app.db import Energy, User
from app.deps import app_now, app_registry, app_session_factory
from app.onboarding.dependencies import require_current_consent
from app.onboarding.service import snapshot
from app.safety.models import EffectiveRules
from app.safety.registry import PackRegistry
from app.safety.validation import StopSignal, find_red_flags, red_flag_stop
from app.timeutil import to_minutes

router = APIRouter(
    prefix="/checkin",
    tags=["checkin"],
    dependencies=[Depends(require_same_origin)],
)


# ------------------------------------------------------------------- requests


class CommitmentIn(BaseModel):
    id: str | None = None
    label: str = Field(min_length=1, max_length=MAX_LABEL)
    start_minute: int = Field(ge=0, le=1438)
    end_minute: int = Field(ge=1, le=1439)

    @field_validator("label")
    @classmethod
    def _label_is_usable(cls, value: str) -> str:
        cleaned = " ".join(value.split()).strip()
        if not cleaned:
            raise ValueError("Every commitment needs a name.")
        return cleaned

    @model_validator(mode="after")
    def _ends_after_it_starts(self) -> CommitmentIn:
        if self.end_minute <= self.start_minute:
            raise ValueError(f"{self.label!r} must end after it starts.")
        return self


class DraftPayload(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    commitments: list[CommitmentIn] = Field(default_factory=list, max_length=MAX_COMMITMENTS)

    @field_validator("symptoms")
    @classmethod
    def _symptoms_are_usable(cls, value: list[str]) -> list[str]:
        return canonicalize_symptoms(value)


class CheckinPayload(DraftPayload):
    energy: Energy
    notes: str | None = Field(default=None, max_length=MAX_NOTES)

    @field_validator("notes")
    @classmethod
    def _notes_are_usable(cls, value: str | None) -> str | None:
        return canonicalize_notes(value)


# ------------------------------------------------------------------ responses


class CommitmentOut(BaseModel):
    id: str
    label: str
    start_minute: int
    end_minute: int


class PreviewCommitmentOut(BaseModel):
    id: str | None
    label: str
    start_minute: int
    end_minute: int


class WindowOut(BaseModel):
    start_minute: int
    end_minute: int
    duration_minutes: int


class StopOut(BaseModel):
    matched: list[str]
    guidance: str


class SymptomOptionOut(BaseModel):
    key: str
    label: str
    description: str
    red_flag: bool


class CheckinOptionsOut(BaseModel):
    symptoms: list[SymptomOptionOut]


class CheckinOut(BaseModel):
    date: date
    exists: bool
    energy: Energy | None
    symptoms: list[str]
    notes: str | None
    commitments: list[CommitmentOut]
    windows: list[WindowOut]
    day_start_minute: int
    day_end_minute: int
    red_flag: StopOut | None
    red_flag_symptoms: list[str]
    options: CheckinOptionsOut
    planning: PlanningOut


class PreviewOut(BaseModel):
    commitments: list[PreviewCommitmentOut]
    windows: list[WindowOut]
    day_start_minute: int
    day_end_minute: int
    red_flag: StopOut | None
    red_flag_symptoms: list[str]


# ------------------------------------------------------------------- assembly


def _unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        key = value.casefold()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(value)
    return ordered


def _red_flag_symptoms(rules: EffectiveRules) -> list[str]:
    return _unique(list(rules.red_flags))


def _stop_out(stop: StopSignal | None) -> StopOut | None:
    if stop is None:
        return None
    return StopOut(matched=list(stop.matched), guidance=stop.guidance)


def _windows_out(windows) -> list[WindowOut]:
    return [
        WindowOut(
            start_minute=to_minutes(window.start),
            end_minute=to_minutes(window.end),
            duration_minutes=window.duration_minutes,
        )
        for window in windows
    ]


def _symptom_options(rules: EffectiveRules) -> CheckinOptionsOut:
    return CheckinOptionsOut(
        symptoms=[
            SymptomOptionOut(
                key=option.key,
                label=option.label,
                description=option.description,
                red_flag=bool(find_red_flags([option.label], rules)),
            )
            for option in SYMPTOM_OPTIONS
        ]
    )


def _read_state(
    session: Session,
    user: User,
    registry: PackRegistry,
    now: datetime,
    utc_offset_minutes: int,
) -> CheckinOut:
    found = snapshot(session, user, registry)
    day = local_today(now, utc_offset_minutes)
    view = build_view(session, user.id, day, found.profile, found.rules)

    return CheckinOut(
        date=view.day,
        exists=view.exists,
        energy=view.energy,
        symptoms=view.symptoms,
        notes=view.notes,
        commitments=[
            CommitmentOut(
                id=commitment.id,
                label=commitment.label,
                start_minute=commitment.start_minute,
                end_minute=commitment.end_minute,
            )
            for commitment in view.commitments
        ],
        windows=_windows_out(view.windows),
        day_start_minute=found.profile.wake_minute,
        day_end_minute=found.profile.bed_minute,
        red_flag=_stop_out(view.stop),
        red_flag_symptoms=_red_flag_symptoms(found.rules),
        options=_symptom_options(found.rules),
        planning=PlanningOut(
            ready=found.readiness.ready,
            blocked_reason=found.readiness.blocked_reason,
            message=found.readiness.message,
        ),
    )


def _inputs(values: list[CommitmentIn]) -> list[CommitmentInput]:
    try:
        return canonicalize_commitments(
            [
                CommitmentInput(
                    id=value.id,
                    label=value.label,
                    start_minute=value.start_minute,
                    end_minute=value.end_minute,
                )
                for value in values
            ]
        )
    except CheckinError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
        ) from error


# --------------------------------------------------------------------- routes


@router.get("", response_model=CheckinOut)
def read_checkin(
    utc_offset_minutes: int = Query(0, ge=MIN_UTC_OFFSET, le=MAX_UTC_OFFSET),
    user: User = Depends(require_current_consent),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
    now: datetime = Depends(app_now),
) -> CheckinOut:
    session = factory()
    try:
        return _read_state(session, user, registry, now, utc_offset_minutes)
    finally:
        session.close()


@router.post("/preview", response_model=PreviewOut)
def preview_checkin(
    payload: DraftPayload,
    user: User = Depends(require_current_consent),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
) -> PreviewOut:
    session = factory()
    try:
        found = snapshot(session, user, registry)
        commitments = _inputs(payload.commitments)
        return PreviewOut(
            commitments=[
                PreviewCommitmentOut(
                    id=value.id,
                    label=value.label,
                    start_minute=value.start_minute,
                    end_minute=value.end_minute,
                )
                for value in commitments
            ],
            windows=_windows_out(windows_for(found.profile, commitments)),
            day_start_minute=found.profile.wake_minute,
            day_end_minute=found.profile.bed_minute,
            red_flag=_stop_out(red_flag_stop(payload.symptoms, found.rules)),
            red_flag_symptoms=_red_flag_symptoms(found.rules),
        )
    finally:
        session.close()


@router.put("", response_model=CheckinOut)
def save_checkin(
    payload: CheckinPayload,
    utc_offset_minutes: int = Query(0, ge=MIN_UTC_OFFSET, le=MAX_UTC_OFFSET),
    user: User = Depends(require_current_consent),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
    now: datetime = Depends(app_now),
) -> CheckinOut:
    session = factory()
    try:
        day = local_today(now, utc_offset_minutes)
        upsert_checkin(
            session,
            user.id,
            day,
            energy=payload.energy,
            symptoms=list(payload.symptoms),
            notes=payload.notes,
            commitments=_inputs(payload.commitments),
        )
        session.commit()
        return _read_state(session, user, registry, now, utc_offset_minutes)
    finally:
        session.close()
