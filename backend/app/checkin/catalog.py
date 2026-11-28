"""The morning check-in catalogue.

Symptom chips are served from here so the client cannot invent a symptom the
server will not recognise. Whether a chip is a red flag is not decided here: it
is decided per user, from the red flags in their active safety packs, so the
same chip can be a stop for one person and an ordinary note for another.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

MAX_NOTES: Final[int] = 1000
MAX_COMMITMENTS: Final[int] = 20
MAX_SYMPTOMS: Final[int] = 20
MAX_LABEL: Final[int] = 120
MAX_SYMPTOM_LENGTH: Final[int] = 120

#: The offsets a browser may report, in minutes east of UTC.
MIN_UTC_OFFSET: Final[int] = -720
MAX_UTC_OFFSET: Final[int] = 840


@dataclass(frozen=True, slots=True)
class SymptomOption:
    key: str
    label: str
    description: str = ""


SYMPTOM_OPTIONS: Final[tuple[SymptomOption, ...]] = (
    SymptomOption("slept_badly", "Slept badly", "Rest was broken or short"),
    SymptomOption("sore", "Feeling sore", "Muscles or joints are tender"),
    SymptomOption("stiff", "Stiff joints", "Movement feels sticky this morning"),
    SymptomOption("anxious", "Feeling anxious", "Stress is running high"),
    SymptomOption("night_shift", "Shift work / night shift", "The day starts at an odd hour"),
    SymptomOption("traveling", "Traveling", "Away from the usual routine"),
    SymptomOption("dizziness", "Dizziness / off-balance", "Dizzy or unsteady on your feet"),
    SymptomOption("chest_pain", "Chest pain or pressure", "Pain, pressure, or tightness"),
    SymptomOption("breathless", "Shortness of breath", "Breathless at rest or with little effort"),
    SymptomOption("faint", "Fainting or near-fainting", "You fainted or almost did"),
    SymptomOption("leg_weakness", "Numbness or weakness in legs", "New numbness or leg weakness"),
    SymptomOption("shaky", "Shakiness or confusion", "Shaky, sweaty, or confused"),
    SymptomOption("vision", "Blurred vision", "New or sudden blurring"),
    SymptomOption("foot_wound", "Foot wound getting worse", "A cut or blister that is worsening"),
    SymptomOption("none", "None / feeling good", "Nothing unusual today"),
)

SYMPTOM_KEYS: Final[frozenset[str]] = frozenset(option.key for option in SYMPTOM_OPTIONS)


def symptoms_payload() -> list[dict[str, str]]:
    return [
        {"key": option.key, "label": option.label, "description": option.description}
        for option in SYMPTOM_OPTIONS
    ]
