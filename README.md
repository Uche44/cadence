# Cadence

An AI wellness companion that plans **one day at a time** around your actual routine and the things you enjoy. Fixed weekly plans break the moment a day goes sideways; Cadence re-plans instead of asking you to catch up.

Tagline: *Exercise that keeps pace with your life.*

## Status

**Milestone 6 of 15 implemented, pending review** — persistence and the domain model.

See [MILESTONES.md](MILESTONES.md) for the full plan and [overview.md](overview.md) for the product brief. Each milestone is gated on review.

M2 gave you: the Serene Pebble design system in Tailwind, the reference welcome screen, a design-system page at `/design`, a self-hosted font, generated app icons, a web manifest, an offline-capable service worker, and checks that prove the design contract, installability, and real layout at three phone widths.

M3 gave you: `compute_free_windows` — the waking-day model, buffered and clipped commitments, merged busy spans, minimum-window filtering, typed errors, and a Hypothesis suite checked against an independent minute-by-minute oracle.

M4 gave you: five authored condition packs that resolve into one most-restrictive rule set, a conservative fallback for any condition we have not written rules for, a notice that says so, and validation strict enough that a malformed pack stops the app at boot.

M5 gave you: `validate_plan`, a gate that reports every way a candidate plan breaks the rules; `build_fallback_plan`, a deterministic gentle plan used when generation fails; and `red_flag_stop`, which ends the day instead of planning one.

M6 gives you: ten tables covering the whole flow, with integrity enforced by SQLite rather than by convention, and Alembic migrations that apply from empty, re-run safely, and are checked against the models for drift.

## Requirements

- Python 3.11+
- Node 20+
- Chromium (only for the layout check; set `CHROMIUM_PATH` if it is not at `/usr/bin/chromium`)
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

The service worker is disabled in development on purpose, so a stale cache never hides your changes. It only exists in a production build.

## Run as production

One process serves both the API and the built frontend.

```bash
make build
cd backend && .venv/bin/uvicorn app.asgi:app --port 8000
```

Open http://127.0.0.1:8000 — the same URL serves the app and the API. Load it once with the network available, then reload with the network disabled: the shell still renders and the header says **Offline**.

## Tests and checks

```bash
make test         # backend + frontend suites
make lint         # ruff, eslint, prettier, design contract, typecheck
make check-pwa    # manifest, icons, service worker, precache, font
make check-layout # real Chromium at 320/390/430px, writes screenshots/
make harness      # proves both runners fail when a test fails
make verify       # everything above, plus a production build
```

The design contract is a real check, not a convention. `tools/design-checks.mjs` fails the build when:

- a required token disappears from the Tailwind theme
- a colour literal appears anywhere under `src/` except the theme file
- a quoted token name does not exist in the theme
- a reference colour drifts from the documented value
- any text pair falls below its contrast floor

Each of those checks is itself tested with a synthetic failing case, because a check that cannot fail is not a check.

Computed layout is verified separately in a real browser by `tools/layout-check.mjs`: 48px minimum touch targets, no horizontal overflow, no clipped headings, and the resolved body font — at 320, 390, and 430px.

The scheduler suite adds 33 cases, three of them property-based over 250–300 generated days, and checks the scheduler against an independent brute-force oracle that marks every minute of the day free or busy. The safety and plan-gate suites add 105 more, including properties that build real schedules with the scheduler and real rule sets from the packs, then assert the fallback is always accepted by the gate.

## Scheduling model

The planning day is the user's waking day — wake to bedtime — not midnight to midnight, so sleep is never offered as available time and midnight is not a special case.

All arithmetic is whole minutes; seconds are floored. Each commitment is padded by a buffer and clipped to the day, overlapping and adjacent commitments merge into single busy spans, and gaps shorter than the minimum window are discarded rather than offered as two-minute exercise slots.

Bedtimes after midnight are not representable in a same-day model. Onboarding maps them to 23:59, which only discards the tail of the evening.

## Design system

The theme lives in `frontend/src/styles/index.css` as Tailwind v4 `@theme` variables, so tokens generate utilities directly: `bg-lavender`, `text-headline-lg`, `rounded-pill`, `shadow-card`, `max-w-app`. Spacing uses Tailwind's numeric scale, so the 48px touch floor is `min-h-12`.

Primitives live in `frontend/src/components/` and are composed from utilities. `lib/cn.ts` wraps `clsx` plus `tailwind-merge`, extended with this project's type and colour token names — without that, `tailwind-merge` cannot tell `text-label-lg` (a size) from `text-on-ink` (a colour) and silently drops one.

Visit `/design` in a running build to see every token value, the type scale, radii, shadows, and every primitive in every state.

| Primitive | Notes |
|---|---|
| `PillButton` | four variants, two sizes, icon slots; `pillButtonClasses()` for links |
| `Card` | six pastel tones plus surface |
| `Chip` / `Tag` | selectable chip exposes `aria-pressed`; tag is static |
| `Input` | label, hint, error, icon; error is announced via `role="alert"` |
| `Toggle` | `role="switch"` with a visible label as its accessible name |
| `BottomNav` | four destinations, floating or inline, `aria-current` |
| `Sheet` | modal dialog: focus held, Escape closes, focus returns |
| `StatTile` | four tones, tabular numerals |
| `StatusBadge` | five semantic tones |

Deliberate deviations from the reference screens, so they are not mistaken for oversights:

