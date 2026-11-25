"""The plan gate and the fallback planner.

These tests describe the promise the product makes: nothing unsafe reaches a
person, and when generation fails they still get something they can do. The
property tests build real schedules with the M3 scheduler and real rule sets with
the M4 packs, so the gate is exercised against the same shapes it will see in
production rather than hand-picked examples.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import time

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.safety import (
    FallbackPlan,
    Intensity,
    PlanBlock,
    StopSignal,
    ViolationKind,
    build_fallback_plan,
    find_red_flags,
    get_registry,
    plan_is_safe,
    red_flag_stop,
    resolve_rules,
    validate_plan,
)
from app.safety.fallback import NO_WINDOW_LONG_ENOUGH_REASON, NO_WINDOW_REASON
from app.scheduling import Commitment, TimeWindow, compute_free_windows
from app.timeutil import to_time

REGISTRY = get_registry()
BASELINE = resolve_rules([])
CLINICAL_LABELS = [pack.label for pack in REGISTRY.packs if pack.kind.value == "clinical"]

TWO_WINDOWS = (TimeWindow(time(9, 0), time(11, 0)), TimeWindow(time(14, 0), time(16, 0)))


def block(
    start: time,
    end: time,
    *,
    title: str = "Gentle walk",
    intensity: Intensity = Intensity.LOW,
    tags: tuple[str, ...] = (),
) -> PlanBlock:
    return PlanBlock(
        start=start,
        end=end,
        title=title,
        intensity=intensity,
        tags=frozenset(tags),
    )


def kinds(violations: tuple) -> set[ViolationKind]:
    return {violation.kind for violation in violations}


# ------------------------------------------------------------------- accepted


def test_an_empty_plan_is_valid() -> None:
    assert validate_plan((), BASELINE, TWO_WINDOWS) == ()


def test_a_plan_inside_the_limits_is_accepted() -> None:
    plan = [
        block(time(9, 5), time(9, 25)),
        block(time(14, 30), time(14, 55)),
    ]

    assert validate_plan(plan, BASELINE, TWO_WINDOWS) == ()
    assert plan_is_safe(plan, BASELINE, TWO_WINDOWS)


def test_boundaries_are_inclusive() -> None:
    exactly_max = [block(time(9, 0), time(9, 30))]
    exactly_min = [block(time(9, 0), time(9, 5))]
    exactly_daily = [block(time(9, 0), time(9, 30)), block(time(14, 0), time(14, 30))]

    assert validate_plan(exactly_max, BASELINE, TWO_WINDOWS) == ()
    assert validate_plan(exactly_min, BASELINE, TWO_WINDOWS) == ()
    assert validate_plan(exactly_daily, BASELINE, TWO_WINDOWS) == ()


def test_touching_blocks_do_not_overlap() -> None:
    plan = [block(time(9, 0), time(9, 20)), block(time(9, 20), time(9, 40))]

    assert ViolationKind.OVERLAPPING_BLOCKS not in kinds(validate_plan(plan, BASELINE, TWO_WINDOWS))


# -------------------------------------------------------------------- rejected


def test_intensity_above_the_cap_is_rejected() -> None:
    plan = [block(time(9, 0), time(9, 20), intensity=Intensity.VIGOROUS)]

    violations = validate_plan(plan, BASELINE, TWO_WINDOWS)

    assert kinds(violations) == {ViolationKind.INTENSITY_ABOVE_CAP}
    assert violations[0].block_indices == (0,)


def test_a_block_longer_than_the_maximum_is_rejected() -> None:
    plan = [block(time(9, 0), time(9, 35))]

    assert kinds(validate_plan(plan, BASELINE, TWO_WINDOWS)) == {ViolationKind.BLOCK_TOO_LONG}


def test_a_block_shorter_than_the_minimum_is_rejected() -> None:
    plan = [block(time(9, 0), time(9, 3))]

    assert kinds(validate_plan(plan, BASELINE, TWO_WINDOWS)) == {ViolationKind.BLOCK_TOO_SHORT}


def test_a_daily_total_above_the_limit_is_rejected() -> None:
    plan = [
        block(time(9, 0), time(9, 30)),
        block(time(14, 0), time(14, 30)),
        block(time(14, 30), time(15, 0)),
    ]

    violations = validate_plan(plan, BASELINE, TWO_WINDOWS)

    assert ViolationKind.DAILY_TOTAL_EXCEEDED in kinds(violations)


def test_a_blocked_exercise_tag_is_rejected() -> None:
    diabetes = resolve_rules(["type 2 diabetes"])
    plan = [block(time(9, 0), time(9, 15), tags=("high_impact", "walking"))]

    violations = validate_plan(plan, diabetes, TWO_WINDOWS)

    assert kinds(violations) == {ViolationKind.BLOCKED_EXERCISE_TAG}
    assert "high_impact" in violations[0].message


def test_a_block_before_every_window_is_rejected() -> None:
    plan = [block(time(7, 0), time(7, 15))]

    assert kinds(validate_plan(plan, BASELINE, TWO_WINDOWS)) == {ViolationKind.OUTSIDE_FREE_WINDOW}


def test_a_block_straddling_the_end_of_a_window_is_rejected() -> None:
    plan = [block(time(10, 50), time(11, 10))]

    assert kinds(validate_plan(plan, BASELINE, TWO_WINDOWS)) == {ViolationKind.OUTSIDE_FREE_WINDOW}


def test_a_block_may_not_span_two_adjacent_windows() -> None:
    windows = (TimeWindow(time(9, 0), time(11, 0)), TimeWindow(time(11, 0), time(13, 0)))
    plan = [block(time(10, 50), time(11, 10))]

    assert ViolationKind.OUTSIDE_FREE_WINDOW in kinds(validate_plan(plan, BASELINE, windows))


def test_overlapping_blocks_are_rejected_and_both_are_named() -> None:
    plan = [block(time(9, 0), time(9, 20)), block(time(9, 10), time(9, 30))]

    violations = validate_plan(plan, BASELINE, TWO_WINDOWS)

    assert kinds(violations) == {ViolationKind.OVERLAPPING_BLOCKS}
    assert set(violations[0].block_indices) == {0, 1}


def test_overlaps_are_found_between_non_neighbours() -> None:
    plan = [
        block(time(9, 0), time(9, 30)),
        block(time(9, 31), time(9, 35)),
        block(time(9, 5), time(9, 10)),
    ]

    violations = validate_plan(plan, BASELINE, TWO_WINDOWS)
    overlapping = [v for v in violations if v.kind is ViolationKind.OVERLAPPING_BLOCKS]

    assert {frozenset(v.block_indices) for v in overlapping} == {frozenset({0, 2})}


def test_a_zero_length_block_is_rejected_rather_than_crashing() -> None:
    plan = [block(time(9, 0), time(9, 0))]

    assert ViolationKind.BLOCK_TOO_SHORT in kinds(validate_plan(plan, BASELINE, TWO_WINDOWS))


def test_a_backwards_block_is_rejected_rather_than_crashing() -> None:
    plan = [block(time(9, 30), time(9, 0))]

    assert ViolationKind.BLOCK_TOO_SHORT in kinds(validate_plan(plan, BASELINE, TWO_WINDOWS))


def test_every_problem_is_reported_not_just_the_first() -> None:
    plan = [
        block(time(9, 0), time(9, 20), intensity=Intensity.VIGOROUS),
        block(time(7, 0), time(7, 20)),
        block(time(14, 0), time(14, 30)),
        block(time(14, 15), time(14, 45)),
    ]

    found = kinds(validate_plan(plan, BASELINE, TWO_WINDOWS))

    assert {
        ViolationKind.INTENSITY_ABOVE_CAP,
        ViolationKind.OUTSIDE_FREE_WINDOW,
        ViolationKind.OVERLAPPING_BLOCKS,
        ViolationKind.DAILY_TOTAL_EXCEEDED,
    } <= found


# -------------------------------------------------------------------- fallback


def test_the_fallback_plan_fits_inside_free_windows() -> None:
    plan = build_fallback_plan(TWO_WINDOWS, BASELINE)

    assert plan.blocks
    assert plan.reason is None
    assert validate_plan(plan.blocks, BASELINE, TWO_WINDOWS) == ()


def test_the_fallback_plan_respects_the_block_length_limits() -> None:
    plan = build_fallback_plan(TWO_WINDOWS, BASELINE)

    for planned in plan.blocks:
        assert BASELINE.min_block_minutes <= planned.duration_minutes
        assert planned.duration_minutes <= BASELINE.max_block_minutes


def test_the_fallback_plan_never_exceeds_the_daily_limit() -> None:
    windows = tuple(
        TimeWindow(to_time(8 * 60 + i * 60), to_time(9 * 60 + i * 60)) for i in range(6)
    )
    rules = resolve_rules(["hypertension"])

    plan = build_fallback_plan(windows, rules)

    total = sum(planned.duration_minutes for planned in plan.blocks)
    assert total == rules.max_daily_minutes
    assert total <= rules.max_daily_minutes


def test_the_fallback_truncates_rather_than_going_below_the_minimum() -> None:
    windows = tuple(
        TimeWindow(to_time(8 * 60 + i * 60), to_time(9 * 60 + i * 60)) for i in range(6)
    )
    rules = resolve_rules(["hypertension"])

    plan = build_fallback_plan(windows, rules)

    assert all(planned.duration_minutes >= rules.min_block_minutes for planned in plan.blocks)
    assert sum(planned.duration_minutes for planned in plan.blocks) <= rules.max_daily_minutes


@pytest.mark.parametrize("pack", REGISTRY.packs, ids=lambda pack: pack.id)
def test_the_fallback_is_valid_for_every_shipped_pack(pack) -> None:
    rules = resolve_rules([pack.label])
    windows = (TimeWindow(time(8, 0), time(12, 0)), TimeWindow(time(13, 0), time(17, 0)))

    plan = build_fallback_plan(windows, rules)

    assert plan.blocks
    assert validate_plan(plan.blocks, rules, windows) == ()


def test_the_fallback_never_emits_a_blocked_tag() -> None:
    rules = replace(
        BASELINE,
        blocked_tags=frozenset({"low_impact", "mobility", "walking"}),
    )

    plan = build_fallback_plan(TWO_WINDOWS, rules)

    assert plan.blocks
    assert all(not (planned.tags & rules.blocked_tags) for planned in plan.blocks)
    assert plan.blocks[0].tags == frozenset()
    assert plan.blocks[0].title == "Gentle movement"


def test_the_fallback_is_deterministic() -> None:
    first = build_fallback_plan(TWO_WINDOWS, BASELINE)
    second = build_fallback_plan(tuple(reversed(TWO_WINDOWS)), BASELINE)

    assert first == second


def test_no_windows_yields_an_explicit_empty_result() -> None:
    plan = build_fallback_plan((), BASELINE)

    assert plan.blocks == ()
    assert plan.reason == NO_WINDOW_REASON


def test_windows_too_short_for_a_session_yield_an_explicit_empty_result() -> None:
    windows = (TimeWindow(time(9, 0), time(9, 3)),)

    plan = build_fallback_plan(windows, BASELINE)

    assert plan.blocks == ()
    assert plan.reason == NO_WINDOW_LONG_ENOUGH_REASON


def test_the_fallback_plan_is_ordered() -> None:
    plan = build_fallback_plan(TWO_WINDOWS, BASELINE)

    assert [planned.start for planned in plan.blocks] == sorted(
        planned.start for planned in plan.blocks
    )


# ------------------------------------------------------------------ red flags


def test_a_red_flag_stops_the_day() -> None:
    signal = red_flag_stop(["chest pain, pressure or tightness"], BASELINE)

    assert isinstance(signal, StopSignal)
    assert signal.matched == ("chest pain, pressure or tightness",)
    assert "medical help" in signal.guidance


def test_a_short_honest_report_still_stops_the_day() -> None:
    assert red_flag_stop(["chest pain"], BASELINE) is not None
    assert red_flag_stop(["shortness of breath"], BASELINE) is not None


def test_a_sentence_containing_a_red_flag_stops_the_day() -> None:
    signal = red_flag_stop(["felt lightheaded on the stairs after lunch"], BASELINE)

    assert signal is not None
    assert signal.matched


def test_symptom_matching_ignores_case_and_spacing() -> None:
    assert red_flag_stop(["  CHEST PAIN  "], BASELINE) is not None


def test_an_unrelated_symptom_does_not_stop_the_day() -> None:
    assert red_flag_stop(["stiff knees"], BASELINE) is None
    assert red_flag_stop([], BASELINE) is None


def test_a_bare_body_part_does_not_stop_the_day() -> None:
    # Matching "chest" alone would stop every session that mentions the chest.
    assert red_flag_stop(["chest"], BASELINE) is None


def test_ordinary_aches_do_not_stop_the_day() -> None:
    assert red_flag_stop(["knee pain"], BASELINE) is None
    assert red_flag_stop(["sore after the walk"], BASELINE) is None


def test_a_different_word_form_of_a_red_flag_still_stops_the_day() -> None:
    assert red_flag_stop(["lightheaded"], BASELINE) is not None


def test_every_matching_red_flag_is_reported() -> None:
    matched = find_red_flags(["chest pain", "sudden dizziness or lightheadedness"], BASELINE)

    assert len(matched) == 2


def test_condition_specific_red_flags_apply_too() -> None:
    diabetes = resolve_rules(["type 2 diabetes"])

    signal = red_flag_stop(
        ["shakiness, sweating or confusion that could be low blood sugar"], diabetes
    )

    assert signal is not None


# ----------------------------------------------------------------- properties


@st.composite
def schedules(draw: st.DrawFn):
    day_start = draw(st.integers(min_value=0, max_value=1200))
    day_end = draw(st.integers(min_value=day_start + 1, max_value=1439))

    spans = []
    for _ in range(draw(st.integers(min_value=0, max_value=5))):
        first = draw(st.integers(min_value=0, max_value=1439))
        second = draw(st.integers(min_value=0, max_value=1439))
        spans.append((min(first, second), max(first, second)))

    return (
        day_start,
        day_end,
        spans,
        draw(st.integers(min_value=0, max_value=30)),
        draw(st.integers(min_value=1, max_value=30)),
        draw(st.lists(st.sampled_from(CLINICAL_LABELS), max_size=3)),
    )


@given(schedules())
@settings(max_examples=250, deadline=None)
def test_the_fallback_is_always_valid_for_real_schedules(case) -> None:
    day_start, day_end, spans, buffer_minutes, min_window_minutes, conditions = case

    windows = compute_free_windows(
        to_time(day_start),
        to_time(day_end),
        [Commitment(to_time(start), to_time(end)) for start, end in spans],
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )
    rules = resolve_rules(conditions)
    plan = build_fallback_plan(windows, rules)

    assert validate_plan(plan.blocks, rules, windows) == ()
    assert sum(planned.duration_minutes for planned in plan.blocks) <= rules.max_daily_minutes


@given(schedules())
@settings(max_examples=200, deadline=None)
def test_the_fallback_uses_a_window_when_one_is_usable(case) -> None:
    day_start, day_end, spans, buffer_minutes, min_window_minutes, conditions = case

    windows = compute_free_windows(
        to_time(day_start),
        to_time(day_end),
        [Commitment(to_time(start), to_time(end)) for start, end in spans],
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )
    rules = resolve_rules(conditions)
    plan = build_fallback_plan(windows, rules)

    if any(window.duration_minutes >= rules.min_block_minutes for window in windows):
        assert plan.blocks
        assert plan.reason is None


@given(schedules())
@settings(max_examples=200, deadline=None)
def test_the_fallback_never_emits_a_blocked_tag_for_any_condition_mix(case) -> None:
    _day_start, _day_end, _spans, _buffer, _min_window, conditions = case
    rules = resolve_rules(conditions)

    plan = build_fallback_plan(TWO_WINDOWS, rules)

    assert all(not (planned.tags & rules.blocked_tags) for planned in plan.blocks)


def test_fallback_plan_type_is_exported_for_callers() -> None:
    assert isinstance(build_fallback_plan(TWO_WINDOWS, BASELINE), FallbackPlan)
