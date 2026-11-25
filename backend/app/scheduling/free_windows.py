"""Scheduling primitives.

Pure functions over a waking day. No I/O, no framework, no database: everything
here is deterministic and unit-testable in isolation, which is what makes the
planner's time arithmetic trustworthy enough to build a product on.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import time

#: A schedule is whole-minute: seconds are floored, never rounded.
SECONDS_IGNORED = 0


class SchedulingError(ValueError):
    """Invalid input to the scheduler.

    Inherits from :class:`ValueError` so the API layer can map it to a 422
    without a special case.
    """


class InvalidDayError(SchedulingError):
    """The day bounds do not describe a usable day."""


class InvalidCommitmentError(SchedulingError):
    """A commitment ends before it starts."""


class InvalidScheduleConfigError(SchedulingError):
    """A buffer or minimum-window setting is out of range."""


def _to_minutes(moment: time) -> int:
    """Minutes since midnight, flooring seconds."""
    return moment.hour * 60 + moment.minute


def _to_time(minutes: int) -> time:
    return time(minute=minutes % 60, hour=minutes // 60)


@dataclass(frozen=True, slots=True)
class TimeWindow:
    """A contiguous stretch of free time inside the waking day."""

    start: time
    end: time

    def __post_init__(self) -> None:
        if _to_minutes(self.end) <= _to_minutes(self.start):
            raise ValueError(
                f"a time window must end after it starts, got {self.start.isoformat()} "
                f"to {self.end.isoformat()}"
            )

    @property
    def duration_minutes(self) -> int:
        return _to_minutes(self.end) - _to_minutes(self.start)


@dataclass(frozen=True, slots=True)
class Commitment:
    """A fixed part of the day: work, class, an appointment, a commute.

    ``label`` is only used in error messages so a bad entry can be identified
    without guessing which one it was.
    """

    start: time
    end: time
    label: str = ""


def compute_free_windows(
    day_start: time,
    day_end: time,
    commitments: Iterable[Commitment] = (),
    *,
    buffer_minutes: int = 0,
    min_window_minutes: int = 5,
) -> list[TimeWindow]:
    """Return the free windows of a waking day.

    A window is a stretch of the day not claimed by any commitment, after each
    commitment is padded by ``buffer_minutes`` on both sides. Windows shorter
    than ``min_window_minutes`` are dropped, because a two-minute gap is not
    something anyone can exercise in.

    The day is ``day_start`` (wake) to ``day_end`` (bedtime), which is why
    sleep never appears as available time and why midnight is not special.

    Bedtimes after midnight are not representable in a same-day model; onboarding
    maps them to 23:59, which only discards the tail of the evening.
    """
    if buffer_minutes < 0:
        raise InvalidScheduleConfigError(
            f"buffer_minutes must not be negative, got {buffer_minutes}"
        )
    if min_window_minutes <= 0:
        raise InvalidScheduleConfigError(
            f"min_window_minutes must be positive, got {min_window_minutes}"
        )

    start_minutes = _to_minutes(day_start)
    end_minutes = _to_minutes(day_end)
    if end_minutes <= start_minutes:
        raise InvalidDayError(
            f"day_end ({day_end.isoformat()}) must be after day_start ({day_start.isoformat()})"
        )

    busy = _busy_spans(commitments, start_minutes, end_minutes, buffer_minutes)
    return _free_gaps(start_minutes, end_minutes, busy, min_window_minutes)


def _busy_spans(
    commitments: Iterable[Commitment],
    day_start: int,
    day_end: int,
    buffer_minutes: int,
) -> list[tuple[int, int]]:
    """Buffered, clipped, merged busy intervals in minutes, sorted by start."""
    spans: list[tuple[int, int]] = []

    for commitment in commitments:
        commitment_start = _to_minutes(commitment.start)
        commitment_end = _to_minutes(commitment.end)

        if commitment_end < commitment_start:
            raise InvalidCommitmentError(
                f"commitment {commitment.label or 'unlabelled'!r} ends "
                f"({commitment.end.isoformat()}) before it starts "
                f"({commitment.start.isoformat()})"
            )

        # A commitment that occupies no time claims no time, buffer or not.
        if commitment_end == commitment_start:
            continue

        buffered_start = max(day_start, commitment_start - buffer_minutes)
        buffered_end = min(day_end, commitment_end + buffer_minutes)
        if buffered_end <= buffered_start:
            continue

        spans.append((buffered_start, buffered_end))

    spans.sort()

    merged: list[tuple[int, int]] = []
    for span_start, span_end in spans:
        if merged and span_start <= merged[-1][1]:
            previous_start, previous_end = merged[-1]
            merged[-1] = (previous_start, max(previous_end, span_end))
        else:
            merged.append((span_start, span_end))

    return merged


def _free_gaps(
    day_start: int,
    day_end: int,
    busy: list[tuple[int, int]],
    min_window_minutes: int,
) -> list[TimeWindow]:
    windows: list[TimeWindow] = []
    cursor = day_start

    for span_start, span_end in busy:
        if span_start - cursor >= min_window_minutes:
            windows.append(TimeWindow(_to_time(cursor), _to_time(span_start)))
        cursor = max(cursor, span_end)

    if day_end - cursor >= min_window_minutes:
        windows.append(TimeWindow(_to_time(cursor), _to_time(day_end)))

    return windows
