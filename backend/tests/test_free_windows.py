"""The free-window scheduler, tested against intended behaviour.

Every test here describes something a user would notice: a session suggested
during sleep, a two-minute gap treated as usable, a busy day producing a plan it
cannot honour.

Expectations are derived from the product brief, not from the implementation.
The property tests compare the scheduler against an independent brute-force
oracle that marks each minute of the day as free or busy, so agreement is
meaningful rather than circular.
"""

from __future__ import annotations

from datetime import time
from itertools import pairwise

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.scheduling import (
    Commitment,
    InvalidCommitmentError,
    InvalidDayError,
    InvalidScheduleConfigError,
    TimeWindow,
    compute_free_windows,
)

WAKE = time(6, 30)
BEDTIME = time(22, 15)


def at(hour: int, minute: int) -> time:
    return time(hour, minute)


def span(window: TimeWindow) -> tuple[time, time]:
    return (window.start, window.end)


# --------------------------------------------------------------------- basics


def test_a_day_with_no_commitments_is_one_window() -> None:
    windows = compute_free_windows(WAKE, BEDTIME)

    assert [span(window) for window in windows] == [(WAKE, BEDTIME)]
    assert windows[0].duration_minutes == 945


def test_windows_are_returned_in_time_order() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [
            Commitment(at(17, 0), at(18, 0), "gym"),
            Commitment(at(9, 0), at(10, 0), "class"),
            Commitment(at(12, 0), at(12, 30), "lunch"),
        ],
    )

    assert [span(window) for window in windows] == [
        (WAKE, at(9, 0)),
        (at(10, 0), at(12, 0)),
        (at(12, 30), at(17, 0)),
        (at(18, 0), BEDTIME),
    ]


# -------------------------------------------------------------------- merging


def test_adjacent_commitments_merge_without_a_zero_length_window() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(9, 0), at(10, 0)), Commitment(at(10, 0), at(11, 0))],
    )

    assert [span(window) for window in windows] == [(WAKE, at(9, 0)), (at(11, 0), BEDTIME)]


def test_overlapping_commitments_merge_into_one_busy_span() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(9, 0), at(11, 0)), Commitment(at(10, 0), at(12, 0))],
    )

    assert [span(window) for window in windows] == [(WAKE, at(9, 0)), (at(12, 0), BEDTIME)]


def test_duplicate_commitments_change_nothing() -> None:
    single = compute_free_windows(WAKE, BEDTIME, [Commitment(at(9, 0), at(10, 0))])
    duplicated = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(9, 0), at(10, 0)), Commitment(at(9, 0), at(10, 0))],
    )

    assert duplicated == single


def test_input_order_does_not_matter() -> None:
    commitments = [
        Commitment(at(9, 0), at(10, 0), "a"),
        Commitment(at(13, 0), at(14, 0), "b"),
        Commitment(at(19, 0), at(20, 0), "c"),
    ]

    forwards = compute_free_windows(WAKE, BEDTIME, commitments)
    backwards = compute_free_windows(WAKE, BEDTIME, list(reversed(commitments)))

    assert forwards == backwards


# ------------------------------------------------------------------- buffering


def test_buffer_pads_both_sides_of_a_commitment() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(9, 0), at(10, 0))],
        buffer_minutes=15,
    )

    assert [span(window) for window in windows] == [(WAKE, at(8, 45)), (at(10, 15), BEDTIME)]


def test_commitments_separated_by_less_than_the_buffer_merge() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(9, 0), at(10, 0)), Commitment(at(10, 3), at(11, 0))],
        buffer_minutes=5,
    )

    assert [span(window) for window in windows] == [(WAKE, at(8, 55)), (at(11, 5), BEDTIME)]
    assert not any(window.start == at(10, 0) for window in windows)


def test_a_buffer_larger_than_the_day_leaves_no_windows() -> None:
    windows = compute_free_windows(
        WAKE, BEDTIME, [Commitment(at(12, 0), at(12, 30))], buffer_minutes=1440
    )

    assert windows == []


# -------------------------------------------------------------------- clipping


def test_a_commitment_reaching_into_the_day_is_clipped() -> None:
    windows = compute_free_windows(WAKE, BEDTIME, [Commitment(at(0, 0), at(8, 0))])

    assert [span(window) for window in windows] == [(at(8, 0), BEDTIME)]


def test_a_commitment_entirely_outside_the_day_is_ignored() -> None:
    windows = compute_free_windows(WAKE, BEDTIME, [Commitment(at(0, 0), at(5, 0))])

    assert [span(window) for window in windows] == [(WAKE, BEDTIME)]


