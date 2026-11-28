"""Morning check-in: the day as reported, and the gates around it.

The promises here are the ones planning depends on: one record per local day,
honest commitments, merged windows, and a red flag that stops the day before a
plan exists.
"""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.db import Checkin

PASSWORD = "correct horse battery"
SIGNUP = {
    "display_name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": PASSWORD,
}

HEALTH = {"conditions": ["Type 2 diabetes"], "doctor_clearance": True}
INTERESTS = {"interests": ["Music & dancing", "Walking in nature", "Gardening"]}
ROUTINE = {"wake_minute": 390, "bed_minute": 1335, "equipment": ["bodyweight"]}


def onboard(client: TestClient) -> TestClient:
    response = client.post("/api/auth/signup", json=SIGNUP)
    assert response.status_code == 201, response.text
    assert client.put("/api/onboarding/steps/1", json=HEALTH).status_code == 200
    assert client.put("/api/onboarding/steps/2", json=INTERESTS).status_code == 200
    assert client.put("/api/onboarding/steps/3", json=ROUTINE).status_code == 200
    assert client.post("/api/onboarding/consent", json={"accepted": True}).status_code == 200
    return client


def checkin_payload(**overrides: object) -> dict:
    payload: dict = {
        "energy": "steady",
        "symptoms": [],
        "notes": None,
        "commitments": [],
    }
    payload.update(overrides)
    return payload


def save(client: TestClient, payload: dict | None = None, offset: int = 0):
    return client.put(
        "/api/checkin",
        json=payload or checkin_payload(),
        params={"utc_offset_minutes": offset},
    )


def read(client: TestClient, offset: int = 0) -> dict:
    response = client.get("/api/checkin", params={"utc_offset_minutes": offset})
    assert response.status_code == 200, response.text
    return response.json()


def preview(client: TestClient, payload: dict):
    return client.post("/api/checkin/preview", json=payload)


def count_checkins(client: TestClient) -> int:
    with client.app.state.session_factory() as session:
        return int(session.execute(select(func.count(Checkin.id))).scalar_one())


# ------------------------------------------------------------------ the gates


def test_checkin_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/checkin").status_code == 401


def test_checkin_requires_consent(db_client: TestClient) -> None:
    response = db_client.post("/api/auth/signup", json=SIGNUP)
    assert response.status_code == 201

    assert db_client.get("/api/checkin").status_code == 403


def test_a_cross_site_write_is_refused(db_client: TestClient) -> None:
    onboard(db_client)

    response = db_client.put(
        "/api/checkin",
        json=checkin_payload(),
        headers={"origin": "https://evil.example"},
    )

    assert response.status_code == 403


# ------------------------------------------------------------------- energy


def test_missing_energy_is_rejected_with_a_field_error(db_client: TestClient) -> None:
    onboard(db_client)
    payload = checkin_payload()
    payload.pop("energy")

    response = save(db_client, payload)

    assert response.status_code == 422
    assert any(error["loc"][-1] == "energy" for error in response.json()["detail"])


def test_energy_must_be_one_of_the_three_levels(db_client: TestClient) -> None:
    onboard(db_client)

    response = save(db_client, checkin_payload(energy="medium"))

    assert response.status_code == 422
    assert "energy" in response.text


@pytest.mark.parametrize("energy", ["low", "steady", "high"])
def test_each_energy_level_round_trips(db_client: TestClient, energy: str) -> None:
    onboard(db_client)

    body = save(db_client, checkin_payload(energy=energy)).json()

    assert body["energy"] == energy
    assert read(db_client)["energy"] == energy


# -------------------------------------------------------------- commitments


def test_a_commitment_must_end_after_it_starts_and_names_itself(
    db_client: TestClient,
) -> None:
    onboard(db_client)

    response = save(
        db_client,
        checkin_payload(
            commitments=[
                {
                    "label": "Hospital ward shift",
                    "start_minute": 600,
                    "end_minute": 540,
                }
            ]
        ),
    )

    assert response.status_code == 422
    assert "Hospital ward shift" in response.text


