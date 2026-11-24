# Cadence — Milestone Plan

15 gated milestones. Each one is a self-contained increment: it leaves the app runnable, has its own test suite that runs on its own, and is verifiable without any later milestone existing. No milestone starts until the previous one is approved.

## How this plan is governed

**Testing principle.** Tests are written from *intended functionality* — what the product must do for a user — not from whatever the code happens to do. That means:

- Expectations come from `overview.md` and the 16 design screens, not from the implementation.
- Every milestone's suite includes the unhappy paths: invalid input, boundary values, conflicting data, missing configuration, provider failure, empty data.
- A test that passes trivially is a bug in the test. If a behavior has no defined correct answer yet, it gets defined here first, then tested.
- **If a test fails and the spec is right, the code changes.** Weakening, skipping, or deleting a test to accommodate an implementation is not allowed without written justification and your explicit approval.
- No test may assert on internal structure (private helpers, call counts of internals, exact log lines) unless that structure *is* the contract. Behavior in, behavior out.

**Independence rule.** Each milestone must satisfy its own acceptance criteria with `main` green. It may *use* earlier milestones, but no acceptance criterion may depend on a later one. Every milestone ends with the app bootable and the full suite passing.

**Approval gate.** At the end of each milestone I present: test output (passing), the specific manual walkthrough with expected observations, and screenshots or a short screen recording for UI milestones. Then work stops until you approve. Approval is per milestone; silence is not approval.

**Non-negotiables carried through every milestone.**

- No seeded data, no fixtures in the shipped app, no placeholder personas. Neutral copy only.
- The LLM never decides safety. Deterministic code gates every recommendation.
- Every failure has a gentle, non-blaming state. There is no red "you failed" anywhere.
- Times are minute-resolution, day boundary is **wake → bedtime**, not midnight.
- All strings shipped to users are persona-free.

## At a glance

| # | Milestone | Surface | Verifiable alone |
|---|---|---|---|
| 1 | Foundation, config, test harness | infra | yes |
| 2 | App shell, design system, PWA | screen 1 | yes |
| 3 | Free-window scheduler | pure logic | yes |
| 4 | Safety packs & rule resolution | pure logic | yes |
| 5 | Plan validator & fallback planner | pure logic | yes |
| 6 | Persistence & domain model | data layer | yes |
| 7 | Accounts & sessions | screens 2, 3 | yes |
| 8 | Onboarding (health, interests, routine, consent) | screens 4–7 | yes |
| 9 | Morning check-in & commitments | screen 9 | yes |
| 10 | Red-flag stop path | screen 13 | yes |
| 11 | LLM service contract | backend | yes |
| 12 | Plan generation pipeline, Home & timeline | screens 8, 10 | yes |
| 13 | Exercise session player | screen 11 | yes |
| 14 | Re-plan & evening wrap-up | screens 12, 14 | yes |
| 15 | Progress, profile, hardening, deploy | screens 15, 16 | yes |

---

## M1 — Foundation, configuration, test harness

**Goal.** One repository where both languages build, both test runners actually fail when they should, and configuration is explicit rather than scattered.

**Scope.** `backend/` (FastAPI), `frontend/` (Vite + React + TypeScript), dev proxy from Vite to uvicorn, environment configuration, single-origin production serving, lint/format on both sides.

**Intent under test.** A developer can clone, install, run both servers, and get a truthful pass/fail signal. Misconfiguration fails loudly at startup instead of producing a mysterious 500 in the middle of a demo.

**Test obligations.**

