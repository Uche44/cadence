"""Onboarding: the four steps, the rules they resolve into, and the gates.

The promises here are the ones the rest of the product leans on: steps cannot be
skipped, the caps shown are the caps that apply, consent is recorded, and a
profile edit cannot leave an old plan looking valid.
"""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text

from app.db import Checkin, Consent, Energy, Plan, User
from app.onboarding.catalog import CONSENT_VERSION

PASSWORD = "correct horse battery"
SIGNUP = {
    "display_name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": PASSWORD,
}

HEALTH = {"conditions": ["Type 2 diabetes"], "doctor_clearance": True}
INTERESTS = {"interests": ["Music & dancing", "Walking in nature", "Gardening"]}
ROUTINE = {"wake_minute": 390, "bed_minute": 1335, "equipment": ["bodyweight"]}


def signup(client: TestClient) -> TestClient:
    response = client.post("/api/auth/signup", json=SIGNUP)
    assert response.status_code == 201, response.text
    return client


def state(client: TestClient) -> dict:
    response = client.get("/api/onboarding")
    assert response.status_code == 200, response.text
    return response.json()


def save(client: TestClient, step: int, payload: dict):
    return client.put(f"/api/onboarding/steps/{step}", json=payload)


def finish(client: TestClient, *, health: dict | None = None, routine: dict | None = None) -> dict:
    save(client, 1, health or HEALTH)
    save(client, 2, INTERESTS)
    save(client, 3, routine or ROUTINE)
    response = client.post("/api/onboarding/consent", json={"accepted": True})
    assert response.status_code == 200, response.text
    return response.json()


# ------------------------------------------------------------------ the start


def test_a_new_account_starts_at_step_one(db_client: TestClient) -> None:
    signup(db_client)
    body = state(db_client)

    assert body["completed"] is False
    assert body["completed_step"] == 0
    assert body["resume_step"] == 1
    assert body["rules"]["pack_ids"] == ["baseline"]
    assert body["planning"]["ready"] is False
    assert body["planning"]["blocked_reason"] == "onboarding"


def test_onboarding_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/onboarding").status_code == 401


def test_the_catalogue_is_served_so_the_client_cannot_invent_options(
    db_client: TestClient,
) -> None:
    signup(db_client)
    options = state(db_client)["options"]

    assert {option["key"] for option in options["conditions"]} >= {
        "Type 2 diabetes",
        "Hypertension",
        "Other chronic condition",
        "none",
    }
    assert len(options["interests"]) >= 9
    assert {option["key"] for option in options["equipment"]} == {
        "bodyweight",
        "resistance bands",
        "light dumbbells",
        "walking pad",
    }


# -------------------------------------------------------------------- ordering


def test_step_two_cannot_be_reached_before_step_one(db_client: TestClient) -> None:
    signup(db_client)

    response = save(db_client, 2, INTERESTS)

    assert response.status_code == 409
    assert response.json()["resume_step"] == 1
    assert response.json()["completed_step"] == 0
    assert state(db_client)["profile"]["interests"] == []


def test_step_three_reports_the_correct_resume_point(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)

    response = save(db_client, 3, ROUTINE)

    assert response.status_code == 409
    assert response.json()["resume_step"] == 2


def test_consent_cannot_be_accepted_before_the_routine(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)
    save(db_client, 2, INTERESTS)

    response = db_client.post("/api/onboarding/consent", json={"accepted": True})

    assert response.status_code == 409
    assert response.json()["resume_step"] == 3


def test_refreshing_mid_flow_resumes_at_the_right_step_with_answers_intact(
    db_client: TestClient,
) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)

    resumed = state(db_client)

    assert resumed["completed_step"] == 1
    assert resumed["resume_step"] == 2
    assert resumed["profile"]["conditions"] == ["Type 2 diabetes"]
    assert resumed["profile"]["doctor_clearance"] is True


# ------------------------------------------------------------------- the rules


def test_declared_conditions_persist_and_resolve_to_the_effective_caps(
    db_client: TestClient,
) -> None:
    signup(db_client)
    save(
        db_client,
        1,
        {
            "conditions": ["Type 2 diabetes", "Hypertension"],
            "doctor_clearance": True,
        },
    )

    body = state(db_client)

    assert body["profile"]["conditions"] == ["Type 2 diabetes", "Hypertension"]
    assert set(body["rules"]["pack_ids"]) == {"baseline", "type_2_diabetes", "hypertension"}
    # The most restrictive pack wins each field.
    assert body["rules"]["max_block_minutes"] == 20
    assert body["rules"]["max_daily_minutes"] == 45
    assert body["rules"]["max_intensity"] == "moderate"
    assert "high_impact" in body["rules"]["blocked_tags"]


