"""Errors are always JSON, and never leak the server's filesystem."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import Settings


def test_unknown_api_path_is_json(client: TestClient) -> None:
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "detail" in response.json()


def test_unknown_api_path_is_not_html(client: TestClient) -> None:
    response = client.get("/api/nope")

    assert "text/html" not in response.headers["content-type"]
    assert "<!doctype html" not in response.text.lower()


def test_error_body_leaks_no_server_paths(client: TestClient, settings: Settings) -> None:
    raw = client.get("/api/nope").text

    assert str(settings.static_dir) not in raw
    assert "/home/" not in raw
    assert "Traceback" not in raw
