"""Request-scoped dependencies."""

from __future__ import annotations

from fastapi import Request

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
