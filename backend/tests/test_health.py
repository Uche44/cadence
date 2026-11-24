"""The health endpoint is public, so its contract is narrow on purpose."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.config import Settings


def test_health_reports_status_and_version(client: TestClient, settings: Settings) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["version"] == settings.version


def test_server_time_is_timezone_aware(client: TestClient) -> None:
    body = client.get("/api/health").json()

    parsed = datetime.fromisoformat(body["server_time"])
    assert parsed.tzinfo is not None
    assert parsed.utcoffset() == UTC.utcoffset(None)


def test_health_exposes_only_the_documented_fields(client: TestClient) -> None:
    assert set(client.get("/api/health").json()) == {"status", "version", "server_time"}


def test_health_leaks_no_configuration(client: TestClient, settings: Settings) -> None:
    raw = client.get("/api/health").text.lower()

    assert str(settings.static_dir) not in raw
    assert settings.database_url.lower() not in raw
    assert settings.llm_base_url.lower() not in raw
    assert "secret" not in raw
    assert "api_key" not in raw
    assert "/home/" not in raw
