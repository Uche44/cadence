"""Account endpoints.

The rules these routes follow:

* A password never appears in a response, an error message, or a log line.
* "Wrong password" and "no such account" are the same answer, in the same shape.
* Signing out ends the session on the server, not just in the browser.
"""

from __future__ import annotations

import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.auth.dependencies import current_user, require_same_origin
from app.auth.passwords import MAXIMUM_PASSWORD_LENGTH, MINIMUM_PASSWORD_LENGTH
from app.auth.sessions import (
    SESSION_COOKIE,
    check_credentials,
    clear_session_cookie,
    create_user,
    revoke_session,
    set_session_cookie,
    start_session,
)
from app.config import Settings
from app.db import User
from app.deps import app_session_factory, app_settings

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    dependencies=[Depends(require_same_origin)],
)

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_REDIRECT = "/today"
INVALID_CREDENTIALS = "That email and password do not match an account."
DUPLICATE_EMAIL = "An account with that email already exists."


class SignupRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: str = Field(max_length=320)
    password: str = Field(min_length=MINIMUM_PASSWORD_LENGTH, max_length=MAXIMUM_PASSWORD_LENGTH)
    next: str | None = None

    @field_validator("display_name")
    @classmethod
    def _name_must_have_content(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("please enter your name")
        return cleaned

    @field_validator("email")
    @classmethod
    def _email_must_look_real(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_PATTERN.match(cleaned):
            raise ValueError("please enter a valid email address")
        return cleaned


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=MAXIMUM_PASSWORD_LENGTH)
    next: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    display_name: str


class AuthResponse(BaseModel):
    user: UserOut
    redirect_to: str


def safe_redirect(target: str | None) -> str:
    """Only ever redirect within this site.

    A "return to" parameter is an open-redirect waiting to happen: an attacker
    sends a link that signs you in and then drops you on their page.
    """
    if not target:
        return DEFAULT_REDIRECT
    if not target.startswith("/") or target.startswith("//"):
        return DEFAULT_REDIRECT
    if "\\" in target or "://" in target:
        return DEFAULT_REDIRECT
    return target


@router.post("/signup", status_code=status.HTTP_201_CREATED, response_model=AuthResponse)
def signup(
    payload: SignupRequest,
    response: Response,
    factory: sessionmaker[Session] = Depends(app_session_factory),
    settings: Settings = Depends(app_settings),
) -> AuthResponse:
    session = factory()
    try:
        existing = session.execute(
            select(User).where(User.email == payload.email)
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE_EMAIL)

        user = create_user(session, payload.email, payload.password, payload.display_name)
        issued = start_session(session, user, settings)
        session.commit()
    except IntegrityError:
        # Two sign-ups raced for the same email; the database decided it.
        session.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=DUPLICATE_EMAIL) from None
    finally:
        session.close()

    set_session_cookie(response, issued, settings)
    return AuthResponse(
        user=UserOut.model_validate(user),
        redirect_to=safe_redirect(payload.next),
    )


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    response: Response,
    factory: sessionmaker[Session] = Depends(app_session_factory),
    settings: Settings = Depends(app_settings),
) -> AuthResponse:
    session = factory()
    try:
        user = check_credentials(session, payload.email.strip().lower(), payload.password)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS
            )

        issued = start_session(session, user, settings)
        session.commit()
    finally:
        session.close()

    set_session_cookie(response, issued, settings)
    return AuthResponse(
        user=UserOut.model_validate(user),
        redirect_to=safe_redirect(payload.next),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    request: Request,
    response: Response,
    factory: sessionmaker[Session] = Depends(app_session_factory),
) -> None:
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        session = factory()
        try:
            revoke_session(session, token)
            session.commit()
        finally:
            session.close()

    clear_session_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)) -> UserOut:
    return UserOut.model_validate(user)


def session_expiry(user: User) -> datetime | None:
    """Exposed for tests and future refresh logic; not part of the public API."""
    return getattr(user, "expires_at", None)
