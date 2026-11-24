"""Version drift between the package, the metadata, and the API is a real bug."""

from __future__ import annotations

import tomllib
from pathlib import Path

from app import __version__
from app.config import Settings

PYPROJECT = Path(__file__).resolve().parents[1] / "pyproject.toml"


def test_package_version_matches_project_metadata() -> None:
    metadata = tomllib.loads(PYPROJECT.read_text(encoding="utf-8"))

    assert metadata["project"]["version"] == __version__


def test_settings_report_the_package_version() -> None:
    assert Settings(_env_file=None).version == __version__
