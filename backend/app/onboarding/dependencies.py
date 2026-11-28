"""Dependencies that gate the app behind the current safety agreement."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session, sessionmaker

from app.auth.dependencies import current_user
from app.db import User
from app.deps import app_session_factory
from app.onboarding.service import has_current_consent


def require_current_consent(
    user: User = Depends(current_user),
    factory: sessionmaker[Session] = Depends(app_session_factory),
) -> User:
    """Refuse the app until the user has accepted the current notice version.

    This is an authorisation gate, so a 403 is the honest answer here. The
    doctor-clearance gate is different: it is a product state, and it is
    returned with a 200 and an explanation.
    """
    session = factory()
    try:
        if not has_current_consent(session, user.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accept the current safety notice to continue.",
            )
    finally:
        session.close()

    return user