def test_an_unauthored_condition_goes_conservative_with_a_visible_notice(
    db_client: TestClient,
) -> None:
    signup(db_client)
    save(
        db_client,
        1,
        {"conditions": ["Other chronic condition"], "doctor_clearance": True},
    )

    body = state(db_client)

    assert body["rules"]["is_conservative"] is True
    assert body["rules"]["max_intensity"] == "low"
    assert body["rules"]["max_block_minutes"] == 10
    assert body["rules"]["max_daily_minutes"] == 20
    assert body["rules"]["notices"]
    assert "confirm with your doctor" in body["rules"]["notices"][0].lower()


def test_no_condition_uses_the_baseline_and_needs_no_clearance(
    db_client: TestClient,
) -> None:
    signup(db_client)
    save(db_client, 1, {"conditions": ["none"], "doctor_clearance": False})

    body = state(db_client)

    assert body["profile"]["conditions"] == []
    assert body["rules"]["pack_ids"] == ["baseline"]
    assert body["rules"]["requires_doctor_clearance"] is False
    assert body["rules"]["is_conservative"] is False


# ------------------------------------------------------------------- interests


def test_fewer_than_three_interests_is_rejected_server_side(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)

    response = save(db_client, 2, {"interests": ["Music & dancing", "Gardening"]})

    assert response.status_code == 422
    assert "at least 3" in response.text
    assert state(db_client)["completed_step"] == 1


def test_interests_collapse_duplicates_and_keep_the_chosen_order(
    db_client: TestClient,
) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)

    save(
        db_client,
        2,
        {
            "interests": [
                "Walking in nature",
                "Music & dancing",
                "Walking in nature",
                "Gardening",
            ]
        },
    )

    assert state(db_client)["profile"]["interests"] == [
        "Walking in nature",
        "Music & dancing",
        "Gardening",
    ]


# --------------------------------------------------------------------- routine


def test_bedtime_must_be_after_wake_time(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)
    save(db_client, 2, INTERESTS)

    response = save(
        db_client,
        3,
        {"wake_minute": 480, "bed_minute": 400, "equipment": ["bodyweight"]},
    )

    assert response.status_code == 422
    assert "bedtime must be after" in response.text


def test_the_routine_persists_and_becomes_the_day_bounds(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)
    save(db_client, 2, INTERESTS)

    body = save(
        db_client,
        3,
        {"wake_minute": 420, "bed_minute": 1290, "equipment": ["bodyweight"]},
    ).json()

    assert body["profile"]["wake_minute"] == 420
    assert body["profile"]["bed_minute"] == 1290


def test_equipment_changes_which_exercises_are_eligible(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, {"conditions": ["none"], "doctor_clearance": False})
    save(db_client, 2, INTERESTS)

    without_kit = save(
        db_client,
        3,
        {"wake_minute": 390, "bed_minute": 1335, "equipment": []},
    ).json()
    with_bodyweight = save(
        db_client,
        3,
        {"wake_minute": 390, "bed_minute": 1335, "equipment": ["bodyweight"]},
    ).json()

    without_ids = {exercise["id"] for exercise in without_kit["eligible_exercises"]}
    with_ids = {exercise["id"] for exercise in with_bodyweight["eligible_exercises"]}

    assert "floor_bridge" not in without_ids
    assert "floor_bridge" in with_ids
    assert any(exercise["floor_based"] for exercise in with_bodyweight["eligible_exercises"])


def test_blocked_tags_remove_exercises_from_eligibility(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, {"conditions": ["Type 2 diabetes"], "doctor_clearance": True})
    save(db_client, 2, INTERESTS)

    body = save(
        db_client,
        3,
        {"wake_minute": 390, "bed_minute": 1335, "equipment": ["bodyweight"]},
    ).json()

    assert "jumping_jacks" not in {exercise["id"] for exercise in body["eligible_exercises"]}


# --------------------------------------------------------------------- consent


def test_consent_records_the_version_and_timestamp(db_client: TestClient) -> None:
    signup(db_client)
    body = finish(db_client)

    assert body["completed"] is True
    assert body["consent"]["accepted"] is True
    assert body["consent"]["version"] == CONSENT_VERSION
    assert body["consent"]["accepted_at"] is not None

    with db_client.app.state.session_factory() as session:
        stored = session.execute(select(Consent)).scalar_one()
        assert stored.version == CONSENT_VERSION
        assert stored.accepted_at is not None


def test_consent_must_be_affirmative(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)
    save(db_client, 2, INTERESTS)
    save(db_client, 3, ROUTINE)

    response = db_client.post("/api/onboarding/consent", json={"accepted": False})

    assert response.status_code == 422
    assert state(db_client)["completed"] is False


