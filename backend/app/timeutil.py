"""Minute-resolution time helpers.

One place converts between ``time`` and minutes since midnight, so every module
agrees on how a day is measured. Seconds are floored: a schedule is always
whole-minute, never sub-minute.
"""

from __future__ import annotations

from datetime import time


def to_minutes(moment: time) -> int:
    """Minutes since midnight for ``moment``, flooring seconds."""
    return moment.hour * 60 + moment.minute


def to_time(minutes: int) -> time:
    """The ``time`` at ``minutes`` past midnight."""
    return time(hour=minutes // 60, minute=minutes % 60)
