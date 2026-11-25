"""Test scaffolding shared between suites."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]


def upgrade_to_head(url: str) -> None:
    """Apply every migration to ``url``, as a deploy would."""
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    command.upgrade(config, "head")
