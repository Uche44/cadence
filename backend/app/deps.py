"""Request-scoped dependencies."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import Request
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings
from app.safety.registry import PackRegistry


def app_settings(request: Request) -> Settings:
    """Return the settings the running app was created with.

    Reading from ``app.state`` rather than the cached global keeps tests and
    multiple app instances from leaking configuration into each other.
    """
    settings: Settings = request.app.state.settings
    return settings


def app_registry(request: Request) -> PackRegistry:
    """Return the pack registry this app was validated against at boot."""
    registry: PackRegistry = request.app.state.safety_registry
    return registry


def app_session_factory(request: Request) -> sessionmaker[Session]:
    """Return the session factory bound to this app's engine."""
    factory: sessionmaker[Session] = request.app.state.session_factory
    return factory


def app_now(request: Request) -> datetime:
    """The current UTC time, overridable so local-day behaviour is testable.

    Tests replace ``app.state.clock`` with a fixed instant; production uses the
    real clock.
    """
    clock = getattr(request.app.state, "clock", None)
    moment: datetime = clock() if clock is not None else datetime.now(UTC)
    return moment if moment.tzinfo is not None else moment.replace(tzinfo=UTC)
