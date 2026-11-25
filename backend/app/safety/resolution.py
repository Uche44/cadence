"""Resolving declared conditions into one set of limits.

The rule is arithmetic, not judgement: take the most restrictive value for every
field. A user with two conditions gets the intersection of both, and a user we
have no rules for gets conservative limits rather than a default fitness plan.
"""

from __future__ import annotations

from collections.abc import Iterable

from app.safety.models import (
    ConditionPack,
    EffectiveRules,
    most_restrictive_intensity,
    normalize_name,
)
from app.safety.registry import PackRegistry, get_registry

UNKNOWN_CONDITION_NOTICE = (
    "No condition-specific rules are authored for {name!r} yet, so conservative "
    "limits apply. Please confirm with your doctor before starting."
)


def _dedupe(values: Iterable[str]) -> tuple[str, ...]:
    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            ordered.append(value)
    return tuple(ordered)


def _normalized_conditions(conditions: Iterable[str]) -> tuple[str, ...]:
    keys = (normalize_name(condition) for condition in conditions if condition.strip())
    return tuple(key for key in _dedupe(keys) if key)


def _dedupe_packs(packs: Iterable[ConditionPack]) -> tuple[ConditionPack, ...]:
    return tuple({pack.id: pack for pack in packs}.values())


def resolve_rules(
    conditions: Iterable[str], *, registry: PackRegistry | None = None
) -> EffectiveRules:
    """Merge every declared condition into one effective rule set.

    The general-fitness baseline always applies. Every recognised condition is
    layered on top and every unrecognised one adds the conservative pack plus a
    notice naming it.
    """
    registry = registry if registry is not None else get_registry()

    matched: list[ConditionPack] = []
    unknown: list[str] = []

    for condition in _normalized_conditions(conditions):
        pack = registry.find(condition)
        if pack is None:
            unknown.append(condition)
        else:
            matched.append(pack)

    selected: list[ConditionPack] = [registry.baseline, *matched]
    if unknown:
        selected.append(registry.conservative)

    packs = _dedupe_packs(selected)

    return EffectiveRules(
        pack_ids=tuple(pack.id for pack in packs),
        max_intensity=most_restrictive_intensity(pack.max_intensity for pack in packs),
        max_block_minutes=min(pack.max_block_minutes for pack in packs),
        min_block_minutes=max(pack.min_block_minutes for pack in packs),
        max_daily_minutes=min(pack.max_daily_minutes for pack in packs),
        blocked_tags=frozenset().union(*(pack.blocked_tags for pack in packs)),
        red_flags=_dedupe(symptom for pack in packs for symptom in pack.red_flag_symptoms),
        sources=_dedupe(source for pack in packs for source in pack.sources),
        guidance=_dedupe(note for pack in packs for note in pack.guidance),
        requires_doctor_clearance=any(pack.requires_doctor_clearance for pack in packs),
        is_conservative=any(pack is registry.conservative for pack in packs),
        notices=tuple(UNKNOWN_CONDITION_NOTICE.format(name=name) for name in unknown),
    )
