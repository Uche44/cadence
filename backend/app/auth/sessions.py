"""Sessions and cookies.

A session is a random token the browser holds and the database remembers only as
a SHA-256 hash. That way a leaked database dump cannot be replayed as a login,
and a leaked cookie is the only thing that can be.

Expiry is absolute rather than sliding: a session ends when it ends, which makes
"replaying an old cookie" a testable statement instead of a moving target.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta

from fastapi import Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth.passwords import hash_password, verify_password
from app.config import Settings
from app.db import AuthSession, User, utcnow

SESSION_COOKIE = "cadence_session"
SESSION_TTL_HOURS = 168  # seven days


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@dataclass(frozen=True, slots=True)
class IssuedSession:
    token: str
    expires_at: datetime


def start_session(session: Session, user: User, settings: Settings) -> IssuedSession:
    """Create a session row and return the raw token exactly once."""
    token = new_token()
    issued_at = utcnow()
    expires_at = issued_at + timedelta(
        hours=getattr(settings, "session_ttl_hours", SESSION_TTL_HOURS)
    )

    session.add(
        AuthSession(
            user_id=user.id,
            token_hash=hash_token(token),
            created_at=issued_at,
            expires_at=expires_at,
        )
    )
    session.flush()

    return IssuedSession(token=token, expires_at=expires_at)


def revoke_session(session: Session, token: str) -> None:
    session.execute(delete(AuthSession).where(AuthSession.token_hash == hash_token(token)))


def resolve_session(session: Session, token: str) -> User | None:
    """The user behind a token, or None if it is unknown, revoked, or expired."""
    stored = session.execute(
        select(AuthSession).where(AuthSession.token_hash == hash_token(token))
    ).scalar_one_or_none()

    if stored is None:
        return None

    if stored.expires_at <= utcnow():
        session.delete(stored)
        return None

    return session.get(User, stored.user_id)


def check_credentials(session: Session, email: str, password: str) -> User | None:
    """Return the user for correct credentials, otherwise None.

    When the email is unknown the comparison still runs against a dummy hash, so
    the response time does not reveal whether the account exists.
    """
    from app.auth.passwords import DUMMY_HASH

    user = session.execute(select(User).where(User.email == email)).scalar_one_or_none()
    stored_hash = user.password_hash if user is not None else DUMMY_HASH
    matches = verify_password(password, stored_hash)

    if user is None or not matches:
        return None
    return user


def create_user(session: Session, email: str, password: str, display_name: str) -> User:
    user = User(
        email=email.strip().lower(),
        password_hash=hash_password(password),
        display_name=display_name.strip(),
    )
    session.add(user)
    session.flush()
    return user


def set_session_cookie(response: Response, issued: IssuedSession, settings: Settings) -> None:
    max_age = max(1, int((issued.expires_at - utcnow()).total_seconds()))
    response.set_cookie(
        key=SESSION_COOKIE,
        value=issued.token,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.is_production,
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE, path="/", httponly=True, samesite="lax")
