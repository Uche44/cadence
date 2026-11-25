"""Accounts and sessions."""

from app.auth.dependencies import current_user, require_same_origin
from app.auth.passwords import (
    MAXIMUM_PASSWORD_LENGTH,
    MINIMUM_PASSWORD_LENGTH,
    hash_password,
    verify_password,
)
from app.auth.sessions import (
    SESSION_COOKIE,
    SESSION_TTL_HOURS,
    check_credentials,
    clear_session_cookie,
    create_user,
    hash_token,
    new_token,
    resolve_session,
    revoke_session,
    set_session_cookie,
    start_session,
)

__all__ = [
    "MAXIMUM_PASSWORD_LENGTH",
    "MINIMUM_PASSWORD_LENGTH",
    "SESSION_COOKIE",
    "SESSION_TTL_HOURS",
    "check_credentials",
    "clear_session_cookie",
    "create_user",
    "current_user",
    "hash_password",
    "hash_token",
    "new_token",
    "require_same_origin",
    "resolve_session",
    "revoke_session",
    "set_session_cookie",
    "start_session",
    "verify_password",
]
