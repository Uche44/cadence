"""Application assembly.

One process serves both the JSON API (under ``/api``) and the built frontend
(everything else). Same origin in development and production, so there is no
CORS configuration anywhere in the project.
"""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.health import router as health_router
from app.config import Settings, get_settings

logger = logging.getLogger("cadence")

API_PREFIX = "/api"

#: Methods that must never fall through to the HTML shell.
API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the application.

    Accepting settings as an argument (instead of reading them at import time)
    is what lets the test suite exercise production behaviour, a missing build,
    and a real build directory without touching the environment.
    """
    resolved = settings if settings is not None else get_settings()

    application = FastAPI(
        title="Cadence API",
        version=resolved.version,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    application.state.settings = resolved

    # Order matters: real routes, then the API 404 responder, then the shell.
    application.include_router(health_router, prefix=API_PREFIX)
    _register_api_fallback(application)
    _register_frontend(application, resolved)
    _register_error_handlers(application)
    return application


def _register_api_fallback(application: FastAPI) -> None:
    """Answer unknown ``/api`` paths with JSON, never the HTML shell."""

    @application.api_route(
        f"{API_PREFIX}/{{rest:path}}",
        methods=API_METHODS,
        include_in_schema=False,
    )
    async def api_not_found(rest: str) -> JSONResponse:
        return JSONResponse(
            status_code=404,
            content={"detail": f"No API route matches '/api/{rest}'."},
        )


def _register_frontend(application: FastAPI, settings: Settings) -> None:
    """Serve the built SPA, falling back to index.html for client-side routes."""
    dist = Path(settings.static_dir)
    index = dist / "index.html"

    assets_dir = dist / "assets"
    if assets_dir.is_dir():
        application.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @application.get("/{requested_path:path}", include_in_schema=False)
    async def frontend(requested_path: str) -> Response:
        if requested_path == "api" or requested_path.startswith("api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found."})

        if not index.is_file():
            return JSONResponse(
                status_code=503,
                content={
                    "detail": "Frontend build not found.",
                    "hint": "Run `npm run build` in frontend/.",
                },
            )

        if requested_path:
            candidate = (dist / requested_path).resolve()
            if candidate.is_file() and candidate.is_relative_to(dist.resolve()):
                return FileResponse(candidate)

        return FileResponse(index)


def _register_error_handlers(application: FastAPI) -> None:
    """Keep every error a JSON document, including framework-generated ones."""

    @application.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )
