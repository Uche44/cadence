"""A plan that is safe by construction.

Used when the model's plan breaks a rule, times out, or returns something
unparseable. It is intentionally unimaginative: short gentle blocks at the start
of each free window, until the daily allowance runs out.

The important property is not that it is good, but that it cannot be unsafe. It
uses the lowest intensity, tags it has already checked against the blocked list,
and never exceeds a limit. A smaller honest plan beats an exciting broken one.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.safety.models import EffectiveRules, Intensity
from app.safety.validation import PlanBlock
from app.scheduling.free_windows import TimeWindow
from app.timeutil import to_minutes, to_time

#: Default length for a gentle fallback block, before the pack's caps apply.
PREFERRED_BLOCK_MINUTES = 10

#: Descriptive tags for fallback blocks. Filtered against the pack's blocked
#: list, so a pack that blocks walking simply gets untagged blocks instead.
CANDIDATE_TAGS = ("low_impact", "mobility", "walking")

NO_WINDOW_REASON = "There is no free window left today for a safe session."
NO_WINDOW_LONG_ENOUGH_REASON = "Today's free windows are shorter than the minimum safe session."


@dataclass(frozen=True, slots=True)
class FallbackPlan:
    blocks: tuple[PlanBlock, ...]
    reason: str | None = None


def build_fallback_plan(
    windows: Sequence[TimeWindow],
    rules: EffectiveRules,
    *,
    preferred_block_minutes: int = PREFERRED_BLOCK_MINUTES,
) -> FallbackPlan:
    """Build a deterministic, always-valid plan from the free windows."""
    if not windows:
        return FallbackPlan(blocks=(), reason=NO_WINDOW_REASON)

    block_length = max(
        rules.min_block_minutes,
        min(preferred_block_minutes, rules.max_block_minutes),
    )

    allowed_tags = frozenset(CANDIDATE_TAGS) - rules.blocked_tags
    title = _title_for(allowed_tags)

    remaining_minutes = rules.max_daily_minutes
    blocks: list[PlanBlock] = []

    for window in sorted(windows, key=lambda window: to_minutes(window.start)):
        if remaining_minutes < rules.min_block_minutes:
            break

        length = min(block_length, window.duration_minutes, remaining_minutes)
        if length < rules.min_block_minutes:
            continue

        start = to_minutes(window.start)
        blocks.append(
            PlanBlock(
                start=to_time(start),
                end=to_time(start + length),
                title=title,
                intensity=Intensity.LOW,
                tags=allowed_tags,
            )
        )
        remaining_minutes -= length

    if not blocks:
        return FallbackPlan(blocks=(), reason=NO_WINDOW_LONG_ENOUGH_REASON)

    return FallbackPlan(blocks=tuple(blocks))


def _title_for(allowed_tags: frozenset[str]) -> str:
    if "walking" in allowed_tags:
        return "Gentle walk"
    if "mobility" in allowed_tags:
        return "Gentle mobility"
    return "Gentle movement"