def test_commitments_covering_the_whole_day_leave_no_windows() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(0, 0), at(12, 0)), Commitment(at(12, 0), at(23, 59))],
    )

    assert windows == []


def test_windows_never_extend_outside_the_waking_day() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(0, 0), at(7, 0)), Commitment(at(22, 0), at(23, 59))],
    )

    assert all(window.start >= WAKE for window in windows)
    assert all(window.end <= BEDTIME for window in windows)


# ------------------------------------------------------------------ zero-length


@pytest.mark.parametrize("buffer_minutes", [0, 10])
def test_a_zero_length_commitment_does_not_split_a_window(buffer_minutes: int) -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(12, 0), at(12, 0), "typo")],
        buffer_minutes=buffer_minutes,
    )

    assert [span(window) for window in windows] == [(WAKE, BEDTIME)]


# -------------------------------------------------------------- minimum window


def test_a_window_exactly_at_the_minimum_is_kept() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(6, 35), at(12, 0))],
        min_window_minutes=5,
    )

    assert span(windows[0]) == (WAKE, at(6, 35))
    assert windows[0].duration_minutes == 5


def test_a_window_one_minute_short_is_dropped() -> None:
    windows = compute_free_windows(
        WAKE,
        BEDTIME,
        [Commitment(at(6, 34), at(12, 0))],
        min_window_minutes=5,
    )

    assert at(6, 30) not in [window.start for window in windows]


def test_a_day_shorter_than_the_minimum_has_no_windows() -> None:
    windows = compute_free_windows(at(7, 0), at(7, 30), min_window_minutes=60)

    assert windows == []


# ----------------------------------------------------------------- precedence


def test_a_commitment_may_start_at_wake_time() -> None:
    windows = compute_free_windows(WAKE, BEDTIME, [Commitment(WAKE, at(8, 0))])

    assert [span(window) for window in windows] == [(at(8, 0), BEDTIME)]


def test_a_commitment_may_end_at_bedtime() -> None:
    windows = compute_free_windows(WAKE, BEDTIME, [Commitment(at(21, 0), BEDTIME)])

    assert [span(window) for window in windows] == [(WAKE, at(21, 0))]


# ---------------------------------------------------------------- minute floor


def test_seconds_are_floored_so_windows_stay_minute_aligned() -> None:
    windows = compute_free_windows(
        time(6, 30, 45),
        time(22, 15, 59),
        [Commitment(time(9, 0, 30), time(9, 30, 45))],
    )

    assert [span(window) for window in windows] == [(WAKE, at(9, 0)), (at(9, 30), at(22, 15))]
    assert all(window.start.second == 0 and window.end.second == 0 for window in windows)


# --------------------------------------------------------------------- invalid


@pytest.mark.parametrize("day_end", [at(6, 30), at(6, 0), at(0, 0)])
def test_a_bedtime_not_after_wake_time_is_rejected(day_end: time) -> None:
    with pytest.raises(InvalidDayError) as excinfo:
        compute_free_windows(WAKE, day_end)

    assert "day_end" in str(excinfo.value)


def test_a_negative_buffer_is_rejected() -> None:
    with pytest.raises(InvalidScheduleConfigError) as excinfo:
        compute_free_windows(WAKE, BEDTIME, buffer_minutes=-1)

    assert "buffer_minutes" in str(excinfo.value)


@pytest.mark.parametrize("min_window_minutes", [0, -5])
def test_a_non_positive_minimum_window_is_rejected(min_window_minutes: int) -> None:
    with pytest.raises(InvalidScheduleConfigError) as excinfo:
        compute_free_windows(WAKE, BEDTIME, min_window_minutes=min_window_minutes)

    assert "min_window_minutes" in str(excinfo.value)


def test_an_inverted_commitment_is_rejected_and_named() -> None:
    with pytest.raises(InvalidCommitmentError) as excinfo:
        compute_free_windows(WAKE, BEDTIME, [Commitment(at(10, 0), at(9, 0), "ward round")])

    assert "ward round" in str(excinfo.value)


def test_an_unlabelled_inverted_commitment_is_still_identified() -> None:
    with pytest.raises(InvalidCommitmentError) as excinfo:
        compute_free_windows(WAKE, BEDTIME, [Commitment(at(10, 0), at(9, 0))])

    assert "unlabelled" in str(excinfo.value)


