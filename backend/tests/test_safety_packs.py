"""Safety packs and rule resolution.

These tests describe what a person managing an illness must be able to rely on:
that declaring a condition can only ever tighten their plan, that a condition we
have not authored produces caution rather than a default fitness plan, and that a
broken rule file stops the app instead of disappearing into a log line.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from app.config import Settings
from app.main import create_app
from app.safety import (
    DEFAULT_PACKS_DIR,
    ConditionPack,
    EffectiveRules,
    Intensity,
    InvalidPackError,
    PackKind,
    PackRegistry,
    get_registry,
    intensity_at_most,
    load_pack,
    most_restrictive_intensity,
    resolve_rules,
)

REGISTRY = get_registry()
CLINICAL_IDS = REGISTRY.clinical_pack_ids()


# ------------------------------------------------------------------ shipped set


def test_ships_the_expected_packs() -> None:
    assert {pack.id for pack in REGISTRY.packs} == {
        "baseline",
        "type_2_diabetes",
        "hypertension",
        "chronic_low_back_pain",
        "conservative_fallback",
    }


def test_exactly_one_baseline_and_one_conservative_pack() -> None:
    assert REGISTRY.baseline.kind is PackKind.BASELINE
    assert REGISTRY.conservative.kind is PackKind.CONSERVATIVE


@pytest.mark.parametrize("pack", REGISTRY.packs, ids=lambda pack: pack.id)
def test_every_pack_is_internally_coherent(pack: ConditionPack) -> None:
    assert pack.label.strip()
    assert pack.min_block_minutes > 0
    assert pack.min_block_minutes <= pack.max_block_minutes <= pack.max_daily_minutes
    assert pack.red_flag_symptoms, "every pack must list the symptoms that stop a session"
    assert all(tag == tag.lower() for tag in pack.blocked_tags)


@pytest.mark.parametrize(
    "pack",
    [pack for pack in REGISTRY.packs if pack.kind is PackKind.CLINICAL],
    ids=lambda pack: pack.id,
)
def test_clinical_packs_cite_sources_and_carry_guidance(pack: ConditionPack) -> None:
    assert pack.sources, f"{pack.id} must cite published guidance"
    assert pack.guidance, f"{pack.id} must carry guidance for the planner"
    assert pack.requires_doctor_clearance


# --------------------------------------------------------------- baseline path


def test_no_conditions_resolves_to_the_baseline_only() -> None:
    rules = resolve_rules([])

    assert rules.pack_ids == ("baseline",)
    assert rules.max_intensity is Intensity.MODERATE
    assert not rules.requires_doctor_clearance
    assert not rules.is_conservative
    assert rules.notices == ()


def test_the_general_fitness_alias_does_not_add_clearance() -> None:
    assert not resolve_rules(["General fitness"]).requires_doctor_clearance
    assert not resolve_rules(["none"]).requires_doctor_clearance


def test_blank_and_duplicate_conditions_do_not_change_the_rules() -> None:
    baseline = resolve_rules([])

    assert resolve_rules(["", "   ", "\n"]) == baseline
    assert resolve_rules(["Hypertension", "hypertension", "HYPERTENSION "]) == resolve_rules(
        ["hypertension"]
    )


# ------------------------------------------------------------------ alias input


@pytest.mark.parametrize(
    "written",
    [
        "Type 2 diabetes",
        "type 2 Diabetes",
        "type-2-diabetes",
        "TYPE_2_DIABETES",
        "type 2 diabetes  ",
        "t2d",
        "T2DM",
        "diabetes type 2",
    ],
)
def test_conditions_resolve_however_they_are_written(written: str) -> None:
    rules = resolve_rules([written])

    assert "type_2_diabetes" in rules.pack_ids
    assert not rules.is_conservative
    assert rules.requires_doctor_clearance


def test_a_stated_condition_requires_doctor_clearance() -> None:
    assert resolve_rules(["hypertension"]).requires_doctor_clearance


# --------------------------------------------------------------- unknown input


def test_an_unauthored_condition_falls_back_conservatively() -> None:
    rules = resolve_rules(["asthma"])

    assert rules.pack_ids == ("baseline", "conservative_fallback")
    assert rules.max_intensity is Intensity.LOW
    assert rules.is_conservative
    assert rules.requires_doctor_clearance
    assert len(rules.notices) == 1
    assert "asthma" in rules.notices[0]


def test_each_unknown_condition_gets_its_own_notice() -> None:
    rules = resolve_rules(["asthma", "lupus"])

    assert len(rules.notices) == 2
    assert any("asthma" in notice for notice in rules.notices)
    assert any("lupus" in notice for notice in rules.notices)


def test_unqualified_diabetes_is_not_assumed_to_be_type_2() -> None:
    # Type 1 and type 2 need different guidance, so we do not guess.
    assert resolve_rules(["diabetes"]).is_conservative


def test_conservative_limits_are_stricter_than_baseline() -> None:
    baseline = resolve_rules([])
    conservative = resolve_rules(["something unauthored"])

    assert intensity_at_most(conservative.max_intensity, baseline.max_intensity)
    assert conservative.max_intensity is Intensity.LOW
    assert conservative.max_block_minutes < baseline.max_block_minutes
    assert conservative.max_daily_minutes < baseline.max_daily_minutes
    assert conservative.blocked_tags > baseline.blocked_tags


# ----------------------------------------------------------------------- merge


def test_two_conditions_take_the_most_restrictive_value_of_each_field() -> None:
    diabetes = REGISTRY.find("type 2 diabetes")
    hypertension = REGISTRY.find("hypertension")
    assert diabetes is not None and hypertension is not None

    rules = resolve_rules(["type 2 diabetes", "hypertension"])

    assert set(rules.pack_ids) == {"baseline", "type_2_diabetes", "hypertension"}
    assert rules.max_block_minutes == min(
        diabetes.max_block_minutes, hypertension.max_block_minutes
    )
    assert rules.max_daily_minutes == min(
        diabetes.max_daily_minutes, hypertension.max_daily_minutes
    )
    assert rules.min_block_minutes == max(
        diabetes.min_block_minutes, hypertension.min_block_minutes
    )


def test_blocked_tags_are_unioned_and_deduplicated() -> None:
    rules = resolve_rules(["type 2 diabetes", "hypertension", "back pain"])

    assert "high_impact" in rules.blocked_tags
    assert "valsalva_maneuver" in rules.blocked_tags
    assert "loaded_twisting" in rules.blocked_tags


def test_red_flags_are_unioned_without_repeating_shared_symptoms() -> None:
    rules = resolve_rules(["type 2 diabetes", "hypertension", "back pain"])
    shared = "chest pain, pressure or tightness"

    assert rules.red_flags.count(shared) == 1
    assert "numbness around the groin or saddle area" in rules.red_flags
    assert "changes in vision" in rules.red_flags


def test_sources_from_each_pack_are_carried_once() -> None:
    rules = resolve_rules(["type 2 diabetes", "hypertension"])
    who = "WHO 2020 Guidelines on physical activity and sedentary behaviour"

    assert rules.sources.count(who) == 1
    assert len(rules.sources) == len(set(rules.sources))


def test_guidance_combines_every_applicable_pack() -> None:
    rules = resolve_rules(["type 2 diabetes"])

    assert any("after meals" in note for note in rules.guidance)
    assert any("move" in note for note in rules.guidance)


def test_a_known_condition_plus_an_unknown_one_stays_conservative() -> None:
    rules = resolve_rules(["hypertension", "lupus"])

    assert rules.max_intensity is Intensity.LOW
    assert rules.is_conservative
    assert "hypertension" in rules.pack_ids
    assert len(rules.notices) == 1


# ------------------------------------------------------------------ properties


def assert_no_more_permissive(actual: EffectiveRules, reference: EffectiveRules) -> None:
    assert intensity_at_most(actual.max_intensity, reference.max_intensity)
    assert actual.max_block_minutes <= reference.max_block_minutes
    assert actual.max_daily_minutes <= reference.max_daily_minutes
    assert actual.min_block_minutes >= reference.min_block_minutes
    assert actual.blocked_tags >= reference.blocked_tags
    assert set(actual.red_flags) >= set(reference.red_flags)
    if reference.requires_doctor_clearance:
        assert actual.requires_doctor_clearance


@given(st.lists(st.sampled_from(CLINICAL_IDS), max_size=3))
@settings(max_examples=200, deadline=None)
def test_no_condition_set_is_ever_more_permissive_than_baseline(
    conditions: list[str],
) -> None:
    assert_no_more_permissive(resolve_rules(conditions), resolve_rules([]))


@given(st.sets(st.sampled_from(CLINICAL_IDS)), st.sampled_from(CLINICAL_IDS))
@settings(max_examples=200, deadline=None)
def test_adding_a_condition_never_widens_the_limits(existing: set[str], additional: str) -> None:
    before = resolve_rules(sorted(existing))
    after = resolve_rules(sorted(existing | {additional}))

    assert_no_more_permissive(after, before)


@given(st.sets(st.sampled_from(CLINICAL_IDS)), st.text(min_size=1, max_size=24))
@settings(max_examples=200, deadline=None)
def test_adding_an_unrecognised_condition_never_widens_the_limits(
    existing: set[str], extra: str
) -> None:
    before = resolve_rules(sorted(existing))
    after = resolve_rules(sorted(existing | {extra}))

    assert_no_more_permissive(after, before)


# ------------------------------------------------------------- intensity order


def test_intensity_cap_comparison_is_ordered() -> None:
    assert intensity_at_most(Intensity.LOW, Intensity.MODERATE)
    assert intensity_at_most(Intensity.MODERATE, Intensity.MODERATE)
    assert not intensity_at_most(Intensity.VIGOROUS, Intensity.MODERATE)
    assert not intensity_at_most(Intensity.MODERATE, Intensity.LOW)


def test_most_restrictive_intensity_picks_the_lowest() -> None:
    assert (
        most_restrictive_intensity([Intensity.VIGOROUS, Intensity.LOW, Intensity.MODERATE])
        is Intensity.LOW
    )


# ------------------------------------------------------------ malformed packs


VALID_PACK: dict[str, Any] = {
    "id": "example_condition",
    "label": "Example condition",
    "kind": "clinical",
    "max_intensity": "moderate",
    "max_block_minutes": 20,
    "min_block_minutes": 5,
    "max_daily_minutes": 45,
    "blocked_tags": ["high_impact"],
    "red_flag_symptoms": ["chest pain, pressure or tightness"],
    "sources": ["Example published guidance"],
    "guidance": ["Keep it gentle."],
    "aliases": [],
}

_MISSING = object()


def variant(**changes: object) -> dict[str, Any]:
    payload = dict(VALID_PACK)
    for key, value in changes.items():
        if value is _MISSING:
            payload.pop(key, None)
        else:
            payload[key] = value
    return payload


MALFORMED_PACKS = [
    ("unknown field", variant(mystery=1), "unknown field"),
    ("missing label", variant(label=_MISSING), "missing field"),
    ("wrong kind", variant(kind="wellness"), "kind"),
    ("unknown intensity", variant(max_intensity="extreme"), "max_intensity"),
    ("zero minimum block", variant(min_block_minutes=0), "min_block_minutes"),
    ("max below min", variant(min_block_minutes=30), "max_block_minutes"),
    ("daily below block", variant(max_daily_minutes=10), "max_daily_minutes"),
    ("clinical without sources", variant(sources=[]), "cite at least one source"),
    ("clinical without guidance", variant(guidance=[]), "guidance note"),
    ("no red flags", variant(red_flag_symptoms=[]), "red_flag_symptoms"),
    ("uppercase id", variant(id="ExampleCondition"), "'id'"),
    ("non-integer duration", variant(max_block_minutes="20"), "whole number"),
    ("boolean duration", variant(max_block_minutes=True), "whole number"),
]


@pytest.mark.parametrize(
    ("payload", "fragment"),
    [(payload, fragment) for _, payload, fragment in MALFORMED_PACKS],
    ids=[case_id for case_id, _, _ in MALFORMED_PACKS],
)
def test_a_malformed_pack_is_rejected_and_the_file_is_named(
    tmp_path: Path, payload: dict[str, Any], fragment: str
) -> None:
    path = tmp_path / "broken.json"
    path.write_text(json.dumps(payload), encoding="utf-8")

    with pytest.raises(InvalidPackError) as excinfo:
        load_pack(path)

    assert "broken.json" in str(excinfo.value)
    assert fragment in str(excinfo.value)


def test_invalid_json_is_rejected_with_the_file_named(tmp_path: Path) -> None:
    path = tmp_path / "broken.json"
    path.write_text("{ not json", encoding="utf-8")

    with pytest.raises(InvalidPackError, match=r"broken\.json"):
        load_pack(path)


def test_a_pack_must_be_a_json_object(tmp_path: Path) -> None:
    path = tmp_path / "broken.json"
    path.write_text("[]", encoding="utf-8")

    with pytest.raises(InvalidPackError, match="JSON object"):
        load_pack(path)


# ------------------------------------------------------------------- registry


def write_pack(directory: Path, payload: dict[str, Any], name: str) -> Path:
    path = directory / name
    path.write_text(json.dumps(payload), encoding="utf-8")
    return path


def test_a_directory_without_packs_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(InvalidPackError, match="no pack files"):
        PackRegistry.from_directory(tmp_path)


def test_two_baselines_are_rejected(tmp_path: Path) -> None:
    write_pack(tmp_path, variant(kind="baseline", id="baseline", label="Baseline"), "a.json")
    write_pack(tmp_path, variant(kind="baseline", id="other", label="Other"), "b.json")

    with pytest.raises(InvalidPackError, match="exactly one baseline"):
        PackRegistry.from_directory(tmp_path)


def test_a_missing_baseline_is_rejected(tmp_path: Path) -> None:
    write_pack(
        tmp_path,
        variant(kind="conservative", id="conservative_fallback", label="Conservative"),
        "only.json",
    )

    with pytest.raises(InvalidPackError, match="exactly one baseline"):
        PackRegistry.from_directory(tmp_path)


def test_a_missing_conservative_pack_is_rejected(tmp_path: Path) -> None:
    write_pack(tmp_path, variant(kind="baseline", id="baseline", label="Baseline"), "baseline.json")

    with pytest.raises(InvalidPackError, match="exactly one conservative"):
        PackRegistry.from_directory(tmp_path)


def test_two_packs_claiming_the_same_alias_are_rejected(tmp_path: Path) -> None:
    write_pack(tmp_path, variant(kind="baseline", id="baseline", label="Baseline"), "baseline.json")
    write_pack(
        tmp_path,
        variant(id="conservative_fallback", kind="conservative", label="Conservative"),
        "conservative.json",
    )
    write_pack(tmp_path, variant(id="first", label="First", aliases=["shared name"]), "first.json")
    write_pack(
        tmp_path, variant(id="second", label="Second", aliases=["Shared-Name"]), "second.json"
    )

    with pytest.raises(InvalidPackError, match="claimed by both"):
        PackRegistry.from_directory(tmp_path)


# ------------------------------------------------------------- drop-in packs


def test_a_new_pack_is_discovered_without_touching_code(tmp_path: Path) -> None:
    for existing in DEFAULT_PACKS_DIR.glob("*.json"):
        shutil.copy(existing, tmp_path / existing.name)

    write_pack(
        tmp_path,
        variant(
            id="migraine",
            label="Migraine",
            max_intensity="low",
            max_block_minutes=15,
            max_daily_minutes=30,
            aliases=["migraines"],
        ),
        "migraine.json",
    )

    registry = PackRegistry.from_directory(tmp_path)
    rules = resolve_rules(["migraines"], registry=registry)

    assert "migraine" in rules.pack_ids
    assert rules.max_intensity is Intensity.LOW
    assert not rules.is_conservative
    assert rules.requires_doctor_clearance


# ------------------------------------------------------------------ app boot


def test_the_app_validates_its_packs_at_boot(tmp_path: Path) -> None:
    packs = tmp_path / "packs"
    packs.mkdir()
    write_pack(packs, variant(kind="baseline", id="baseline", label="Baseline"), "baseline.json")
    write_pack(
        packs,
        variant(id="conservative_fallback", kind="conservative", label="Conservative"),
        "conservative.json",
    )

    app = create_app(
        Settings(
            environment="test",
            static_dir=tmp_path / "dist",
            safety_packs_dir=packs,
            _env_file=None,
        )
    )

    assert len(app.state.safety_registry.packs) == 2


def test_the_app_refuses_to_boot_with_a_malformed_pack(tmp_path: Path) -> None:
    packs = tmp_path / "packs"
    packs.mkdir()
    write_pack(packs, variant(max_intensity="extreme"), "broken.json")

    with pytest.raises(InvalidPackError, match=r"broken\.json"):
        create_app(
            Settings(
                environment="test",
                static_dir=tmp_path / "dist",
                safety_packs_dir=packs,
                _env_file=None,
            )
        )
