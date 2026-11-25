"""Safety domain types.

Nothing here decides what a user may do; it only names the vocabulary the rules
are written in. The important structural decision is that intensity has an
explicit order, because every merge is "take the most restrictive".
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum
from typing import Final


class SafetyError(ValueError):
    """Base class for unsafe or unusable safety configuration.

    Inherits from :class:`ValueError` so the API layer can map it to a 422
    without a special case.
    """


class InvalidPackError(SafetyError):
    """A condition pack is malformed or the pack set is inconsistent."""


class Intensity(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    VIGOROUS = "vigorous"


class PackKind(StrEnum):
    BASELINE = "baseline"
    CLINICAL = "clinical"
    CONSERVATIVE = "conservative"


_INTENSITY_ORDER: Final[dict[Intensity, int]] = {
    Intensity.LOW: 0,
    Intensity.MODERATE: 1,
    Intensity.VIGOROUS: 2,
}


def most_restrictive_intensity(values: Iterable[Intensity]) -> Intensity:
    """The least intense of the given intensities."""
    return min(values, key=_INTENSITY_ORDER.__getitem__)


def intensity_at_most(value: Intensity, cap: Intensity) -> bool:
    """True when ``value`` is no more intense than ``cap``."""
    return _INTENSITY_ORDER[value] <= _INTENSITY_ORDER[cap]


_WHITESPACE = re.compile(r"\s+")
_SEPARATORS = re.compile(r"[-_]+")
_DISALLOWED_IN_ID = re.compile(r"[^a-z0-9_]")


def normalize_name(value: str) -> str:
    """Fold a user- or author-supplied condition name into a lookup key.

    ``"Type 2 Diabetes"``, ``"type-2-diabetes"`` and ``"TYPE_2_DIABETES"`` all
    become ``"type 2 diabetes"``.
    """
    lowered = value.strip().lower().replace("&", " and ")
    separated = _SEPARATORS.sub(" ", lowered)
    collapsed = _WHITESPACE.sub(" ", separated)
    return collapsed.strip(" .;,")


@dataclass(frozen=True, slots=True)
class ConditionPack:
    """One authored set of limits and guidance for a condition."""

    id: str
    label: str
    kind: PackKind
    max_intensity: Intensity
    max_block_minutes: int
    min_block_minutes: int
    max_daily_minutes: int
    blocked_tags: frozenset[str]
    red_flag_symptoms: tuple[str, ...]
    sources: tuple[str, ...]
    guidance: tuple[str, ...]
    aliases: tuple[str, ...]

    @property
    def requires_doctor_clearance(self) -> bool:
        """Only the general-fitness baseline needs no clinician sign-off."""
        return self.kind is not PackKind.BASELINE


@dataclass(frozen=True, slots=True)
class EffectiveRules:
    """The merged limits that apply to one user, right now.

    Computed at plan time from the packs they declared. ``pack_ids`` and
    ``notices`` are carried so the plan can explain itself: which rules applied,
    and whether any condition fell back to conservative guidance.
    """

    pack_ids: tuple[str, ...]
    max_intensity: Intensity
    max_block_minutes: int
    min_block_minutes: int
    max_daily_minutes: int
    blocked_tags: frozenset[str]
    red_flags: tuple[str, ...]
    sources: tuple[str, ...]
    guidance: tuple[str, ...]
    requires_doctor_clearance: bool
    is_conservative: bool
    notices: tuple[str, ...]