- App boots with a complete environment; exits with a message *naming the missing variable* when a required value is absent in production profile.
- `GET /api/health` returns status, version, and server time; response contains no configuration values, tokens, or filesystem paths.
- Unknown API path returns a JSON 404, not an HTML error page.
- Unknown frontend route renders the app shell, not a blank screen.
- Frontend production build emits `dist/`; the backend serves it at `/` with correct content types, and API routes take precedence over the SPA fallback.
- Test harness truthfulness: a deliberately failing test in each runner makes the run fail. (This is a real test — it verifies the harness isn't silently skipping collection.)
- Secrets are read only from the environment; a repo-wide scan finds no committed key material.

**Done when.** `pytest` and `vitest` both run green from a clean checkout, the app boots, `/api/health` responds, and the deliberate-failure check has been demonstrated and then reverted.

**Depends on.** nothing. **Unlocks.** everything.

---

## M2 — App shell, design system, PWA

**Goal.** The visual language from `serene_pebble/DESIGN.md` exists as coded primitives, and the app is installable and offline-capable before any feature is built on top of it.

**Scope.** Design tokens, typography, and the primitive inventory: PillButton, Card, Chip, Input, Toggle, BottomNav, Sheet, StatTile, StatusBadge. Splash/welcome screen (screen 1). Manifest, icons, service worker, shell precache.

**Intent under test.** The app looks and behaves like the reference designs, is usable on a 390px screen without horizontal scrolling, meets touch and contrast requirements for users with fatigue or motor limits, and installs to a homescreen with an offline shell.

**Test obligations.**

- Every documented token (canvas, ink, pastel tiers, radii, spacing, type scale) exists as a CSS custom property; a lint check rejects raw hex values in component files.
- Every primitive renders without console errors and matches its documented states.
- PillButton: fires exactly once per click; disabled state blocks activation; Enter and Space activate when focused.
- Sheet: opens, closes via button and Escape, traps focus while open, and returns focus to its trigger on close.
- BottomNav: four destinations; the active item exposes `aria-current`; the indicator follows route changes.
- All interactive elements have a computed size of at least 48×48px, and a visible focus ring that survives keyboard navigation.
- Body text meets 4.5:1 contrast against its surface; large text meets 3:1. Computed from tokens, not eyeballed.
- Layout holds at 320px, 390px, and 430px widths with no horizontal scroll and no clipped text.
- Manifest declares name, short name, start URL, standalone display, theme colors, and all required icon sizes.
- Service worker registers in production; with the network disabled, reloading still renders the shell and shows an offline indicator instead of a browser error.

**Done when.** A `/design` route displays every primitive in every state, the splash screen matches the reference, the app installs from a browser, and an offline reload renders the shell.

**Depends on.** M1.

---

## M3 — Free-window scheduler

**Goal.** Given a wake time, a bedtime, and a day of commitments, produce the correct free windows. Pure functions, no I/O, no framework.

**Scope.** Day-boundary model (wake → bedtime), commitment normalization, buffering, overlap merging, clipping, minimum-window filtering.

**Intent under test.** Windows are the foundation of every plan. A wrong window produces a plan at the wrong time — the single most damaging class of bug in this product. This is also the visible Technical Execution artifact, so it gets the most adversarial suite in the project.

**Test obligations.**

- No commitments → one window spanning the whole day.
- Exactly adjacent commitments merge; no zero-length window is emitted between them.
- Overlapping commitments merge into one busy span.
- Duplicate commitments produce no duplicate busy spans or duplicate windows.
- Two commitments separated by less than the buffer merge after buffering.
- A commitment partially outside the day is clipped to the day; one entirely outside is ignored.
- A zero-length commitment does not split a window.
- A window exactly at the minimum length is included; one minute shorter is excluded.
- Unsorted input produces identical output to sorted input.
- A buffer large enough to cover the whole day yields zero windows, not a negative-length window.
- Bedtime not after wake time raises a clear, typed error rather than returning nonsense.
- Window output never extends outside wake → bedtime.
- Property-based check: windows are ordered, disjoint, inside the day, and never intersect a buffered commitment; total free minutes plus busy minutes equals the day's span.
- Minute resolution only: inputs with seconds do not produce sub-minute windows.

**Done when.** The suite covers every case above, the property test runs at least 200 generated cases, and no test asserts on internal helper names.

**Depends on.** M1.

---

## M4 — Safety packs & rule resolution

**Goal.** Conditions resolve into one merged, most-restrictive rule set. Unknown conditions can never be silently treated as healthy.

**Scope.** Pack schema, four shipped packs (general-fitness baseline, type 2 diabetes, hypertension, chronic low back pain/arthritis), conservative fallback pack, loader validation, merge semantics, alias normalization.

**Intent under test.** This is the safety core. A user declaring a condition must never receive a plan more permissive than their most restrictive condition allows, and a condition we haven't authored must produce caution, not a default fitness plan.

**Test obligations.**

- Every shipped pack loads and validates against the schema.
- Every clinical pack carries at least one citation and a non-empty red-flag list.
- Merging is most-restrictive: intensity takes the minimum, max block duration the minimum, daily total the minimum, minimum block duration the maximum.
- Blocked tags union across packs; duplicates collapse.
- Red-flag lists union and de-duplicate.
- No declared conditions resolves to the baseline pack and requires no doctor clearance.
- Any declared clinical condition requires doctor clearance.
- An unauthored condition ("asthma", "lupus") resolves to conservative mode, with intensity capped below moderate and a notice attached.
- Conservative rules are never more permissive than baseline for any field. Tested as a property, not by example.
- Alias handling: `"Type 2 Diabetes"`, `"type-2-diabetes"`, `"TYPE_2_DIABETES"` all resolve to the same pack.
- Empty, whitespace-only, and duplicate condition entries are handled without changing the resolved rule set.
- A malformed pack (unknown intensity label, max below min, missing citation on a clinical pack) fails at load time with the offending file named.
- Drop-in extensibility: a pack file added at runtime is discovered and resolvable with no code change.

**Done when.** All packs resolve correctly, the property test for restrictiveness passes, and adding a new pack is demonstrated without touching code.

**Depends on.** M1.

---

## M5 — Plan validator & deterministic fallback planner

**Goal.** A gate that rejects any unsafe plan, and a pure-Python planner that always produces something safe when the gate rejects.

**Scope.** Validation rules over a candidate plan, structured violation reporting, the fallback planner, the red-flag stop signal.

**Intent under test.** No unsafe recommendation ever reaches a user. When generation fails, the user gets a smaller valid plan rather than an error — and the fallback must itself be provably safe, or it becomes the vulnerability.

**Test obligations.**

- Each violation class is detected independently: intensity above cap, block longer than max duration, daily total above cap, blocked tag present, block outside a free window, overlapping blocks, block shorter than the minimum.
- Multiple simultaneous violations are all reported, not just the first.
- A plan with no violations produces an empty violation list (no false positives).
- Red-flag symptoms in the input short-circuit to a stop signal; no plan is validated or returned.
- The fallback planner produces a valid plan for every shipped pack, including the conservative pack.
- Fallback blocks fit inside free windows and respect the minimum block length.
- Fallback respects the daily total cap by truncating, not by shrinking blocks below the minimum.
- Fallback never emits a blocked tag for the pack in use.
- Fallback with no window large enough returns an explicit empty result with a reason — never a fabricated block.
- Fallback is deterministic: identical inputs produce byte-identical output.
- Property: for randomly generated windows, packs, and energy levels, the validator accepts every fallback output. Any counterexample is a blocker.

**Done when.** Every violation class has a failing-input test and a passing-control test, and the fuzz property runs clean.

**Depends on.** M3, M4.

---

## M6 — Persistence & domain model

**Goal.** A schema that can represent the whole flow, with integrity enforced by the database rather than by convention.

**Scope.** SQLAlchemy models and migrations for users, profiles, consents, check-ins, commitments, plans, plan blocks, completions, sessions, symptom notes.

**Intent under test.** The data layer must not be able to hold a state the product considers impossible — an orphan block, a completion without a block, a non-existent status, a duplicated account.

**Test obligations.**

- Foreign keys are enforced (`PRAGMA foreign_keys` on); an orphan insert fails.
- Deleting a user cascades to check-ins, plans, blocks, completions, consents, and sessions, leaving no residue.
- Email uniqueness is enforced at the database level, not only in application code.
- Block status rejects values outside the allowed set.
- Exactly one completion per block is possible; a second insert fails.
- Timestamps are stored in UTC and read back unambiguously.
- Round-trip: list fields (conditions, interests, equipment) survive save/load with order and content intact.
- Time fields preserve minute precision without drift.
- Migrations apply cleanly to an empty database and are safe to re-run.
- WAL mode is active, and two concurrent writes do not corrupt the file.
- Every model has a stated reason to exist, traceable to a screen or endpoint; unused tables are removed.

**Done when.** Migrations run from empty, the integrity suite passes, and the cascade test leaves a genuinely empty database.

**Depends on.** M1.

---

## M7 — Accounts & sessions

**Goal.** Real accounts with real sessions. Screens 2 and 3 built and wired.

**Scope.** Signup, login, logout, session cookie, protected-route middleware, validation surfaces for both screens.

**Intent under test.** Health data is personal. Sessions must end when the user says so, passwords must never leak, and no screen behind auth may render for an anonymous request.

**Test obligations.**

- Signup creates a user, sets a session cookie, and returns a redirect payload.
- Session cookie is `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production configuration.
- Password shorter than 8 characters is rejected server-side, independent of any client validation.
- Duplicate email is rejected with a clear conflict response and no stack trace.
- Stored password is never equal to the submitted plaintext, and verification accepts the correct password.
- No response body, error message, or log line ever contains the password or its hash.
- Wrong password returns 401 and sets no session.
- Unknown email returns the same shape and timing class of response as a wrong password (no account enumeration through behavior).
- Logout invalidates the session server-side; replaying the old cookie returns 401.
- Expired session returns 401 on any protected endpoint.
- Every protected endpoint rejects anonymous requests with a JSON 401, not a redirect to HTML.
- Login return path cannot be used to redirect off-site.
- Sign-up and log-in screens render validation errors without shifting layout, and submit only once per tap.

**Done when.** The auth suite passes, including the replay-after-logout and enumeration tests, and both screens are wired end to end.

**Depends on.** M6.

---

## M8 — Onboarding: health, interests, routine, consent

**Goal.** Intake collects everything the planner needs, and the doctor-clearance gate is real. Screens 4, 5, 6, 7.

**Scope.** Four-step flow, persistence, step resumption, rule resolution preview, consent record.

**Intent under test.** Everything downstream depends on this data. If onboarding can be skipped, half-collected, or completed without consent, the safety story collapses.

**Test obligations.**

- Steps cannot be reached out of order; requesting step 3 without 1 and 2 returns the correct resume point.
- Declared conditions persist and the response reports the *resolved* effective caps, so the user's constraints are visible and auditable.
- Selecting "Other chronic condition" surfaces conservative mode in the response and in the UI, with an explicit "confirm with your doctor" notice.
- Interests: fewer than three is rejected server-side; duplicates collapse; selections persist in order.
- Routine: bedtime must be after wake time; both persist and become the day bounds used by the scheduler.
- Equipment selection changes exercise eligibility (e.g. no equipment excludes floor-based work).
- Doctor clearance `false` blocks plan generation with an explanatory state — not an HTTP error and not a silent baseline plan.
- Consent records the agreement version and timestamp; the Home route is unreachable without a consent record for the current version.
- Refreshing mid-flow resumes at the correct step with prior answers intact.
- Editing the profile later re-resolves rules immediately and invalidates any plan built on old rules, marking it explicitly stale rather than leaving it silently wrong.
- All four screens are keyboard navigable and the progress indicator matches the actual step.

**Done when.** A new account can complete all four steps, the resolved caps match the packs, and the clearance-false branch is demonstrated end to end.

**Depends on.** M4, M6, M7.

---

## M9 — Morning check-in & commitments

**Goal.** A 30-second check-in that captures the day and feeds the scheduler. Screen 9.

**Scope.** Energy selection, symptom chips, notes, commitments list with add/edit/delete, live window preview.

**Intent under test.** The check-in is the only place the real day enters the system. It must be fast, forgiving, correctable, and it must detect red flags at the moment of input rather than after a plan is generated.

**Test obligations.**

- Energy accepts exactly one of low, steady, high; missing energy is rejected with a field-level message.
- Commitments require end after start; the error identifies which commitment is invalid.
- Overlapping commitments are permitted (real life) and the window preview shows them merged.
- Add, edit, and delete each round-trip correctly and update the preview without a page reload.
- A red-flag symptom selection returns an immediate stop signal from the check-in endpoint, before any planning occurs.
- Non-red-flag symptoms persist and are available to the planner as constraints.
- Notes are optional and length-bounded; oversized input is rejected cleanly rather than truncated silently.
- Re-checking in on the same day updates the existing record instead of creating a duplicate.
- The check-in's date is derived from the user's local day, not the server's UTC date — verified with a user whose local date differs from UTC.
- Empty day with no commitments still produces a valid full-day window and a usable check-in.
- The screen completes in a single scroll on a 390px viewport with the primary action always reachable.

**Depends on.** M3, M6, M8.

---

## M10 — Red-flag stop path

**Goal.** When the body says stop, the product stops. Screen 13.

**Scope.** Stop state, trigger from check-in and session, emergency contact, symptom note, rest-for-today outcome.

**Intent under test.** This is the highest-stakes screen in the product. It must never be ambiguous, must never coexist with a recommendation, and must never punish the user for using it.

**Test obligations.**

- The stop state is triggered from check-in and, once M13 exists, from inside a session.
- No exercise recommendation, duration, or "try this instead" appears anywhere in the stop state.
- Existing plan data is preserved but deactivated; the day is marked stopped, not deleted, so history stays truthful.
- Emergency contact renders when the profile has one, with a correctly formatted `tel:` link.
- With no emergency contact, the screen falls back to explicit guidance to contact local emergency services — never an empty affordance.
- "I'm feeling better, rest for today" closes the day as rested; no completion, no skip, no streak penalty.
- Symptom notes persist with a timestamp and are retrievable for later export.
- After a stop, re-entering a session requires a fresh check-in; the stop state cannot be bypassed by navigation.
- All stop-state copy avoids diagnosis, dosage, or treatment language.
- Every listed red-flag item matches the union of red flags from the user's active packs.

**Depends on.** M4, M9.

---

## M11 — LLM service contract

**Goal.** One module owns the provider, and it is impossible for its output to be trusted blindly. No UI in this milestone.

**Scope.** Provider client behind a single interface, prompt assembly, response parsing, typed failure modes, retry policy, budgets.

**Intent under test.** The provider is an unreliable external dependency. The system's correctness must not depend on it behaving, and swapping providers must not touch any other module.

**Test obligations.**

- The assembled prompt includes: the free windows, the resolved intensity and duration caps, the blocked tags, the user's interests, the energy level, and the tone constraints.
- The prompt never contains raw profile identifiers that aren't needed for personalization.
- Valid JSON parses into the expected block schema.
- Malformed JSON raises a typed parse error, not an unhandled exception.
- JSON missing required keys raises a typed schema error naming the missing field.
- A response arriving after the deadline raises a typed timeout error.
- A 429 triggers exactly one backoff retry, then a typed rate-limit error — never an unbounded loop.
- A 5xx triggers the retry policy and then a typed error.
- The same interface works unchanged against two different base URLs (two fake providers in the suite), proving swappability.
- The API key never appears in logs, error messages, or exception payloads.
- Request latency and token budget are enforced; exceeding either aborts and reports which budget was exceeded.
- Response parsing rejects blocks with missing title, intensity, duration, start/end, or tag list.

**Depends on.** M1. **Independently verifiable** with fake transports only — no network, no database.

---

## M12 — Plan generation pipeline, Home & timeline

**Goal.** The user always gets a valid plan or a safe explanation. Screens 8 and 10.

**Scope.** Orchestration (windows → rules → LLM → validate → retry once → fallback → persist), Home summary, timeline view, generating and failure states.

**Intent under test.** This is the product's promise holding under adversarial conditions: bad model output, slow model, no windows, no clearance. The user must never see an unsafe or unexplained plan.

**Test obligations.**

- Happy path with a valid fake provider: plan persists, every block falls inside a free window, and the response matches the block schema from the designs.
- Provider output exceeding the intensity cap → one regeneration → still invalid → deterministic fallback, and the fallback notice is returned.
- Provider output containing a blocked tag → same path.
- Provider returning zero blocks is treated as a failure, not an empty success.
- Malformed provider output follows the documented retry-then-fallback policy, and the policy is asserted explicitly.
- No free windows → a distinct empty-plan state with an explanation; zero provider calls are made.
- Doctor clearance absent or stale → blocked state, zero provider calls.
- Red-flag input reaches the stop state before any provider call.
- Regenerating the same day replaces only unfinished blocks and preserves completed ones.
- Home summary counts and total minutes are derived from the persisted plan, not from the model's claims about itself.
- Timeline orders blocks chronologically, shows commitment spans as non-actionable context, and never offers a start action for a past block.
- Empty state before the first plan, generating state during the call, and failure notice state are all reachable and each explains what happened in neutral language.
- The failure notice says *why* (e.g. "we lowered the intensity to stay within your limits") without any medical claim.
- Generated copy contains no persona names and no clinical diagnosis language.

**Depends on.** M3, M4, M5, M6, M9, M11.

---

## M13 — Exercise session player

**Goal.** A session the user can actually follow, that is honest about elapsed time and easy to stop. Screen 11.

**Scope.** Step sequence, countdown, pause/resume, skip, completion, safety affordance, wake lock.

**Intent under test.** The timer is the user's contract with the exercise. If it lies, the user overexerts. If stopping is hard, the safety design is decorative.

**Test obligations.**

- Countdown reaches zero from an arbitrary start with drift under one second per ten minutes (fake timers, wall-clock reconciliation).
- Pause freezes the countdown; resume continues from the paused value, not from the original start.
- Time spent with the tab hidden is reconciled from the wall clock on return rather than silently lost or double-counted.
- Skip advances to the next step and marks the current step skipped, not completed.
- Completing all steps marks the block done with actual elapsed duration, not planned duration.
- Exiting early returns the block to planned status; partial completion is not recorded as done.
- The safety affordance is reachable from every step and routes to the stop state in one action.
- Wake lock is requested while running and released on pause, exit, and completion; denial degrades without breaking the timer.
- No audio autoplays; any cue is opt-in.
- The timer is announced to assistive technology at meaningful intervals, not every second.
- Backgrounding the app does not mark the session complete or skip steps.

**Depends on.** M6, M10, M12.

---

## M14 — Re-plan & evening wrap-up

**Goal.** The day can change without blame, and the day can close with an honest record. Screens 12 and 14.

**Scope.** Re-plan reasons, remaining-only regeneration, wrap-up outcomes, felt rating, day locking.

**Intent under test.** Re-planning is the product's differentiator and its emotional core. It must touch only the future, respect every safety rule, and leave the user with nothing to feel guilty about.

**Test obligations.**

- Completed blocks are immutable across any number of re-plans.
- Only windows that are still in the future, relative to the current clock, are used.
- "Energy dropped" produces new blocks at or below the previous intensity cap.
- "Only 5 minutes left" produces a total new duration of at most five minutes.
- "Shift ran late" with updated commitments shrinks the available windows accordingly, and the dropped blocks are the ones inside the newly busy time.
- Re-plan with nothing remaining returns a "day complete" state, not an error and not an empty failure.
- Re-planning twice in a row does not duplicate blocks or resurrect completed ones.
- Untouched blocks keep their identifiers, so history and completion links stay stable.
- Every re-plan output passes the same validator and falls back the same way; no path skips the gate.
- Wrap-up done/skipped counts match actual block statuses exactly.
- Skipping requires a reason from the offered set; the reason is persisted and retrievable for the next day's context.
- Felt rating accepts exactly one of the three options.
- Completing wrap-up locks the day; edits require an explicit reopen action that is recorded.
- `2 of 3` renders as 66%, and a day with zero blocks renders 0% without a division error.
- No copy in either screen implies the user failed or lost progress.

**Depends on.** M10, M12, M13.

---

## M15 — Progress, profile, hardening, deploy

**Goal.** Honest aggregation, a profile that reflects reality, and a deployed app that survives a judge clicking it. Screens 15 and 16.

**Scope.** Progress metrics, movement breakdown, streak, profile sections and editing, offline read-only plan, production deployment, full-journey end-to-end test.

**Intent under test.** Numbers shown to a person managing a chronic condition must be true and must never fabricate encouragement. The deployed app must behave the same as the tested app.

**Test obligations.**

- Active minutes equal the sum of *completed* block durations only — planned and skipped blocks contribute zero.
- Pacing rate follows its stated definition; with zero completions it returns a defined value and no `NaN`.
- Streak counts consecutive days with at least one completion; a rested day is neutral and neither extends nor breaks it; a fully missed day resets it.
- Movement breakdown by interest sums to 100% with rounding resolved (no 99% or 101%).
- The clinical-insight element is absent when there is insufficient data. No invented correlation is ever rendered.
- Week boundaries follow the user's local calendar, not UTC.
- Editing conditions, interests, equipment, or routine re-resolves rules and marks existing plans stale rather than leaving them silently inconsistent.
- Account deletion removes all associated data, verified by a post-delete sweep for residue.
- Offline: reloading without a network shows the last plan read-only with an offline banner, and never presents a stale plan as current.
- Deployment: production health check passes, static assets are served from the same origin, cookie flags are correct under HTTPS, and a bundle scan finds no secrets.
- Installability criteria pass (manifest, icons, service worker, HTTPS).
- A repo-wide grep confirms no persona names appear in shipped strings.
- Full-journey end-to-end test in one run: signup → onboarding → check-in → plan → session → re-plan → wrap-up → progress, asserting user-visible outcomes at each step.

**Depends on.** all previous.

---

## Out of scope for all 15

Calendar import, push or messaging reminders (the toggle ships disabled), biometric sign-in, symptom-note export to a clinician, wearable data, social features, payments, multi-user sharing, weekly program planning, and any diagnosis or medication guidance.

## Risk register

| Risk | Where it bites | Mitigation built into the plan |
|---|---|---|
| Provider latency during demo | M12 | Fallback planner + offline cached plan |
| Provider output drifts from schema | M11, M12 | Typed parse errors + capped retry + gate |
| Safety rules authored from memory, not reviewed | M4 | Citations required per pack, illustrative-use disclaimer in README |
| Design artifacts inherited as intent | M2 | Reference treated as composition, defects rebuilt clean |
| Time overrun on player polish | M13 | Steps and timer are the contract; audio and breath sync optional |
| Deployment differs from local | M15 | Same origin, explicit production cookie and secret tests |
