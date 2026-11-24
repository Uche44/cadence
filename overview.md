Cadence: Project Overview

Read this first. It explains what we're building, why, and how. Where something is marked [DEFAULT], it's a sensible starting choice that the developer can override. Where it's marked [OPEN], ask before assuming.

1. What Cadence is

Cadence is an AI-powered wellness companion that gives daily, tailored exercise recommendations to people managing certain illnesses, built around their actual routine (work, classes, commute, family obligations) instead of a fixed plan they can't keep up with.

It also takes note of things the user enjoys (music, football, gardening, calling friends, a favorite show) and uses them to make exercise feel easier and more likely to happen.

Tagline idea: "Exercise that keeps pace with your life."

2. Why it exists (the problem)
Most fitness apps and doctor-given routines assume a free hour at a fixed time. Real days are unpredictable.
People managing conditions like diabetes or hypertension benefit a lot from regular, gentle movement, but fixed plans fail, then people feel like they failed.
Weekly plans break the moment one day goes sideways, so Cadence plans one day at a time and re-plans when the day changes.
3. Hackathon context
Event: Code for Change (global online student hackathon, hosted by HackathonForEveryone on Devpost)
Page: https://code-for-change-global.devpost.com/
Deadline: Dec 1, 2026, 5:00pm PST
Theme: practical technology for positive change in communities (health is an eligible focus)
Judging criteria: Impact, Originality, Technical Execution, Presentation
Submission needs: Devpost project page with description, demo video or live demo link, source code or build instructions, team member names

Implication: ship a working, demo-able vertical slice, not a wide half-built app. Prioritize anything that makes the 2 to 3 minute demo video clear and impressive.

4. Core user flow (daily, not weekly)
Intake (once): conditions, doctor clearance, equipment available, interests/things they enjoy, any exercise restrictions.
Morning check-in (about 30 seconds): today's commitments/time blocks, energy level (low/okay/high), symptoms or anything off today, notes.
Find free windows: backend computes the free time slots in the day.
Generate today's plan: exercise blocks fitted to those windows, adjusted for energy, condition limits, and interests.
Adapt during the day: a "my day changed" action re-plans the remaining slots. No failure state, it just adjusts.
Evening wrap-up: mark blocks done/skipped (with an optional reason and how it felt). This feeds tomorrow's plan.
5. Key features (build in this priority order)

Must have (the demo depends on these)

Intake + daily check-in
Free-window calculation from the day's commitments
Daily plan generation (rules + LLM)
Safety guardrails (see section 7)
"My day changed" re-plan
Mark complete/skipped + simple progress view

Should have 7. Interest-based exercise mapping ("enjoyment angle", see section 6) 8. Feedback loop: completion history influences tomorrow's plan

Nice to have (only if time remains) 9. Google Calendar import 10. WhatsApp/Telegram reminders 11. Low-data/PWA friendly mode

6. The enjoyment angle (our differentiator)

Map what the user likes onto movement instead of prescribing generic exercises. Examples:

Interest	Cadence suggests
Music	10-minute dance session
Football	Light ball drills or a walk-and-kick
Gardening / cooking	Active-chore blocks
Phone calls with friends	Walk-and-talk
TV shows	Stretching or marching in place during an episode

Store interests per user, have the LLM pick/adapt exercises around them, and track completion rate per activity type to refine future plans.

7. Safety (core requirement, not an afterthought)

The users have medical conditions, so safety is a first-class feature and part of our Technical Execution story.

Positioning: Cadence is a wellness companion that supports a doctor's advice. It does not diagnose or treat. Show a clear disclaimer in the UI.
Intake gating: ask about conditions, relevant medications, and whether a doctor has cleared them for exercise.
Deterministic guardrails in code, not just in the prompt: per-condition caps on intensity and duration, blocked exercise types for relevant conditions. Every LLM output must be validated against these rules before it reaches the user. If validation fails, regenerate or fall back to a safe default plan.
Red-flag stop rules: if the user reports chest pain, dizziness, severe shortness of breath, etc., stop the plan and tell them to seek medical help.
Ground rules in published guidance (e.g. WHO physical activity guidelines, diabetes and hypertension association recommendations) and cite them in the Devpost write-up.

Architecture principle: the LLM handles personalization, wording, and tone. Deterministic code enforces safety and scheduling.

