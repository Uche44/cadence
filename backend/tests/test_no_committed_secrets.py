"""No credential material may be committed.

The scanner is tested against synthetic keys first, so a passing scan means
something. A scanner that matches nothing would also "pass" a clean repo.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

SCANNED_SUFFIXES = {
    ".py",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".toml",
    ".yml",
    ".yaml",
    ".sh",
    ".md",
    ".html",
    ".css",
    ".example",
}

SKIPPED_DIRECTORIES = {
    ".git",
    ".venv",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".mypy_cache",
    ".vite",
}

SKIPPED_FILENAMES = {"package-lock.json", "uv.lock", "poetry.lock"}

MAX_SCANNED_BYTES = 1_000_000

CREDENTIAL_PATTERNS = (
    re.compile(r"gsk_[A-Za-z0-9]{20,}"),  # Groq
    re.compile(r"sk-[A-Za-z0-9]{20,}"),  # OpenAI style
    re.compile(r"hf_[A-Za-z0-9]{20,}"),  # Hugging Face
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),  # GitHub
    re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS access key id
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
)


def find_credentials(text: str) -> list[str]:
    return [pattern.pattern for pattern in CREDENTIAL_PATTERNS if pattern.search(text)]


def iter_scanned_files() -> Iterator[Path]:
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIPPED_DIRECTORIES for part in path.parts):
            continue
        if path.name in SKIPPED_FILENAMES:
            continue
        if path.suffix not in SCANNED_SUFFIXES:
            continue
        if path.stat().st_size > MAX_SCANNED_BYTES:
            continue
        yield path


@pytest.mark.parametrize(
    "synthetic",
    [
        "gsk_" + "a1B2c3D4e5F6g7H8i9J0k1L2",
        "sk-" + "a1B2c3D4e5F6g7H8i9J0k1L2",
        "hf_" + "a1B2c3D4e5F6g7H8i9J0k1L2",
        "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2",
        "AKIA" + "E" * 16,
        "-----BEGIN " + "PRIVATE KEY-----",
    ],
)
def test_scanner_detects_a_credential_shaped_string(synthetic: str) -> None:
    assert find_credentials(f'api_key = "{synthetic}"')


def test_scanner_ignores_ordinary_configuration_text() -> None:
    ordinary = (
        "CADENCE_SECRET_KEY=\n"
        "CADENCE_LLM_MODEL=a-model\n"
        "task_keyword=sk-learn\n"
        "description=ask-me-later\n"
    )

    assert find_credentials(ordinary) == []


def test_repository_contains_no_committed_credentials() -> None:
    offenders: list[str] = []

    for path in iter_scanned_files():
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if find_credentials(text):
            offenders.append(str(path.relative_to(REPO_ROOT)))

    assert offenders == [], f"possible credentials committed in: {offenders}"