def test_an_invalid_window_cannot_be_constructed() -> None:
    with pytest.raises(ValueError):
        TimeWindow(at(10, 0), at(10, 0))
    with pytest.raises(ValueError):
        TimeWindow(at(10, 0), at(9, 0))


# ------------------------------------------------------------------- properties


def minutes_since_midnight(moment: time) -> int:
    return moment.hour * 60 + moment.minute


def brute_force_windows(
    day_start: int,
    day_end: int,
    spans: list[tuple[int, int]],
    buffer_minutes: int,
    min_window_minutes: int,
) -> list[tuple[int, int]]:
    """An independent oracle: mark every minute of the day free or busy."""
    busy = [False] * (24 * 60)

    for commitment_start, commitment_end in spans:
        if commitment_end <= commitment_start:
            continue
        padded_start = max(day_start, commitment_start - buffer_minutes)
        padded_end = min(day_end, commitment_end + buffer_minutes)
        for minute in range(padded_start, padded_end):
            busy[minute] = True

    windows: list[tuple[int, int]] = []
    minute = day_start
    while minute < day_end:
        if busy[minute]:
            minute += 1
            continue
        start = minute
        while minute < day_end and not busy[minute]:
            minute += 1
        if minute - start >= min_window_minutes:
            windows.append((start, minute))

    return windows


@st.composite
def waking_days(draw: st.DrawFn) -> tuple[int, int, list[tuple[int, int]], int, int]:
    day_start = draw(st.integers(min_value=0, max_value=1438))
    day_end = draw(st.integers(min_value=day_start + 1, max_value=1439))

    spans = []
    for _ in range(draw(st.integers(min_value=0, max_value=6))):
        first = draw(st.integers(min_value=0, max_value=1439))
        second = draw(st.integers(min_value=0, max_value=1439))
        spans.append((min(first, second), max(first, second)))

    return (
        day_start,
        day_end,
        spans,
        draw(st.integers(min_value=0, max_value=120)),
        draw(st.integers(min_value=1, max_value=90)),
    )


@given(waking_days())
@settings(max_examples=300, deadline=None)
def test_matches_an_independent_minute_by_minute_oracle(
    case: tuple[int, int, list[tuple[int, int]], int, int],
) -> None:
    day_start, day_end, spans, buffer_minutes, min_window_minutes = case

    commitments = [
        Commitment(minutes_to_time(start), minutes_to_time(end), f"c{index}")
        for index, (start, end) in enumerate(spans)
    ]

    windows = compute_free_windows(
        minutes_to_time(day_start),
        minutes_to_time(day_end),
        commitments,
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )

    produced = [(minutes_since_midnight(w.start), minutes_since_midnight(w.end)) for w in windows]
    expected = brute_force_windows(day_start, day_end, spans, buffer_minutes, min_window_minutes)

    assert produced == expected


@given(waking_days())
@settings(max_examples=250, deadline=None)
def test_windows_are_ordered_disjoint_and_inside_the_day(
    case: tuple[int, int, list[tuple[int, int]], int, int],
) -> None:
    day_start, day_end, spans, buffer_minutes, min_window_minutes = case

    commitments = [
        Commitment(minutes_to_time(start), minutes_to_time(end), f"c{index}")
        for index, (start, end) in enumerate(spans)
    ]

    windows = compute_free_windows(
        minutes_to_time(day_start),
        minutes_to_time(day_end),
        commitments,
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )

    for previous, following in pairwise(windows):
        assert previous.end <= following.start

    for window in windows:
        assert minutes_since_midnight(window.start) >= day_start
        assert minutes_since_midnight(window.end) <= day_end
        assert window.duration_minutes >= min_window_minutes


@given(waking_days())
@settings(max_examples=250, deadline=None)
def test_result_is_independent_of_commitment_order(
    case: tuple[int, int, list[tuple[int, int]], int, int],
) -> None:
    day_start, day_end, spans, buffer_minutes, min_window_minutes = case

    commitments = [
        Commitment(minutes_to_time(start), minutes_to_time(end), f"c{index}")
        for index, (start, end) in enumerate(spans)
    ]

    forwards = compute_free_windows(
        minutes_to_time(day_start),
        minutes_to_time(day_end),
        commitments,
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )
    backwards = compute_free_windows(
        minutes_to_time(day_start),
        minutes_to_time(day_end),
        list(reversed(commitments)),
        buffer_minutes=buffer_minutes,
        min_window_minutes=min_window_minutes,
    )

    assert forwards == backwards


def minutes_to_time(minutes: int) -> time:
    return time(hour=minutes // 60, minute=minutes % 60)