8. Conditions in scope

[DECIDED] Broad intake, narrow authored safety. Intake accepts a broad catalog of conditions plus a "no condition, just want to stay fit" path.

Rule architecture (layered, resolved at plan time):

- Baseline pack: general-fitness guidance applied to every user (WHO-style: ~150 min/week moderate, 2 strength sessions). This is the "just want to stay fit" path and needs no doctor-clearance gate.
- Condition packs: one config file per condition (max intensity, max duration, blocked exercise tags, red-flag symptoms, guidance citation). Multiple packs intersect: most restrictive cap wins, blocked tags union.
- v1 ships Type 2 diabetes, hypertension, and chronic lower back pain / mild arthritis, each fully authored and unit-tested. The loader is pack-agnostic, so more conditions are config-only changes.
- Safe fallback: a declared condition with no authored pack must NOT silently receive a general plan. It drops into conservative mode (low intensity ceiling, short blocks, no high-impact tags) plus a visible "no condition-specific rules yet, confirm with your doctor" notice.

Rules resolve into an EffectiveRules object at plan time. plan_blocks record which rules applied, so the guardrail is visible in the demo.

9. Tech stack
Backend: FastAPI (Python). The developer prefers FastAPI, not Django.
Frontend: [DEFAULT] React + Vite, mobile-first and responsive.
Database: [DEFAULT] SQLite for the hackathon (SQLAlchemy), easy to swap to Postgres later.
LLM: [DECIDED] OpenAI. Wrap it behind a single service function so it's swappable. Use structured (JSON) output so plans can be validated programmatically.
Deployment: [DECIDED] single host. FastAPI serves the built React app from one service, so there's one deploy target and no CORS setup.
10. Data model (draft)
users: id, name, conditions[], doctor_clearance (bool), equipment[], interests[]
daily_checkins: id, user_id, date, commitments (list of time blocks), energy, symptoms_today, notes
plan_blocks: id, checkin_id, start_time, end_time, exercise, intensity, linked_interest, status (planned/done/skipped)
completions: id, block_id, outcome, reason, felt_rating
safety_rules: stored as config per condition (max intensity, max duration, blocked exercise tags, red-flag symptoms)
11. API endpoints (draft)
POST /users and PUT /users/{id}: intake/profile
POST /checkin: submit today's commitments, energy, symptoms
GET /plan/today: current day's plan with time slots
POST /plan/replan: updated availability, regenerates remaining slots only
POST /plan/blocks/{id}/complete: mark done or skipped, with optional reason and feeling
12. Core logic notes

Free-window algorithm (plain Python, make it clean and tested):

Input: day start/end, list of fixed commitments with start/end times.
Output: list of free windows, with a configurable minimum length (e.g. 5 min) and buffers around commitments.
This is a visible Technical Execution showcase, so write unit tests for it.

Plan generation pipeline:

Compute free windows
Load user conditions, safety rules, equipment, interests, recent completion history
Prompt the LLM with windows + constraints + energy + interests, requesting structured JSON
Validate against safety rules; reject or fix anything that breaks them
Save and return the plan

Re-plan: same pipeline, but only for the remaining windows of the current day, taking into account blocks already completed.

13. Demo plan

Build around one concrete persona rather than "users in general". For example: a final-year student with classes and a part-time job who is managing type 2 diabetes, or a nurse on shifts managing hypertension.

Demo script (2 to 3 minutes):

Show the problem (a busy day, a generic plan that doesn't fit)
Intake + morning check-in
Cadence builds today's plan around the day, using the user's interests
Day changes ("meeting ran long"), tap re-plan, plan adjusts
Show a safety guardrail in action (a red-flag symptom or a blocked exercise)
Close on impact: who this helps and how it can grow
14. Out of scope (don't build)
Diagnosis, medical advice, medication guidance
Wearable/device integrations
Social features, payments, complex auth beyond what the demo needs
Weekly/monthly program planning (we are deliberately daily)
15. Working conventions
Ship a working vertical slice early (check-in, plan, display), then layer on features.
Keep the LLM call isolated in one module; keep safety rules isolated in one config.
Write a README with run/build instructions (needed for the Devpost submission).
Keep commits small and the app runnable at all times, since the demo link matters.
If something is marked [OPEN], ask the developer instead of guessing.