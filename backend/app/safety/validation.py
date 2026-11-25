"""The gate every plan passes through.

Two responsibilities, both deliberately dull:

1. Reject a candidate plan that breaks any authored limit, reporting every
   problem rather than the first.
2. Stop entirely when the user reports a red-flag symptom.

Nothing here generates anything. The LLM produces the personalisation; this
module decides whether it is allowed to reach a person.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass, field
from datetime import time
from enum import StrEnum

from app.safety.models import EffectiveRules, Intensity, intensity_at_most, normalize_name
from app.scheduling.free_windows import TimeWindow
from app.timeutil import to_minutes

STOP_GUIDANCE = (
    "Stop for today. If these symptoms are severe, or do not settle within a few "
    "minutes, seek medical help."
)

#: A reported symptom must share at least this much text with a red-flag clause
#: before it counts as a match. Stops a bare "chest" from matching everything.
MINIMUM_CLAUSE_MATCH = 4

#: A shorter report counts as a match when it is this long and sits inside a
#: clause, so "shortness of breath" stops the day but "chest" does not.
MINIMUM_FRAGMENT_MATCH = 8

#: Distinctive words merge across word forms ("lightheaded" against
#: "lightheadedness") but ordinary short words do not, so "knee pain" stays
#: a normal report rather than a medical alarm.
MINIMUM_FRAGMENT_WORD = 6

_WORDS = re.compile(r"[a-z]+")
_ORDINARY_WORDS = frozenset(
    {
        "after",
        "before",
        "could",
        "during",
        "feeling",
        "severe",
        "sudden",
        "while",
        "with",
    }
)


@dataclass(frozen=True, slots=True)
class PlanBlock:
    """A candidate exercise block, before anyone has vouched for it.

    Deliberately permissive: an end at or before the start does not raise here,
    because this type also carries untrusted model output. The validator reports
    it as a violation instead, which keeps the gate total rather than partial.
    """

    start: time
    end: time
    title: str
    intensity: Intensity
    tags: frozenset[str] = field(default_factory=frozenset)
    linked_interest: str | None = None

    @property
    def duration_minutes(self) -> int:
        return to_minutes(self.end) - to_minutes(self.start)


class ViolationKind(StrEnum):
    INTENSITY_ABOVE_CAP = "intensity_above_cap"
    BLOCK_TOO_LONG = "block_too_long"
    BLOCK_TOO_SHORT = "block_too_short"
    DAILY_TOTAL_EXCEEDED = "daily_total_exceeded"
    BLOCKED_EXERCISE_TAG = "blocked_exercise_tag"
    OUTSIDE_FREE_WINDOW = "outside_free_window"
    OVERLAPPING_BLOCKS = "overlapping_blocks"


@dataclass(frozen=True, slots=True)
class Violation:
    kind: ViolationKind
    message: str
    block_indices: tuple[int, ...] = ()


@dataclass(frozen=True, slots=True)
class StopSignal:
    """The day is stopped. No plan is generated, validated, or shown."""

    matched: tuple[str, ...]
    guidance: str = STOP_GUIDANCE


def validate_plan(
    blocks: Sequence[PlanBlock],
    rules: EffectiveRules,
    windows: Sequence[TimeWindow],
) -> tuple[Violation, ...]:
    """Every reason this plan must not reach the user, in a stable order."""
    violations: list[Violation] = []

    for index, block in enumerate(blocks):
        violations.extend(_block_violations(index, block, rules, windows))

    violations.extend(_overlap_violations(blocks))

    daily_total = sum(block.duration_minutes for block in blocks if block.duration_minutes > 0)
    if daily_total > rules.max_daily_minutes:
        violations.append(
            Violation(
                ViolationKind.DAILY_TOTAL_EXCEEDED,
                f"the plan totals {daily_total} minutes, above the "
                f"{rules.max_daily_minutes}-minute daily limit",
            )
        )

    return tuple(violations)


def plan_is_safe(
    blocks: Sequence[PlanBlock],
    rules: EffectiveRules,
    windows: Sequence[TimeWindow],
) -> bool:
    return not validate_plan(blocks, rules, windows)


def _block_violations(
    index: int,
    block: PlanBlock,
    rules: EffectiveRules,
    windows: Sequence[TimeWindow],
) -> list[Violation]:
    violations: list[Violation] = []
    duration = block.duration_minutes
    where = f"block {index} ({block.title!r})"

    if not intensity_at_most(block.intensity, rules.max_intensity):
        violations.append(
            Violation(
                ViolationKind.INTENSITY_ABOVE_CAP,
                f"{where} is {block.intensity.value} intensity, above the "
                f"{rules.max_intensity.value} cap",
                (index,),
            )
        )

    if duration < rules.min_block_minutes:
        violations.append(
            Violation(
                ViolationKind.BLOCK_TOO_SHORT,
                f"{where} lasts {duration} minutes, below the "
                f"{rules.min_block_minutes}-minute minimum",
                (index,),
            )
        )

    if duration > rules.max_block_minutes:
        violations.append(
            Violation(
                ViolationKind.BLOCK_TOO_LONG,
                f"{where} lasts {duration} minutes, above the "
                f"{rules.max_block_minutes}-minute maximum",
                (index,),
            )
        )

    blocked = block.tags & rules.blocked_tags
    if blocked:
        violations.append(
            Violation(
                ViolationKind.BLOCKED_EXERCISE_TAG,
                f"{where} includes blocked exercise: {', '.join(sorted(blocked))}",
                (index,),
            )
        )

    if not _inside_any_window(block, windows):
        violations.append(
            Violation(
                ViolationKind.OUTSIDE_FREE_WINDOW,
                f"{where} at {block.start.isoformat()} does not fit inside a free window",
                (index,),
            )
        )

    return violations


def _inside_any_window(block: PlanBlock, windows: Sequence[TimeWindow]) -> bool:
    block_start = to_minutes(block.start)
    block_end = to_minutes(block.end)

    return any(
        to_minutes(window.start) <= block_start and block_end <= to_minutes(window.end)
        for window in windows
    )


def _overlap_violations(blocks: Sequence[PlanBlock]) -> list[Violation]:
    """Report every overlapping pair, not just neighbouring ones."""
    timed = [
        (to_minutes(block.start), to_minutes(block.end), index)
        for index, block in enumerate(blocks)
        if block.duration_minutes > 0
    ]

    violations: list[Violation] = []
    for position, (start, end, index) in enumerate(timed):
        for other_start, _other_end, other_index in timed[position + 1 :]:
            if other_start < end and start < _other_end:
                violations.append(
                    Violation(
                        ViolationKind.OVERLAPPING_BLOCKS,
                        f"block {index} and block {other_index} overlap in time",
                        (index, other_index),
                    )
                )
    return violations


def _clauses(red_flag: str) -> tuple[str, ...]:
    """The separable parts of a red-flag phrase.

    ``"chest pain, pressure or tightness"`` yields ``("chest pain",
    "pressure or tightness")`` so an honest short report like ``"chest pain"``
    still stops the day.
    """
    parts = [part.strip() for part in red_flag.split(",")]
    clauses: list[str] = []
    for part in parts:
        clauses.append(part)
        if " or " in part:
            clauses.extend(piece.strip() for piece in part.split(" or "))
    return tuple(clause for clause in (normalize_name(c) for c in clauses) if clause)


def find_red_flags(reported: Iterable[str], rules: EffectiveRules) -> tuple[str, ...]:
    """Which of the user's reported symptoms match a red flag."""
    reported_names = [name for name in (normalize_name(item) for item in reported) if name]
    matched: list[str] = []

    for red_flag in rules.red_flags:
        flag = normalize_name(red_flag)
        clauses = [clause for clause in _clauses(red_flag) if len(clause) >= MINIMUM_CLAUSE_MATCH]
        flag_words = _distinctive_words(flag)
        if any(_matches(name, flag, clauses, flag_words) for name in reported_names):
            matched.append(red_flag)

    return tuple(matched)


def _distinctive_words(text: str) -> tuple[str, ...]:
    return tuple(
        word
        for word in _WORDS.findall(text)
        if len(word) >= MINIMUM_FRAGMENT_WORD and word not in _ORDINARY_WORDS
    )


def _matches(
    name: str,
    flag: str,
    clauses: Sequence[str],
    flag_words: Sequence[str],
) -> bool:
    if name == flag or flag in name:
        return True
    if any(clause in name for clause in clauses):
        return True
    if any(len(name) >= MINIMUM_FRAGMENT_MATCH and name in clause for clause in clauses):
        return True

    # Word-form tolerance: "lightheaded" should catch "lightheadedness".
    return any(
        word.startswith(other) or other.startswith(word)
        for word in _distinctive_words(name)
        for other in flag_words
    )


def red_flag_stop(reported: Iterable[str], rules: EffectiveRules) -> StopSignal | None:
    """Return a stop signal when anything reported is a red flag."""
    matched = find_red_flags(reported, rules)
    if not matched:
        return None
    return StopSignal(matched=matched)
