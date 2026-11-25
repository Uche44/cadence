"""Request-level auth dependencies."""

from __future__ import annotations

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, sessionmaker

from app.auth.sessions import SESSION_COOKIE, resolve_session
from app.db import User
from app.deps import app_session_factory

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def current_user(
    request: Request,
    factory: sessionmaker[Session] = Depends(app_session_factory),
) -> User:
    """Resolve the signed-in user, or refuse with a JSON 401.

    Deliberately a JSON 401 rather than a redirect: the API must never answer an
    anonymous request with an HTML login page, because a client cannot tell that
    apart from success.
    """
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sign in to continue.",
        )

    session = factory()
    try:
        user = resolve_session(session, token)
        session.commit()
    finally:
        session.close()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has ended. Sign in again.",
        )

    return user


def require_same_origin(request: Request) -> None:
    """Refuse state-changing requests that a browser sent from another site.

    Browsers always send ``Origin`` on cross-site POSTs, so comparing it is a
    cheap CSRF guard for cookie-authenticated endpoints. Requests without the
    header (curl, the test client) are allowed, because they carry no ambient
    cookie a third party could borrow.
    """
    if request.method in SAFE_METHODS:
        return

    origin = request.headers.get("origin")
    if origin is None:
        return

    expected = f"{request.url.scheme}://{request.headers.get('host', '')}"
    if origin.rstrip("/") != expected.rstrip("/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cross-site requests are refused.",
        )
