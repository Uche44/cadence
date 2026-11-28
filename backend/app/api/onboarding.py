"""Onboarding endpoints.

Four steps, in order, each persisted before the next is reachable. The response
always carries the resolved rules and the planning gate, so the UI can show the
user the caps that actually apply and never has to guess why a plan is blocked.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session, sessionmaker

from app.auth.dependencies import current_user, require_same_origin
from app.db import Consent, User
from app.deps import app_registry, app_session_factory
from app.onboarding.catalog import CONSENT_VERSION, options_payload
from app.onboarding.service import (
    IntakeError,
    Snapshot,
    canonicalize_conditions,
    canonicalize_equipment,
    canonicalize_interests,
    current_consent,
    get_or_create_profile,
    snapshot,
)
from app.safety.registry import PackRegistry

router = APIRouter(
    prefix="/onboarding",
    tags=["onboarding"],
    dependencies=[Depends(require_same_origin)],
)

TOTAL_STEPS = 4


# ------------------------------------------------------------------- requests


class HealthStep(BaseModel):
    conditions: list[str] = Field(default_factory=list)
    doctor_clearance: bool = False


class InterestsStep(BaseModel):
    interests: list[str] = Field(default_factory=list)

    @field_validator("interests")
    @classmethod
    def _interests_are_usable(cls, value: list[str]) -> list[str]:
        return canonicalize_interests(value)


class RoutineStep(BaseModel):
    wake_minute: int = Field(ge=0, le=1439)
    bed_minute: int = Field(ge=1, le=1439)
    equipment: list[str] = Field(default_factory=list)

    @field_validator("equipment")
    @classmethod
    def _equipment_is_known(cls, value: list[str]) -> list[str]:
        return canonicalize_equipment(value)

    @model_validator(mode="after")
    def _bed_follows_wake(self) -> RoutineStep:
        if self.bed_minute <= self.wake_minute:
            raise ValueError("bedtime must be after your wake-up time")
        return self


class ConsentRequest(BaseModel):
    accepted: bool = False


# ------------------------------------------------------------------ responses


class OptionOut(BaseModel):
    key: str
    label: str
    description: str
    emoji: str = ""
    icon: str = ""


class OptionsOut(BaseModel):
    conditions: list[OptionOut]
    interests: list[OptionOut]
    equipment: list[OptionOut]


class ProfileOut(BaseModel):
    conditions: list[str]
    interests: list[str]
    equipment: list[str]
    wake_minute: int
    bed_minute: int
    doctor_clearance: bool


class RulesOut(BaseModel):
    pack_ids: list[str]
    max_intensity: str
    max_block_minutes: int
    min_block_minutes: int
    max_daily_minutes: int
    blocked_tags: list[str]
    red_flags: list[str]
    sources: list[str]
    guidance: list[str]
    requires_doctor_clearance: bool
    is_conservative: bool
    notices: list[str]
    fingerprint: str


class ExerciseOut(BaseModel):
    id: str
    label: str
    tags: list[str]
    requires: list[str]
    floor_based: bool


class ConsentOut(BaseModel):
    version: str
    accepted: bool
    accepted_at: datetime | None


class PlanningOut(BaseModel):
    ready: bool
    blocked_reason: str | None
    message: str | None


class OnboardingOut(BaseModel):
    completed_step: int
    resume_step: int
    completed: bool
    profile: ProfileOut
    rules: RulesOut
    eligible_exercises: list[ExerciseOut]
    consent: ConsentOut
    planning: PlanningOut
    options: OptionsOut


# ------------------------------------------------------------------- assembly


def onboarding_state(session: Session, user: User, registry: PackRegistry) -> OnboardingOut:
    found: Snapshot = snapshot(session, user, registry)
    profile = found.profile
    completed = profile.onboarding_step >= TOTAL_STEPS and found.consent is not None
    resume_step = TOTAL_STEPS if completed else min(profile.onboarding_step + 1, TOTAL_STEPS)

    return OnboardingOut(
        completed_step=profile.onboarding_step,
        resume_step=resume_step,
        completed=completed,
        profile=ProfileOut(
            conditions=list(profile.conditions),
            interests=list(profile.interests),
            equipment=list(profile.equipment),
            wake_minute=profile.wake_minute,
            bed_minute=profile.bed_minute,
            doctor_clearance=profile.doctor_clearance,
        ),
        rules=RulesOut(
            pack_ids=list(found.rules.pack_ids),
            max_intensity=found.rules.max_intensity.value,
            max_block_minutes=found.rules.max_block_minutes,
            min_block_minutes=found.rules.min_block_minutes,
            max_daily_minutes=found.rules.max_daily_minutes,
            blocked_tags=sorted(found.rules.blocked_tags),
            red_flags=list(found.rules.red_flags),
            sources=list(found.rules.sources),
            guidance=list(found.rules.guidance),
            requires_doctor_clearance=found.rules.requires_doctor_clearance,
            is_conservative=found.rules.is_conservative,
            notices=list(found.rules.notices),
            fingerprint=found.fingerprint,
        ),
        eligible_exercises=[
            ExerciseOut(
                id=exercise.id,
                label=exercise.label,
                tags=sorted(exercise.tags),
                requires=sorted(exercise.requires),
                floor_based=exercise.floor_based,
            )
            for exercise in found.eligible_exercises
        ],
        consent=ConsentOut(
            version=CONSENT_VERSION,
            accepted=found.consent is not None,
            accepted_at=found.consent.accepted_at if found.consent is not None else None,
        ),
        planning=PlanningOut(
            ready=found.readiness.ready,
            blocked_reason=found.readiness.blocked_reason,
            message=found.readiness.message,
        ),
        options=OptionsOut(**options_payload()),
    )


def _out_of_order(profile_step: int) -> JSONResponse:
    resume = min(profile_step + 1, TOTAL_STEPS)
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={
            "detail": f"Complete step {resume} first.",
            "resume_step": resume,
            "completed_step": profile_step,
        },
    )


def _finish(session: Session, user: User, registry: PackRegistry) -> OnboardingOut:
    session.commit()
    return onboarding_state(session, user, registry)


# --------------------------------------------------------------------- routes


@router.get("", response_model=OnboardingOut)
def read_onboarding(
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
) -> OnboardingOut:
    session = factory()
    try:
        get_or_create_profile(session, user)
        return _finish(session, user, registry)
    finally:
        session.close()


@router.put("/steps/1", response_model=OnboardingOut)
def save_health(
    payload: HealthStep,
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
):
    session = factory()
    try:
        profile = get_or_create_profile(session, user)

        try:
            profile.conditions = canonicalize_conditions(payload.conditions, registry)
        except IntakeError as error:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(error)
            ) from error
        profile.doctor_clearance = payload.doctor_clearance
        profile.onboarding_step = max(profile.onboarding_step, 1)
        return _finish(session, user, registry)
    finally:
        session.close()


@router.put("/steps/2", response_model=OnboardingOut)
def save_interests(
    payload: InterestsStep,
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
):
    session = factory()
    try:
        profile = get_or_create_profile(session, user)
        if profile.onboarding_step < 1:
            return _out_of_order(profile.onboarding_step)

        profile.interests = list(payload.interests)
        profile.onboarding_step = max(profile.onboarding_step, 2)
        return _finish(session, user, registry)
    finally:
        session.close()


@router.put("/steps/3", response_model=OnboardingOut)
def save_routine(
    payload: RoutineStep,
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
):
    session = factory()
    try:
        profile = get_or_create_profile(session, user)
        if profile.onboarding_step < 2:
            return _out_of_order(profile.onboarding_step)

        profile.wake_minute = payload.wake_minute
        profile.bed_minute = payload.bed_minute
        profile.equipment = list(payload.equipment)
        profile.onboarding_step = max(profile.onboarding_step, 3)
        return _finish(session, user, registry)
    finally:
        session.close()


@router.post("/consent", response_model=OnboardingOut)
def accept_consent(
    payload: ConsentRequest,
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
):
    session = factory()
    try:
        profile = get_or_create_profile(session, user)
        if profile.onboarding_step < 3:
            return _out_of_order(profile.onboarding_step)

        if not payload.accepted:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="You must accept the safety notice to continue.",
            )

        if current_consent(session, user.id) is None:
            session.add(Consent(user_id=user.id, version=CONSENT_VERSION))
            session.flush()

        profile.onboarding_step = TOTAL_STEPS
        return _finish(session, user, registry)
    finally:
        session.close()
