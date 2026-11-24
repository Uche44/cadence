"""Configuration must fail loudly, by name, and only when it should."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app import __version__
from app.config import DEFAULT_STATIC_DIR, Settings

COMPLETE_PRODUCTION = {
    "environment": "production",
    "secret_key": "a" * 40,
    "llm_api_key": "b" * 40,
    "llm_model": "a-model",
    "_env_file": None,
}

PRODUCTION_SECRETS = [
    ("secret_key", "CADENCE_SECRET_KEY"),
    ("llm_api_key", "CADENCE_LLM_API_KEY"),
    ("llm_model", "CADENCE_LLM_MODEL"),
]


def test_development_needs_no_secrets() -> None:
    settings = Settings(environment="development", _env_file=None)

    assert not settings.is_production
    assert settings.version == __version__


def test_production_boots_with_a_complete_environment() -> None:
    settings = Settings(**COMPLETE_PRODUCTION)

    assert settings.is_production


@pytest.mark.parametrize(("field", "env_name"), PRODUCTION_SECRETS)
def test_production_names_each_missing_value(field: str, env_name: str) -> None:
    values = {**COMPLETE_PRODUCTION, field: ""}

    with pytest.raises(ValidationError) as excinfo:
        Settings(**values)

    assert env_name in str(excinfo.value)


def test_production_reports_every_missing_value_at_once() -> None:
    with pytest.raises(ValidationError) as excinfo:
        Settings(environment="production", _env_file=None)

    message = str(excinfo.value)
    for _, env_name in PRODUCTION_SECRETS:
        assert env_name in message


def test_whitespace_is_not_a_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(**{**COMPLETE_PRODUCTION, "secret_key": "   "})


def test_environment_variables_override_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CADENCE_ENVIRONMENT", "production")
    monkeypatch.setenv("CADENCE_SECRET_KEY", "x" * 32)
    monkeypatch.setenv("CADENCE_LLM_API_KEY", "y" * 32)
    monkeypatch.setenv("CADENCE_LLM_MODEL", "from-environment")

    settings = Settings(_env_file=None)

    assert settings.is_production
    assert settings.llm_model == "from-environment"


def test_production_without_configuration_fails_fast(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CADENCE_ENVIRONMENT", "production")

    with pytest.raises(ValidationError) as excinfo:
        Settings(_env_file=None)

    assert "CADENCE_SECRET_KEY" in str(excinfo.value)


def test_default_static_dir_points_at_the_frontend_build() -> None:
    assert DEFAULT_STATIC_DIR.is_absolute()
    assert DEFAULT_STATIC_DIR.name == "dist"
    assert DEFAULT_STATIC_DIR.parent.name == "frontend"
