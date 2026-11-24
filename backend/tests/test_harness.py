"""The test harness must be able to fail.

A suite that cannot fail is worse than no suite, because it lies. This runs a
deliberately broken test in a subprocess and asserts the runner reports failure.
The equivalent check for Vitest lives in ``scripts/verify_harness.sh``.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.slow
def test_pytest_reports_failure_for_a_failing_test(tmp_path: Path) -> None:
    failing = tmp_path / "test_deliberate_failure.py"
    failing.write_text(
        "def test_deliberate_failure():\n    assert 1 == 2\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(failing), "-q", "-p", "no:cacheprovider"],
        capture_output=True,
        text=True,
        cwd=tmp_path,
        check=False,
    )

    assert result.returncode != 0, "pytest reported success for a failing test"
    assert "1 failed" in result.stdout
