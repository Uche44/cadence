"""Accounts and sessions.

These tests describe promises made to someone whose health data is in the app:
that a password never comes back out, that signing out actually ends the session,
that a wrong password and a missing account look identical from outside, and that
nothing behind the door opens for an anonymous request.
"""

from __future__ import annotations

import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.sessions import SESSION_COOKIE, hash_token
from app.config import Settings
from app.db import User
from app.main import create_app

PASSWORD = "correct horse battery"
SIGNUP = {
    "display_name": "Ada Lovelace",
    "email": "ada@example.com",
    "password": PASSWORD,
}


def signup(client: TestClient, **overrides: object):
    payload = {**SIGNUP, **overrides}
    return client.post("/api/auth/signup", json=payload)


def login(client: TestClient, email: str = "ada@example.com", password: str = PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def set_cookie_header(response) -> str:
    header = response.headers.get("set-cookie", "")
    assert header, "no cookie was set"
    return header.lower()


def session_rows(client: TestClient) -> int:
    with client.app.state.session_factory() as session:
        return session.execute(text("SELECT COUNT(*) FROM auth_sessions")).scalar() or 0


# ------------------------------------------------------------------- sign-up


def test_signup_creates_an_account_and_signs_the_user_in(db_client: TestClient) -> None:
    response = signup(db_client)

    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "ada@example.com"
    assert body["user"]["display_name"] == "Ada Lovelace"
    assert body["redirect_to"] == "/today"
    assert SESSION_COOKIE in response.cookies

    with db_client.app.state.session_factory() as session:
        assert session.execute(text("SELECT COUNT(*) FROM users")).scalar() == 1


def test_the_session_cookie_is_hardened(db_client: TestClient) -> None:
    header = set_cookie_header(signup(db_client))

    assert "httponly" in header
    assert "samesite=lax" in header
    assert "path=/" in header
    # Secure only under TLS, or the local demo could not sign in at all.
    assert "secure" not in header


def test_the_cookie_is_secure_in_production(db_settings: Settings) -> None:
    production = db_settings.model_copy(
        update={
            "environment": "production",
            "secret_key": "x" * 32,
            "llm_api_key": "y" * 32,
            "llm_model": "a-model",
        }
    )

    with TestClient(create_app(production)) as client:
        header = set_cookie_header(signup(client))

    assert "secure" in header


def test_a_duplicate_email_is_a_clear_conflict(db_client: TestClient) -> None:
    signup(db_client)

    response = signup(db_client, email="ada@example.com")

    assert response.status_code == 409
    assert response.json()["detail"] == "An account with that email already exists."
    assert "Traceback" not in response.text


def test_duplicate_detection_ignores_case(db_client: TestClient) -> None:
    signup(db_client)

    response = signup(db_client, email="Ada@Example.com")

    assert response.status_code == 409


def test_the_email_is_stored_in_lower_case(db_client: TestClient) -> None:
    response = signup(db_client, email="  Ada@Example.COM ")

    assert response.json()["user"]["email"] == "ada@example.com"


def test_a_short_password_is_rejected_server_side(db_client: TestClient) -> None:
    response = signup(db_client, password="short12")

    assert response.status_code == 422
    assert "at least 8 characters" in response.text.lower()

    with db_client.app.state.session_factory() as session:
        assert session.execute(text("SELECT COUNT(*) FROM users")).scalar() == 0


def test_an_absurdly_long_password_is_rejected(db_client: TestClient) -> None:
    assert signup(db_client, password="x" * 200).status_code == 422


@pytest.mark.parametrize(
    "email", ["not-an-email", "two@@example.com", "no-domain@", "a b@example.com"]
)
def test_an_invalid_email_is_rejected(db_client: TestClient, email: str) -> None:
    response = signup(db_client, email=email)

    assert response.status_code == 422
    assert "valid email" in response.text.lower()


@pytest.mark.parametrize("name", ["", " ", "a"])
def test_a_blank_or_single_letter_name_is_rejected(db_client: TestClient, name: str) -> None:
    assert signup(db_client, display_name=name).status_code == 422


def test_the_display_name_is_tidied(db_client: TestClient) -> None:
    response = signup(db_client, display_name="  Ada   Lovelace  ")

    assert response.json()["user"]["display_name"] == "Ada Lovelace"


# --------------------------------------------------------------- password stay


def test_the_password_is_never_stored_as_written(db_client: TestClient) -> None:
    signup(db_client)

    with db_client.app.state.session_factory() as session:
        user = session.query(User).one()

    assert user.password_hash != PASSWORD
    assert PASSWORD not in user.password_hash


def test_the_hash_verifies_the_right_password(db_client: TestClient) -> None:
    from app.auth.passwords import hash_password, verify_password

    signup(db_client)

    with db_client.app.state.session_factory() as session:
        user = session.query(User).one()

    assert verify_password(PASSWORD, user.password_hash)
    assert not verify_password("something else", user.password_hash)
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


def test_no_response_ever_contains_the_password_or_hash(db_client: TestClient) -> None:
    created = signup(db_client)
    logged_in = login(db_client)
    me = db_client.get("/api/auth/me")

    with db_client.app.state.session_factory() as session:
        stored_hash = session.query(User).one().password_hash

    for response in (created, logged_in, me):
        body = response.text
        assert PASSWORD not in body
        assert stored_hash not in body
        assert "password" not in body.lower()


def test_the_password_never_reaches_the_logs(
    db_client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        signup(db_client)
        login(db_client)

    assert PASSWORD not in caplog.text


# --------------------------------------------------------------------- log in


def test_login_returns_the_user_and_a_session(db_client: TestClient) -> None:
    signup(db_client)
    db_client.cookies.clear()

    response = login(db_client)

    assert response.status_code == 200
    assert response.json()["user"]["display_name"] == "Ada Lovelace"
    assert SESSION_COOKIE in response.cookies


def test_login_accepts_a_different_email_case(db_client: TestClient) -> None:
    signup(db_client)
    db_client.cookies.clear()

    assert login(db_client, email="ADA@EXAMPLE.COM").status_code == 200


def test_a_wrong_password_is_refused_without_a_session(db_client: TestClient) -> None:
    signup(db_client)
    db_client.cookies.clear()

    response = login(db_client, password="not the right one")

    assert response.status_code == 401
    assert SESSION_COOKIE not in response.cookies


def test_an_unknown_email_is_indistinguishable_from_a_wrong_password(db_client: TestClient) -> None:
    signup(db_client)
    db_client.cookies.clear()

    wrong_password = login(db_client, password="not the right one")
    unknown_email = login(db_client, email="nobody@example.com")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_login_never_reveals_whether_an_account_exists(db_client: TestClient) -> None:
    response = login(db_client, email="nobody@example.com")

    assert response.status_code == 401
    assert "no such" not in response.text.lower()
    assert "email" not in response.json()["detail"].lower().replace("email and password", "")


# ------------------------------------------------------------------- session


def test_a_signed_in_user_can_read_their_account(db_client: TestClient) -> None:
    signup(db_client)

    response = db_client.get("/api/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "ada@example.com"


def test_an_anonymous_request_gets_json_not_a_login_page(db_client: TestClient) -> None:
    response = db_client.get("/api/auth/me")

    assert response.status_code == 401
    assert response.headers["content-type"].startswith("application/json")
    assert "<!doctype html" not in response.text.lower()


def test_a_tampered_token_is_refused(db_client: TestClient) -> None:
    signup(db_client)

    response = db_client.get(
        "/api/auth/me", headers={"cookie": f"{SESSION_COOKIE}=not-a-real-token"}
    )

    assert response.status_code == 401


def test_the_token_is_stored_only_as_a_hash(db_client: TestClient) -> None:
    response = signup(db_client)
    token = response.cookies[SESSION_COOKIE]

    with db_client.app.state.session_factory() as session:
        stored = session.execute(text("SELECT token_hash FROM auth_sessions")).scalar()

    assert stored != token
    assert stored == hash_token(token)


def test_an_expired_session_is_refused(db_client: TestClient) -> None:
    signup(db_client)

    with db_client.app.state.session_factory() as session:
        # Move the whole session window into the past; the schema refuses to let
        # expiry precede creation, which is the point.
        session.execute(
            text(
                "UPDATE auth_sessions SET created_at = '2020-01-01 00:00:00.000000', "
                "expires_at = '2020-01-02 00:00:00.000000'"
            )
        )
        session.commit()

    response = db_client.get("/api/auth/me")

    assert response.status_code == 401


def test_signing_out_ends_the_session_on_the_server(db_client: TestClient) -> None:
    response = signup(db_client)
    token = response.cookies[SESSION_COOKIE]

    assert db_client.post("/api/auth/logout").status_code == 204
    assert session_rows(db_client) == 0

    # Replaying the old cookie must not work, even if a browser kept it.
    replay = db_client.get("/api/auth/me", headers={"cookie": f"{SESSION_COOKIE}={token}"})

    assert replay.status_code == 401


def test_signing_out_twice_is_harmless(db_client: TestClient) -> None:
    signup(db_client)

    assert db_client.post("/api/auth/logout").status_code == 204
    assert db_client.post("/api/auth/logout").status_code == 204


def test_two_sessions_can_coexist_for_one_account(db_client: TestClient) -> None:
    first = signup(db_client).cookies[SESSION_COOKIE]

    other = TestClient(db_client.app)
    second = other.post(
        "/api/auth/login", json={"email": "ada@example.com", "password": PASSWORD}
    ).cookies[SESSION_COOKIE]

    assert first != second
    assert db_client.get("/api/auth/me").status_code == 200
    assert other.get("/api/auth/me").status_code == 200


# ------------------------------------------------------------------ redirects


@pytest.mark.parametrize(
    ("requested", "expected"),
    [
        ("/progress", "/progress"),
        ("/today?x=1", "/today?x=1"),
        (None, "/today"),
        ("", "/today"),
        ("https://evil.example/steal", "/today"),
        ("//evil.example/steal", "/today"),
        ("/\\evil.example", "/today"),
        ("javascript:alert(1)", "/today"),
    ],
)
def test_return_paths_cannot_leave_the_site(
    db_client: TestClient, requested: str | None, expected: str
) -> None:
    signup(db_client)
    db_client.cookies.clear()

    payload = {"email": "ada@example.com", "password": PASSWORD}
    if requested is not None:
        payload["next"] = requested

    assert db_client.post("/api/auth/login", json=payload).json()["redirect_to"] == expected


# --------------------------------------------------------------------- origin


def test_a_cross_site_post_is_refused(db_client: TestClient) -> None:
    response = db_client.post(
        "/api/auth/signup",
        json=SIGNUP,
        headers={"origin": "https://evil.example"},
    )

    assert response.status_code == 403


def test_a_same_origin_post_is_allowed(db_client: TestClient) -> None:
    response = db_client.post(
        "/api/auth/signup",
        json=SIGNUP,
        headers={"origin": "http://testserver"},
    )

    assert response.status_code == 201


def test_reading_is_not_blocked_by_origin_rules(db_client: TestClient) -> None:
    signup(db_client)

    response = db_client.get("/api/auth/me", headers={"origin": "https://evil.example"})

    assert response.status_code == 200
