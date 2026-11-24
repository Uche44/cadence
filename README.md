# Cadence

An AI wellness companion that plans **one day at a time** around your actual routine and the things you enjoy. Fixed weekly plans break the moment a day goes sideways; Cadence re-plans instead of asking you to catch up.

Tagline: *Exercise that keeps pace with your life.*

## Status

**Milestone 2 of 15 complete** — app shell, design system, and installable PWA.

See [MILESTONES.md](MILESTONES.md) for the full plan and [overview.md](overview.md) for the product brief. Each milestone is gated on review.

M2 gives you: the Serene Pebble design system in Tailwind, the reference welcome screen, a design-system page at `/design`, a self-hosted font, generated app icons, a web manifest, an offline-capable service worker, and checks that prove the design contract, installability, and real layout at three phone widths.

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
