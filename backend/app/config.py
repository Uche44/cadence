"""Application configuration.

All configuration comes from the environment, optionally seeded from
``backend/.env``, using the ``CADENCE_`` prefix. The file path is absolute so
the app behaves identically no matter which directory it is launched from.

Production refuses to start unless the values it actually needs are present.
That is deliberate: a misconfigured deployment must fail at boot, loudly and by
name, rather than halfway through a demo with a confusing 500.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app import __version__
from app.safety.registry import DEFAULT_PACKS_DIR

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_STATIC_DIR = PROJECT_ROOT / "frontend" / "dist"
ENV_FILE = BACKEND_DIR / ".env"

ENV_PREFIX = "CADENCE_"

#: Settings that must hold a real value before a production boot is allowed.
PRODUCTION_REQUIRED = ("secret_key", "llm_api_key", "llm_model")


class Settings(BaseSettings):
    """Runtime configuration. Instantiate directly in tests to avoid ambient state."""

    model_config = SettingsConfigDict(
        env_prefix=ENV_PREFIX,
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Literal["development", "test", "production"] = "development"

    version: str = __version__
    database_url: str = "sqlite:///./cadence.db"

    secret_key: str = ""
    llm_base_url: str = "https://api.groq.com/openai/v1"
    llm_api_key: str = ""
    llm_model: str = ""

    static_dir: Path = DEFAULT_STATIC_DIR
    safety_packs_dir: Path = DEFAULT_PACKS_DIR

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @model_validator(mode="after")
    def _require_production_secrets(self) -> Settings:
        if not self.is_production:
            return self
        missing = [
            f"{ENV_PREFIX}{name.upper()}"
            for name in PRODUCTION_REQUIRED
            if not getattr(self, name).strip()
        ]
        if missing:
            raise ValueError("refusing to start in production without: " + ", ".join(missing))
        return self


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Process-wide settings. Tests build their own instead of calling this."""
    return Settings()