def test_an_empty_commitment_label_is_rejected(db_client: TestClient) -> None:
    onboard(db_client)

    response = save(
        db_client,
        checkin_payload(commitments=[{"label": "   ", "start_minute": 600, "end_minute": 660}]),
    )

    assert response.status_code == 422


def test_overlapping_commitments_are_merged_in_the_preview(
    db_client: TestClient,
) -> None:
    onboard(db_client)

    response = preview(
        db_client,
        {
            "symptoms": [],
            "commitments": [
                {"label": "School run", "start_minute": 540, "end_minute": 600},
                {"label": "Call", "start_minute": 570, "end_minute": 630},
            ],
        },
    )

    assert response.status_code == 200, response.text
    windows = response.json()["windows"]
    assert [(window["start_minute"], window["end_minute"]) for window in windows] == [
        (390, 540),
        (630, 1335),
    ]


def test_commitments_can_be_added_edited_and_deleted(db_client: TestClient) -> None:
    onboard(db_client)

    added = save(
        db_client,
        checkin_payload(
            commitments=[{"label": "School run", "start_minute": 480, "end_minute": 540}]
        ),
    ).json()
    commitment_id = added["commitments"][0]["id"]
    assert added["commitments"][0]["label"] == "School run"

    edited = save(
        db_client,
        checkin_payload(
            commitments=[
                {
                    "id": commitment_id,
                    "label": "School run and drop-off",
                    "start_minute": 470,
                    "end_minute": 550,
                }
            ]
        ),
    ).json()
    assert edited["commitments"][0]["id"] == commitment_id
    assert edited["commitments"][0]["label"] == "School run and drop-off"
    assert edited["commitments"][0]["start_minute"] == 470

    deleted = save(db_client, checkin_payload(commitments=[])).json()
    assert deleted["commitments"] == []
    assert [(window["start_minute"], window["end_minute"]) for window in deleted["windows"]] == [
        (390, 1335)
    ]


def test_a_preview_does_not_persist_anything(db_client: TestClient) -> None:
    onboard(db_client)

    preview(
        db_client,
        {
            "symptoms": ["Slept badly"],
            "commitments": [{"label": "School run", "start_minute": 480, "end_minute": 540}],
        },
    )

    assert read(db_client)["exists"] is False
    assert count_checkins(db_client) == 0


def test_windows_clip_commitments_to_the_waking_day(db_client: TestClient) -> None:
    onboard(db_client)

    body = save(
        db_client,
        checkin_payload(
            commitments=[
                {"label": "Early start", "start_minute": 300, "end_minute": 420},
                {"label": "Late finish", "start_minute": 1300, "end_minute": 1400},
            ]
        ),
    ).json()

    assert [(window["start_minute"], window["end_minute"]) for window in body["windows"]] == [
        (420, 1300)
    ]


# ------------------------------------------------------------------ symptoms


def test_a_red_flag_symptom_stops_the_day_immediately(db_client: TestClient) -> None:
    onboard(db_client)

    response = save(db_client, checkin_payload(symptoms=["Chest pain or pressure"]))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["red_flag"] is not None
    assert body["red_flag"]["matched"]
    assert "stop" in body["red_flag"]["guidance"].lower()
    # The symptom is still recorded, so history remains truthful.
    assert body["symptoms"] == ["Chest pain or pressure"]


def test_the_preview_reports_a_red_flag_before_saving(db_client: TestClient) -> None:
    onboard(db_client)

    response = preview(
        db_client,
        {"symptoms": ["Dizziness / off-balance"], "commitments": []},
    )

    assert response.status_code == 200, response.text
    assert response.json()["red_flag"] is not None
    assert read(db_client)["exists"] is False


def test_non_red_flag_symptoms_persist_as_constraints(db_client: TestClient) -> None:
    onboard(db_client)

    body = save(
        db_client,
        checkin_payload(symptoms=["Slept badly", "Feeling sore"]),
    ).json()

    assert body["red_flag"] is None
    assert read(db_client)["symptoms"] == ["Slept badly", "Feeling sore"]