- Body type is **Nunito**, self-hosted via `@fontsource-variable/nunito`, replacing the reference's Plus Jakarta Sans. Nunito's rounder forms suit the pebble language; swap the theme token and the import to change it back.
- Styling is **Tailwind v4** utilities rather than the hand-written CSS in the reference export. The theme file is still the single home for tokens.
- Muted text uses `#4b5563` rather than `#64748b`. The reference tone measures 4.34:1 on the periwinkle canvas, below the 4.5:1 floor, so the accessible slate is the only muted colour exposed as a utility.
- Icons are inline SVG rather than a Material Symbols webfont, so the offline shell has no third-party font dependency.
- The 3D artwork is cropped and alpha-preserved from the reference asset rather than re-rendered.

## Safety rules

Rules are data, not prompt text. Each condition is a JSON file in `backend/app/safety/packs/` carrying an intensity cap, block and daily duration limits, blocked exercise tags, red-flag symptoms, published sources, and guidance notes for the planner.

Resolution takes the most restrictive value of every field: the lowest intensity cap, the shortest maximum block, the smallest daily total, the largest minimum block, and the union of every blocked tag and red flag. Declaring a second condition can therefore only tighten a plan, never widen it — which the test suite asserts as a property rather than by example.

Two things are deliberate:

- The general-fitness baseline always applies, so a user with no conditions still gets sensible limits and no doctor-clearance gate.
- A condition we have not authored adds the conservative pack (low intensity, 10-minute blocks, 20 minutes a day) and a notice naming it. It never silently becomes a general fitness plan. `"diabetes"` without a type is treated as unauthored on purpose, because type 1 and type 2 need different guidance.

Packs are validated when the app boots. An unknown field, a bad intensity label, a clinical pack without a citation, or two packs claiming the same alias raises an error naming the offending file, and the app refuses to start. Adding a condition is dropping a JSON file into the directory — no code change.

**These limits are illustrative.** They are drawn from published guidance and are not a substitute for clinical review before real use.

## The plan gate

Every candidate plan is validated before it can reach a person. The gate reports all of: intensity above the cap, a block longer than the maximum, a block shorter than the minimum, a daily total over the limit, a blocked exercise tag, a block outside a free window, and overlapping blocks. It reports every problem at once rather than stopping at the first, and it names the offending block by index and title.

When generation fails validation, times out, or returns something unparseable, `build_fallback_plan` produces a plan from the same free windows. It is intentionally unimaginative: ten-minute gentle blocks at the start of each window, lowest intensity, tags filtered against the blocked list, daily allowance respected by truncating rather than squeezing blocks below the minimum. If no window is long enough it returns an empty plan with a stated reason rather than inventing a session.

Red-flag symptoms short-circuit the whole pipeline: `red_flag_stop` returns a stop signal and no plan is generated, validated, or shown. Matching tolerates honest wording — "lightheaded" against "lightheadedness", "chest pain" against "chest pain, pressure or tightness" — but not bare body parts, so "knee pain" stays an ordinary report.

## Database

SQLite through SQLAlchemy 2, with Alembic migrations in `backend/migrations/`. Run them before the first boot:

```bash
make migrate
```

The app does not migrate itself. Migrations are a deploy step, and an app that silently alters its own schema is an app you cannot reason about.

Three PRAGMAs are applied on every connection, because SQLite's defaults are wrong for this:

- `foreign_keys=ON` — SQLite ignores foreign keys unless asked, so a cascade test would otherwise pass while orphans accumulated.
- `journal_mode=WAL` — readers do not block the writer, which matters once a plan is being generated while someone is checking in.
- `busy_timeout` — a brief write collision waits instead of failing.

Time is stored as **minutes since midnight** rather than as SQLite time strings. The scheduler and validator already work in whole minutes, so storing anything else would invite rounding at the boundary. Timestamps are stored in UTC and read back timezone-aware; a naive datetime is rejected rather than silently assumed to be local.

Uniqueness and ordering are database constraints, not conventions: one account per email (case-insensitively), one profile per user, one check-in per local day, one plan per check-in, one completion per block, one consent per version, ordered start and end minutes on commitments and blocks, bedtime after wake time, and a session that expires after it begins. Deleting a user cascades to everything they own.

The suite also compares the migrated schema against the SQLAlchemy models, because drift between the two is a silent production break.

## Configuration

Copy `backend/.env.example` to `backend/.env`. Development needs no secrets to boot.

In production the app **refuses to start** unless `CADENCE_SECRET_KEY`, `CADENCE_LLM_API_KEY`, and `CADENCE_LLM_MODEL` are set, and the error names every missing variable at once.

| Variable | Default | Purpose |
|---|---|---|
| `CADENCE_ENVIRONMENT` | `development` | `development`, `test`, or `production` |
| `CADENCE_DATABASE_URL` | `sqlite:///./cadence.db` | Database location |
| `CADENCE_SECRET_KEY` | — | Session signing; required in production |
| `CADENCE_LLM_BASE_URL` | Groq's OpenAI-compatible endpoint | Any OpenAI-compatible provider |
| `CADENCE_LLM_API_KEY` | — | Provider key; required in production |
| `CADENCE_LLM_MODEL` | — | Model id; required in production |
| `CADENCE_STATIC_DIR` | `frontend/dist` | Where the built frontend lives |
| `CADENCE_SAFETY_PACKS_DIR` | `backend/app/safety/packs` | Condition packs to load and validate at boot |

## Layout

```
backend/    FastAPI app, tests, configuration
frontend/   Vite + React + TypeScript, design system, tests, build tools
scripts/    harness verification, icon and artwork generation
design_reference/   the 16 reference screens
```

## Notes

- No seeded data and no placeholder personas. The app starts empty and is filled in by a real person.
- The LLM never decides safety. That distinction arrives with the safety packs in M4.
- Times are minute-resolution and the planning day is **wake to bedtime**, not midnight.
- The four bottom-nav destinations exist as honest empty states until their milestones land.
