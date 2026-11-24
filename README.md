# Cadence

An AI wellness companion that plans **one day at a time** around your actual routine and the things you enjoy. Fixed weekly plans break the moment a day goes sideways; Cadence re-plans instead of asking you to catch up.

Tagline: *Exercise that keeps pace with your life.*

## Status

**Milestone 1 of 15 complete** — foundation, configuration, and test harness.

See [MILESTONES.md](MILESTONES.md) for the full plan and [overview.md](overview.md) for the product brief. Each milestone is gated on review.

M1 gives you: a FastAPI app, a React + TypeScript app, one origin in production, explicit configuration that fails fast when misconfigured, JSON everywhere including errors, and two test suites that have been proven able to fail.

## Requirements

- Python 3.11+
- Node 20+
- `make` (optional, but every command below has a make target)

## Install

```bash
make install
```

## Run in development

Two terminals. The frontend proxies `/api` to the API, so the browser sees a single origin and there is no CORS configuration anywhere.

```bash
make dev-api    # terminal 1 — http://127.0.0.1:8000
make dev-web    # terminal 2 — http://127.0.0.1:5173
```

Open http://127.0.0.1:5173. The header shows a connection status drawn from `GET /api/health`.

## Run as production

One process serves both the API and the built frontend.

```bash
make build
cd backend && .venv/bin/uvicorn app.asgi:app --port 8000
```

Open http://127.0.0.1:8000 — the same URL serves the app and the API.

## Tests

```bash
make test        # both suites
make lint        # ruff, eslint, typecheck
make harness     # proves both runners fail when a test fails
make verify      # everything above, plus a production build
```

The backend suite covers the health contract, configuration validation in every environment, single-origin serving rules (API beats the SPA shell, unknown API paths stay JSON), error responses leaking nothing, version drift, and a credential scan that is itself tested against synthetic keys.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Development needs no secrets to boot.

In production the app **refuses to start** unless `CADENCE_SECRET_KEY`, `CADENCE_LLM_API_KEY`, and `CADENCE_LLM_MODEL` are set, and the error names every missing variable at once. That is intentional: a misconfigured deploy should fail at boot, not in front of a judge.

| Variable | Default | Purpose |
|---|---|---|
| `CADENCE_ENVIRONMENT` | `development` | `development`, `test`, or `production` |
| `CADENCE_DATABASE_URL` | `sqlite:///./cadence.db` | Database location |
| `CADENCE_SECRET_KEY` | — | Session signing; required in production |
| `CADENCE_LLM_BASE_URL` | Groq's OpenAI-compatible endpoint | Any OpenAI-compatible provider |
| `CADENCE_LLM_API_KEY` | — | Provider key; required in production |
| `CADENCE_LLM_MODEL` | — | Model id; required in production |
| `CADENCE_STATIC_DIR` | `frontend/dist` | Where the built frontend lives |

## Layout

```
backend/    FastAPI app, tests, configuration
frontend/   Vite + React + TypeScript, tests
scripts/    harness verification
design_reference/   the 16 reference screens
```

## Notes

- No seeded data and no placeholder personas. The app starts empty and is filled in by a real person.
- The LLM never decides safety. That distinction arrives with the safety packs in M4.
- Times are minute-resolution and the planning day is **wake to bedtime**, not midnight.
