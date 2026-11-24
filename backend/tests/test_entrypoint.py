"""The documented run command must actually resolve.

A missing module-level ``app`` is invisible to every route test and fatal to
``uvicorn``. This exercises the real entry point rather than a test-only app,
and asserts on a served response rather than on internal route bookkeeping.
"""

from __future__ import annotations

import importlib

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings


@pytest.mark.slow
def test_asgi_entrypoint_serves_the_api(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CADENCE_ENVIRONMENT", "development")
    monkeypatch.delenv("CADENCE_SECRET_KEY", raising=False)
    get_settings.cache_clear()

    module = importlib.import_module("app.asgi")

    assert isinstance(module.app, FastAPI)
    with TestClient(module.app) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    get_settings.cache_clear()
