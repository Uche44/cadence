"""Loading and validating condition packs.

Packs are data, not code: adding a condition means dropping a JSON file into
``packs/``. Everything is validated at load time and the error names the file,
because a silently ignored rule is worse than a crash — the user would get a
plan built on limits that never applied.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Final

from app.safety.models import (
    ConditionPack,
    Intensity,
    InvalidPackError,
    PackKind,
    normalize_name,
)

DEFAULT_PACKS_DIR: Final[Path] = Path(__file__).resolve().parent / "packs"

ALLOWED_FIELDS: Final[frozenset[str]] = frozenset(
    {
        "id",
        "label",
        "kind",
        "max_intensity",
        "max_block_minutes",
        "min_block_minutes",
        "max_daily_minutes",
        "blocked_tags",
        "red_flag_symptoms",
        "sources",
        "guidance",
        "aliases",
    }
)

REQUIRED_FIELDS: Final[tuple[str, ...]] = (
    "id",
    "label",
    "kind",
    "max_intensity",
    "max_block_minutes",
    "min_block_minutes",
    "max_daily_minutes",
    "red_flag_symptoms",
)


def _require_str(raw: dict[str, Any], field: str, path: Path) -> str:
    value = raw.get(field)
    if not isinstance(value, str) or not value.strip():
        raise InvalidPackError(f"{path.name}: '{field}' must be a non-empty string")
    return value


def _require_int(raw: dict[str, Any], field: str, path: Path) -> int:
    value = raw.get(field)
    if isinstance(value, bool) or not isinstance(value, int):
        raise InvalidPackError(f"{path.name}: '{field}' must be a whole number")
    return value


def _require_str_list(raw: dict[str, Any], field: str, path: Path) -> list[str]:
    value = raw.get(field, [])
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        raise InvalidPackError(f"{path.name}: '{field}' must be a list of strings")
    cleaned = [item.strip() for item in value if item.strip()]
    return cleaned


def load_pack(path: Path) -> ConditionPack:
    """Parse and validate one pack file."""
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise InvalidPackError(f"{path.name}: not valid JSON ({error.msg})") from error

    if not isinstance(raw, dict):
        raise InvalidPackError(f"{path.name}: a pack must be a JSON object")

    unknown_fields = set(raw) - ALLOWED_FIELDS
    if unknown_fields:
        raise InvalidPackError(
            f"{path.name}: unknown field(s): {', '.join(sorted(unknown_fields))}"
        )

    missing = [field for field in REQUIRED_FIELDS if field not in raw]
    if missing:
        raise InvalidPackError(f"{path.name}: missing field(s): {', '.join(missing)}")

    pack_id = _require_str(raw, "id", path)
    if not pack_id.replace("_", "").isalnum() or pack_id != pack_id.lower():
        raise InvalidPackError(
            f"{path.name}: 'id' must be lowercase letters, digits and underscores"
        )

    label = _require_str(raw, "label", path)

    try:
        kind = PackKind(_require_str(raw, "kind", path))
    except ValueError as error:
        raise InvalidPackError(
            f"{path.name}: 'kind' must be one of {', '.join(member.value for member in PackKind)}"
        ) from error

    try:
        max_intensity = Intensity(_require_str(raw, "max_intensity", path))
    except ValueError as error:
        raise InvalidPackError(
            f"{path.name}: 'max_intensity' must be one of "
            f"{', '.join(member.value for member in Intensity)}"
        ) from error

    max_block = _require_int(raw, "max_block_minutes", path)
    min_block = _require_int(raw, "min_block_minutes", path)
    max_daily = _require_int(raw, "max_daily_minutes", path)

    if min_block <= 0:
        raise InvalidPackError(f"{path.name}: 'min_block_minutes' must be positive")
    if max_block < min_block:
        raise InvalidPackError(
            f"{path.name}: 'max_block_minutes' ({max_block}) is below "
            f"'min_block_minutes' ({min_block})"
        )
    if max_daily < max_block:
        raise InvalidPackError(
            f"{path.name}: 'max_daily_minutes' ({max_daily}) is below "
            f"'max_block_minutes' ({max_block})"
        )

    blocked_tags = frozenset(tag.lower() for tag in _require_str_list(raw, "blocked_tags", path))
    red_flags = tuple(_require_str_list(raw, "red_flag_symptoms", path))
    sources = tuple(_require_str_list(raw, "sources", path))
    guidance = tuple(_require_str_list(raw, "guidance", path))
    aliases = tuple(_require_str_list(raw, "aliases", path))

    if not red_flags:
        raise InvalidPackError(f"{path.name}: 'red_flag_symptoms' must not be empty")

    if kind is PackKind.CLINICAL:
        if not sources:
            raise InvalidPackError(f"{path.name}: a clinical pack must cite at least one source")
        if not guidance:
            raise InvalidPackError(
                f"{path.name}: a clinical pack must carry at least one guidance note"
            )

    return ConditionPack(
        id=pack_id,
        label=label,
        kind=kind,
        max_intensity=max_intensity,
        max_block_minutes=max_block,
        min_block_minutes=min_block,
        max_daily_minutes=max_daily,
        blocked_tags=blocked_tags,
        red_flag_symptoms=red_flags,
        sources=sources,
        guidance=guidance,
        aliases=aliases,
    )


class PackRegistry:
    """Every authored pack, indexed by its aliases."""

    __slots__ = ("_baseline", "_conservative", "_index", "_packs")

    def __init__(self, packs: tuple[ConditionPack, ...]) -> None:
        if not packs:
            raise InvalidPackError("no condition packs were found")

        baselines = [pack for pack in packs if pack.kind is PackKind.BASELINE]
        if len(baselines) != 1:
            raise InvalidPackError(f"expected exactly one baseline pack, found {len(baselines)}")

        conservatives = [pack for pack in packs if pack.kind is PackKind.CONSERVATIVE]
        if len(conservatives) != 1:
            raise InvalidPackError(
                f"expected exactly one conservative pack, found {len(conservatives)}"
            )

        index: dict[str, ConditionPack] = {}
        for pack in packs:
            for name in {pack.id, pack.label, *pack.aliases}:
                key = normalize_name(name)
                if not key:
                    continue
                existing = index.get(key)
                if existing is not None and existing.id != pack.id:
                    raise InvalidPackError(
                        f"alias '{name}' is claimed by both '{existing.id}' and '{pack.id}'"
                    )
                index[key] = pack

        self._packs = packs
        self._index = index
        self._baseline = baselines[0]
        self._conservative = conservatives[0]

    @property
    def packs(self) -> tuple[ConditionPack, ...]:
        return self._packs

    @property
    def baseline(self) -> ConditionPack:
        return self._baseline

    @property
    def conservative(self) -> ConditionPack:
        return self._conservative

    def find(self, name: str) -> ConditionPack | None:
        return self._index.get(normalize_name(name))

    def clinical_pack_ids(self) -> tuple[str, ...]:
        return tuple(pack.id for pack in self._packs if pack.kind is PackKind.CLINICAL)

    @classmethod
    def from_directory(cls, directory: Path) -> PackRegistry:
        paths = sorted(Path(directory).glob("*.json"))
        if not paths:
            raise InvalidPackError(f"no pack files found in {directory}")

        return cls(tuple(load_pack(path) for path in paths))


@lru_cache(maxsize=1)
def get_registry() -> PackRegistry:
    """The packs shipped with the app."""
    return PackRegistry.from_directory(DEFAULT_PACKS_DIR)
