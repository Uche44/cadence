"""The home summary.

Small on purpose: it proves the consent gate and surfaces the planning state
(including a doctor-clearance block) without pretending to generate a plan that
belongs to a later milestone.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.onboarding import PlanningOut, RulesOut, onboarding_state
from app.db import Checkin, Plan, User
from app.deps import app_registry, app_session_factory
from app.onboarding.dependencies import require_current_consent
from app.safety.registry import PackRegistry

router = APIRouter(prefix="/home", tags=["home"])


class HomeOut(BaseModel):
    display_name: str
    planning: PlanningOut
    rules: RulesOut
    stale_plans: int


@router.get("", response_model=HomeOut)
def read_home(
    user: User = Depends(require_current_consent),
    factory: sessionmaker[Session] = Depends(app_session_factory),
    registry: PackRegistry = Depends(app_registry),
) -> HomeOut:
    session = factory()
    try:
        state = onboarding_state(session, user, registry)
        stale = session.execute(
            select(func.count(Plan.id))
            .join(Checkin, Plan.checkin_id == Checkin.id)
            .where(Checkin.user_id == user.id, Plan.stale.is_(True))
        ).scalar_one()
        return HomeOut(
            display_name=user.display_name,
            planning=state.planning,
            rules=state.rules,
            stale_plans=int(stale),
        )
    finally:
        session.close()
