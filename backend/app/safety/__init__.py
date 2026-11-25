"""Safety rules: authored packs, the merge that applies them, and the gate."""

from app.safety.fallback import FallbackPlan, build_fallback_plan
from app.safety.models import (
    ConditionPack,
    EffectiveRules,
    Intensity,
    InvalidPackError,
    PackKind,
    SafetyError,
    intensity_at_most,
    most_restrictive_intensity,
    normalize_name,
)
from app.safety.registry import (
    DEFAULT_PACKS_DIR,
    PackRegistry,
    get_registry,
    load_pack,
)
from app.safety.resolution import UNKNOWN_CONDITION_NOTICE, resolve_rules
from app.safety.validation import (
    STOP_GUIDANCE,
    PlanBlock,
    StopSignal,
    Violation,
    ViolationKind,
    find_red_flags,
    plan_is_safe,
    red_flag_stop,
    validate_plan,
)

__all__ = [
    "DEFAULT_PACKS_DIR",
    "STOP_GUIDANCE",
    "UNKNOWN_CONDITION_NOTICE",
    "ConditionPack",
    "EffectiveRules",
    "FallbackPlan",
    "Intensity",
    "InvalidPackError",
    "PackKind",
    "PackRegistry",
    "PlanBlock",
    "SafetyError",
    "StopSignal",
    "Violation",
    "ViolationKind",
    "build_fallback_plan",
    "find_red_flags",
    "get_registry",
    "intensity_at_most",
    "load_pack",
    "most_restrictive_intensity",
    "normalize_name",
    "plan_is_safe",
    "red_flag_stop",
    "resolve_rules",
    "validate_plan",
]
