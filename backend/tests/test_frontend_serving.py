"""The SPA is served from the same origin as the API, and the API wins ties."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_root_serves_the_frontend_shell(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert "cadence-shell" in response.text


def test_client_side_routes_fall_back_to_the_shell(client: TestClient) -> None:
    """Refreshing a deep link must not 404 in the browser."""
    response = client.get("/today/plan")

    assert response.status_code == 200
    assert "cadence-shell" in response.text


def test_hashed_assets_are_served_as_javascript(client: TestClient) -> None:
    response = client.get("/assets/app-abc123.js")

    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert "cadence-shell" in response.text


def test_real_files_in_the_build_are_served_directly(client: TestClient) -> None:
    response = client.get("/icon.svg")

    assert response.status_code == 200
    assert "svg" in response.headers["content-type"]


def test_api_routes_win_over_the_shell(client: TestClient) -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def test_unknown_api_route_is_not_swallowed_by_the_shell(client: TestClient) -> None:
    response = client.get("/api/health/extra")

    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert "<!doctype html" not in response.text.lower()


def test_path_traversal_cannot_escape_the_build(client: TestClient) -> None:
    response = client.get("/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd")

    assert "root:" not in response.text


def test_missing_build_explains_itself_instead_of_crashing(tmp_path: Path) -> None:
    settings = Settings(environment="test", static_dir=tmp_path / "absent", _env_file=None)

    with TestClient(create_app(settings)) as scoped:
        response = scoped.get("/")

    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    assert "npm run build" in response.text


def test_no_permissive_cors_is_configured(client: TestClient) -> None:
    """Same-origin serving means a hostile Origin must gain nothing."""
    response = client.get("/api/health", headers={"Origin": "https://example.invalid"})

    header_names = {name.lower() for name in response.headers}
    assert "access-control-allow-origin" not in header_names
