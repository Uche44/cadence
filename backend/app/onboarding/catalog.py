"""The intake catalogue.

Everything the onboarding screens offer lives here, so the server and the UI
agree on one list. The catalogue is deliberately broad — a condition we have not
authored rules for is accepted and resolved into conservative limits, never
silently treated as general fitness.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

#: Bumping this string is how a safety notice change is rolled out: every user
#: must accept the new version before the app opens again.
CONSENT_VERSION: Final[str] = "2026-11"

MAX_CONDITIONS: Final[int] = 12
MAX_INTERESTS: Final[int] = 12
MIN_INTERESTS: Final[int] = 3
MAX_EQUIPMENT: Final[int] = 8

#: Strings a client may send for "I have no condition". They are not persisted.
NONE_ALIASES: Final[frozenset[str]] = frozenset(
    {
        "none",
        "no condition",
        "no conditions",
        "none of these",
        "none of the above",
        "stay fit",
    }
)


@dataclass(frozen=True, slots=True)
class Option:
    """One selectable choice, with the copy the UI shows."""

    key: str
    label: str
    description: str
    emoji: str = ""
    icon: str = ""


CONDITION_OPTIONS: Final[tuple[Option, ...]] = (
    Option(
        key="Type 2 diabetes",
        label="Type 2 Diabetes",
        description="Targeting glucose uptake after meals",
        icon="droplet",
    ),
    Option(
        key="Hypertension",
        label="Hypertension",
        description="Lowers resting blood pressure",
        icon="heart",
    ),
    Option(
        key="Chronic low back pain / mild arthritis",
        label="Chronic back pain / arthritis",
        description="Spine decompression & joint mobility",
        icon="back",
    ),
    Option(
        key="Other chronic condition",
        label="Other chronic condition",
        description="Add auto-immune, respiratory, or other",
        icon="plus",
    ),
    Option(
        key="none",
        label="No condition - just stay fit",
        description="General fitness guidance, no clearance needed",
        icon="leaf",
    ),
)

INTEREST_OPTIONS: Final[tuple[Option, ...]] = (
    Option("Music & dancing", "Music & dancing", "Rhythm, joy, effortless cardio", "💃"),
    Option("Walking in nature", "Walking in nature", "Fresh air, birdsong & calm strides", "🌿"),
    Option("Gardening", "Gardening", "Potting, tending & gentle squats", "🌱"),
    Option(
        "Swimming & water aerobics",
        "Swimming & water aerobics",
        "Zero joint pressure, soothing float",
        "🏊‍♀️",
    ),
    Option(
        "Phone calls with friends",
        "Phone calls with friends",
        "Walking laps while catching up",
        "📞",
    ),
    Option(
        "Watching favorite TV / shows",
        "Watching favorite TV / shows",
        "Commercial break stretching",
        "📺",
    ),
    Option("Cooking & baking", "Cooking & baking", "Kitchen mobility & posture shifts", "🍲"),
    Option(
        "Prayer & quiet meditation",
        "Prayer & quiet meditation",
        "Deep diaphragm breathing & release",
        "🧘",
    ),
    Option(
        "Gentle stretching in bed",
        "Gentle stretching in bed",
        "Morning waking & spine alignment",
        "🛏️",
    ),
)

EQUIPMENT_OPTIONS: Final[tuple[Option, ...]] = (
    Option(
        "bodyweight",
        "None / Bodyweight only",
        "Gentle bed & floor-friendly flows",
        icon="bodyweight",
    ),
    Option(
        "resistance bands",
        "Resistance loop bands",
        "Low-impact joint stabilizing",
        icon="bands",
    ),
    Option(
        "light dumbbells",
        "Light dumbbells (2-5 lbs)",
        "Progressive bone density support",
        icon="dumbbell",
    ),
    Option(
        "walking pad",
        "Walking pad / Gym access",
        "Controlled micro-pacing options",
        icon="walk",
    ),
)

EQUIPMENT_KEYS: Final[frozenset[str]] = frozenset(option.key for option in EQUIPMENT_OPTIONS)


@dataclass(frozen=True, slots=True)
class ExerciseOption:
    """A movement the planner may offer, and what it needs to be available."""

    id: str
    label: str
    tags: frozenset[str]
    requires: frozenset[str]
    floor_based: bool = False


EXERCISES: Final[tuple[ExerciseOption, ...]] = (
    ExerciseOption(
        "chair_march", "Seated or chair marching", frozenset({"walking", "mobility"}), frozenset()
    ),
    ExerciseOption("wall_pushup", "Wall push-ups", frozenset({"strength"}), frozenset()),
    ExerciseOption(
        "garden_squat", "Gentle sit-to-stand", frozenset({"mobility", "strength"}), frozenset()
    ),
    ExerciseOption("dance_break", "Dance break", frozenset({"cardio", "dance"}), frozenset()),
    ExerciseOption(
        "march_in_place", "Marching in place", frozenset({"cardio", "low_impact"}), frozenset()
    ),
    ExerciseOption(
        "jumping_jacks", "Jumping jacks", frozenset({"cardio", "high_impact"}), frozenset()
    ),
    ExerciseOption(
        "band_row",
        "Resistance band row",
        frozenset({"strength"}),
        frozenset({"resistance bands"}),
    ),
    ExerciseOption(
        "dumbbell_curl",
        "Light dumbbell curls",
        frozenset({"strength"}),
        frozenset({"light dumbbells"}),
    ),
    ExerciseOption(
        "walking_pad_walk",
        "Walking-pad stroll",
        frozenset({"walking"}),
        frozenset({"walking pad"}),
    ),
    ExerciseOption(
        "floor_bridge",
        "Floor glute bridge",
        frozenset({"strength", "floor"}),
        frozenset({"bodyweight"}),
        floor_based=True,
    ),
    ExerciseOption(
        "bed_stretch",
        "Stretching in bed",
        frozenset({"mobility", "floor"}),
        frozenset({"bodyweight"}),
        floor_based=True,
    ),
)


def options_payload() -> dict[str, list[dict[str, str]]]:
    """The catalogue in the shape the client consumes."""

    def as_dict(option: Option) -> dict[str, str]:
        return {
            "key": option.key,
            "label": option.label,
            "description": option.description,
            "emoji": option.emoji,
            "icon": option.icon,
        }

    return {
        "conditions": [as_dict(option) for option in CONDITION_OPTIONS],
        "interests": [as_dict(option) for option in INTEREST_OPTIONS],
        "equipment": [as_dict(option) for option in EQUIPMENT_OPTIONS],
    }
