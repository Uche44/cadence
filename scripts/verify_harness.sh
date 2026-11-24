#!/usr/bin/env bash
#
# Proves that both test runners actually report failure.
#
# A suite that cannot fail is worse than no suite, because it lies about the
# state of the project. This drops a deliberately broken test into each runner,
# asserts a non-zero exit status, and cleans up after itself.
#
# Usage: bash scripts/verify_harness.sh

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_python="$root/backend/.venv/bin/python"
scratch="$(mktemp -d)"
frontend_probe="$root/frontend/src/__harness_probe.test.ts"

cleanup() {
  rm -rf "$scratch"
  rm -f "$frontend_probe"
}
trap cleanup EXIT

if [[ ! -x "$backend_python" ]]; then
  echo "Backend virtualenv not found at $backend_python" >&2
  echo "Run: make install-backend" >&2
  exit 1
fi

echo "== pytest =="
cat >"$scratch/test_deliberate_failure.py" <<'PY'
def test_deliberate_failure():
    assert 1 == 2
PY

if (cd "$scratch" && "$backend_python" -m pytest test_deliberate_failure.py -q -p no:cacheprovider); then
  echo "FAIL: pytest reported success for a failing test" >&2
  exit 1
fi
echo "ok: pytest fails when a test fails"

echo "== vitest =="
cat >"$frontend_probe" <<'TS'
import { expect, it } from 'vitest'

it('deliberate failure', () => {
  expect(1).toBe(2)
})
TS

if (cd "$root/frontend" && npx vitest run src/__harness_probe.test.ts); then
  echo "FAIL: vitest reported success for a failing test" >&2
  exit 1
fi
echo "ok: vitest fails when a test fails"

echo
echo "harness verification passed"
