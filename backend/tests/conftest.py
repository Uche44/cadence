"""Shared fixtures.

Every test builds its own settings and its own app. Nothing reads the
developer's ``.env`` or the process environment, so the suite gives the same
answer on a laptop, on a CI box, and on the demo machine.
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app

INDEX_HTML = (
    "<!doctype html><html><head><title>Cadence</title></head>"
    '<body><div id="root">cadence-shell</div></body></html>'
)


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A throwaway stand-in for a real ``frontend/dist`` build."""
    dist = tmp_path / "dist"
    assets = dist / "assets"
    assets.mkdir(parents=True)
    (dist / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    (assets / "app-abc123.js").write_text("console.log('cadence-shell');", encoding="utf-8")
    (dist / "icon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
    return dist


@pytest.fixture
def settings(static_dir: Path) -> Settings:
    return Settings(environment="test", static_dir=static_dir, _env_file=None)


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as test_client:
        yield test_client