def test_accepting_consent_twice_is_idempotent(db_client: TestClient) -> None:
    signup(db_client)
    first = finish(db_client)
    second = db_client.post("/api/onboarding/consent", json={"accepted": True})

    assert second.status_code == 200
    assert second.json()["consent"]["accepted_at"] == first["consent"]["accepted_at"]

    with db_client.app.state.session_factory() as session:
        assert session.execute(text("SELECT COUNT(*) FROM consents")).scalar() == 1


# ------------------------------------------------------------------ home gate


def test_home_is_unreachable_without_a_consent_record(db_client: TestClient) -> None:
    signup(db_client)
    save(db_client, 1, HEALTH)
    save(db_client, 2, INTERESTS)
    save(db_client, 3, ROUTINE)

    response = db_client.get("/api/home")

    assert response.status_code == 403
    assert "safety notice" in response.json()["detail"]


def test_home_opens_after_consent(db_client: TestClient) -> None:
    signup(db_client)
    finish(db_client)

    response = db_client.get("/api/home")

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Ada Lovelace"
    assert body["planning"]["ready"] is True
    assert body["stale_plans"] == 0


def test_a_missing_clearance_blocks_planning_with_an_explanation_not_an_error(
    db_client: TestClient,
) -> None:
    signup(db_client)
    finish(db_client, health={"conditions": ["Hypertension"], "doctor_clearance": False})

    response = db_client.get("/api/home")

    assert response.status_code == 200
    body = response.json()
    assert body["planning"]["ready"] is False
    assert body["planning"]["blocked_reason"] == "doctor_clearance"
    assert "not an error" in body["planning"]["message"].lower()
    # It must not quietly become a baseline plan.
    assert "hypertension" in body["rules"]["pack_ids"]


def test_clearance_true_opens_planning(db_client: TestClient) -> None:
    signup(db_client)
    finish(db_client, health={"conditions": ["Hypertension"], "doctor_clearance": True})

    assert db_client.get("/api/home").json()["planning"]["ready"] is True


# --------------------------------------------------------------------- editing


def make_plan(client: TestClient, fingerprint: str) -> str:
    with client.app.state.session_factory() as session:
        user = session.query(User).one()
        checkin = Checkin(
            user_id=user.id,
            local_date=date(2026, 11, 26),
            energy=Energy.STEADY,
        )
        session.add(checkin)
        session.flush()
        plan = Plan(
            checkin_id=checkin.id,
            pack_ids=["baseline", "type_2_diabetes"],
            rules_fingerprint=fingerprint,
        )
        session.add(plan)
        session.commit()
        return plan.id


def test_editing_the_profile_re_resolves_rules_and_marks_old_plans_stale(
    db_client: TestClient,
) -> None:
    signup(db_client)
    before = finish(db_client)
    plan_id = make_plan(db_client, before["rules"]["fingerprint"])

    response = db_client.put("/api/profile", json={"conditions": ["Hypertension"]})

    assert response.status_code == 200
    after = response.json()
    assert after["profile"]["conditions"] == ["Hypertension"]
    assert after["rules"]["fingerprint"] != before["rules"]["fingerprint"]
    assert "hypertension" in after["rules"]["pack_ids"]
    assert "type_2_diabetes" not in after["rules"]["pack_ids"]

    with db_client.app.state.session_factory() as session:
        plan = session.get(Plan, plan_id)
        assert plan is not None
        assert plan.stale is True


def test_an_edit_that_does_not_change_the_rules_leaves_plans_valid(
    db_client: TestClient,
) -> None:
    signup(db_client)
    before = finish(db_client)
    plan_id = make_plan(db_client, before["rules"]["fingerprint"])

    response = db_client.put("/api/profile", json={"doctor_clearance": True})

    assert response.status_code == 200
    with db_client.app.state.session_factory() as session:
        assert session.get(Plan, plan_id).stale is False


def test_an_edit_is_validated(db_client: TestClient) -> None:
    signup(db_client)
    finish(db_client)

    backwards = db_client.put("/api/profile", json={"wake_minute": 1200, "bed_minute": 400})
    few = db_client.put("/api/profile", json={"interests": ["Gardening"]})

    assert backwards.status_code == 422
    assert few.status_code == 422


# --------------------------------------------------------------------- origin


def test_a_cross_site_step_write_is_refused(db_client: TestClient) -> None:
    signup(db_client)

    response = db_client.put(
        "/api/onboarding/steps/1",
        json=HEALTH,
        headers={"origin": "https://evil.example"},
    )

    assert response.status_code == 403


@pytest.mark.parametrize("step", [0, 4, 9])
def test_an_unknown_step_path_is_a_404(db_client: TestClient, step: int) -> None:
    signup(db_client)

    assert db_client.put(f"/api/onboarding/steps/{step}", json={}).status_code == 404
