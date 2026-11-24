"""System endpoints."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.config import Settings
from app.deps import app_settings

router = APIRouter(tags=["system"])


@router.get("/health", summary="Liveness and version information")
def read_health(settings: Settings = Depends(app_settings)) -> dict[str, str]:
    """Report that the API is up.

    Deliberately narrow: no environment name, no database URL, no filesystem
    paths, no build details. Anything returned here is public.
    """
    return {
        "status": "ok",
        "version": settings.version,
        "server_time": datetime.now(UTC).isoformat(),
    }