def test_symptoms_are_deduplicated_without_reordering(db_client: TestClient) -> None:
    onboard(db_client)

    body = save(
        db_client,
        checkin_payload(symptoms=["Feeling sore", "Slept badly", "Feeling sore"]),
    ).json()

    assert body["symptoms"] == ["Feeling sore", "Slept badly"]


def test_the_symptom_catalogue_marks_red_flags_for_this_user(
    db_client: TestClient,
) -> None:
    onboard(db_client)

    options = {option["key"]: option for option in read(db_client)["options"]["symptoms"]}

    assert options["chest_pain"]["red_flag"] is True
    assert options["slept_badly"]["red_flag"] is False


def test_the_red_flag_list_is_the_union_of_the_active_packs(
    db_client: TestClient,
) -> None:
    onboard(db_client)

    body = read(db_client)

    assert "chest pain, pressure or tightness" in body["red_flag_symptoms"]
    assert (
        "shakiness, sweating or confusion that could be low blood sugar"
        in (body["red_flag_symptoms"])
    )


# --------------------------------------------------------------------- notes


def test_notes_are_optional_and_bounded(db_client: TestClient) -> None:
    onboard(db_client)

    empty = save(db_client, checkin_payload(notes=None)).json()
    assert empty["notes"] is None

    exact = save(db_client, checkin_payload(notes="x" * 1000))
    assert exact.status_code == 200

    oversized = save(db_client, checkin_payload(notes="x" * 1001))
    assert oversized.status_code == 422
    assert "notes" in oversized.text


# --------------------------------------------------------------- the same day


def test_rechecking_in_updates_the_existing_record(db_client: TestClient) -> None:
    onboard(db_client)

    first = save(db_client, checkin_payload(energy="low", notes="tired")).json()
    second = save(
        db_client,
        checkin_payload(
            energy="high",
            symptoms=["Traveling"],
            commitments=[{"label": "Flight", "start_minute": 600, "end_minute": 720}],
        ),
    ).json()

    assert first["date"] == second["date"]
    assert count_checkins(db_client) == 1
    assert second["energy"] == "high"
    assert second["notes"] is None
    assert second["symptoms"] == ["Traveling"]


# ---------------------------------------------------------------- local date


def test_the_checkin_date_uses_the_users_local_day_not_utc(
    db_client: TestClient,
) -> None:
    onboard(db_client)
    # 00:30 UTC is still the previous evening in UTC-3.
    db_client.app.state.clock = lambda: datetime(2026, 11, 28, 0, 30, tzinfo=UTC)

    saved = save(db_client, checkin_payload(), offset=-180)
    assert saved.status_code == 200, saved.text
    assert saved.json()["date"] == "2026-11-27"

    local = read(db_client, offset=-180)
    assert local["date"] == "2026-11-27"
    assert local["exists"] is True

    utc = read(db_client, offset=0)
    assert utc["date"] == "2026-11-28"
    assert utc["exists"] is False
    assert count_checkins(db_client) == 1


def test_an_offset_outside_the_real_world_range_is_rejected(
    db_client: TestClient,
) -> None:
    onboard(db_client)

    assert db_client.get("/api/checkin", params={"utc_offset_minutes": 900}).status_code == 422


# -------------------------------------------------------------- an empty day


def test_an_empty_day_still_has_the_full_waking_window(db_client: TestClient) -> None:
    onboard(db_client)

    body = read(db_client)

    assert body["exists"] is False
    assert body["day_start_minute"] == 390
    assert body["day_end_minute"] == 1335
    assert body["windows"] == [{"start_minute": 390, "end_minute": 1335, "duration_minutes": 945}]


def test_the_checkin_reports_the_planning_gate(db_client: TestClient) -> None:
    onboard(db_client)

    assert read(db_client)["planning"]["ready"] is True
