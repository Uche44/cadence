"""The data layer.

These tests are about states the product must never be able to reach: an orphan
block, a completion with no session, two accounts on one email, a second
"done" record for the same session, a plan for a day that was never checked in.

Where possible they use raw SQL rather than the ORM, because a constraint that
only exists in Python is not a constraint — it is a convention someone will
forget.
"""

from __future__ import annotations

from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect, text
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.orm import Session

from app.config import Settings
from app.db import (
    AuthSession,
    BlockStatus,
    Checkin,
    Commitment,
    Completion,
    CompletionOutcome,
    Consent,
    Energy,
    FeltRating,
    Plan,
    PlanBlock,
    Profile,
    SymptomNote,
    User,
    create_engine_for,
    create_session_factory,
    session_scope,
)
from app.db.base import Base
from app.main import create_app
from app.safety.models import Intensity
from tests.support import BACKEND_DIR, upgrade_to_head

EXPECTED_TABLES = {
    "users",
    "profiles",
    "consents",
    "auth_sessions",
    "checkins",
    "commitments",
    "plans",
    "plan_blocks",
    "completions",
    "symptom_notes",
}


@pytest.fixture
def engine(database_url: str) -> Iterator[Engine]:
    upgrade_to_head(database_url)
    created = create_engine_for(database_url)
    try:
        yield created
    finally:
        created.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        yield active


# ------------------------------------------------------------------ migrations


def test_migrations_create_every_table(database_url: str) -> None:
    upgrade_to_head(database_url)
    engine = create_engine_for(database_url)

    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())

    engine.dispose()

    assert tables >= EXPECTED_TABLES


def test_migrations_are_safe_to_run_twice(database_url: str) -> None:
    upgrade_to_head(database_url)
    upgrade_to_head(database_url)  # must be a no-op, not an error

    engine = create_engine_for(database_url)
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
    engine.dispose()

    assert tables >= EXPECTED_TABLES


def test_migrations_can_be_reverted(database_url: str) -> None:
    upgrade_to_head(database_url)

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    command.downgrade(config, "base")

    engine = create_engine_for(database_url)
    with engine.connect() as connection:
        tables = set(inspect(connection).get_table_names())
    engine.dispose()

    assert not (EXPECTED_TABLES & tables)


def test_models_match_the_migrated_schema(engine: Engine) -> None:
    """Drift between models and migrations is a silent production break."""
    with engine.connect() as connection:
        inspector = inspect(connection)
        migrated_tables = set(inspector.get_table_names())

        assert migrated_tables >= EXPECTED_TABLES
        assert migrated_tables - EXPECTED_TABLES == {"alembic_version"}

        for table_name, table in Base.metadata.tables.items():
            migrated_columns = {column["name"] for column in inspector.get_columns(table_name)}
            assert {column.name for column in table.columns} == migrated_columns


# --------------------------------------------------------------- sqlite config


def test_foreign_keys_are_enforced(engine: Engine) -> None:
    with engine.connect() as connection:
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1


def test_write_ahead_logging_is_enabled(engine: Engine) -> None:
    with engine.connect() as connection:
        mode = connection.execute(text("PRAGMA journal_mode")).scalar()

    assert str(mode).lower() == "wal"


# ------------------------------------------------------------------- fixtures


def make_user(session: Session, email: str = "ada@example.com") -> User:
    user = User(email=email, password_hash="hash", display_name="Ada")
    session.add(user)
    session.flush()
    return user


def make_profile(session: Session, user: User) -> Profile:
    profile = Profile(
        user_id=user.id,
        conditions=["hypertension", "asthma"],
        interests=["music", "walking", "gardening"],
        equipment=["chair", "resistance bands"],
        wake_minute=390,
        bed_minute=1335,
        doctor_clearance=True,
    )
    session.add(profile)
    session.flush()
    return profile


def make_day(session: Session, user: User) -> tuple[Checkin, Plan, list[PlanBlock]]:
    checkin = Checkin(
        user_id=user.id,
        local_date=date(2026, 11, 25),
        energy=Energy.STEADY,
        symptoms=["slept badly"],
        notes="ward shift",
    )
    session.add(checkin)
    session.flush()

    session.add(
        Commitment(checkin_id=checkin.id, label="Hospital shift", start_minute=420, end_minute=930)
    )

    plan = Plan(checkin_id=checkin.id, pack_ids=["baseline", "hypertension"])
    session.add(plan)
    session.flush()

    blocks = [
        PlanBlock(
            plan_id=plan.id,
            position=0,
            title="Morning walk",
            intensity=Intensity.LOW,
            start_minute=540,
            end_minute=555,
            tags=["walking"],
            linked_interest="walking",
        ),
        PlanBlock(
            plan_id=plan.id,
            position=1,
            title="Seated mobility",
            intensity=Intensity.LOW,
            start_minute=960,
            end_minute=975,
            tags=["mobility"],
        ),
    ]
    session.add_all(blocks)
    session.flush()

    session.add(
        Completion(
            block_id=blocks[0].id,
            outcome=CompletionOutcome.DONE,
            felt_rating=FeltRating.JUST_RIGHT,
        )
    )
    session.flush()

    return checkin, plan, blocks


# ------------------------------------------------------------------- integrity


def test_an_orphan_block_is_rejected_by_the_database(engine: Engine) -> None:
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO plan_blocks "
                "(id, plan_id, position, title, intensity, start_minute, end_minute, tags, status) "
                "VALUES ('b1', 'no-such-plan', 0, 'Walk', 'low', 540, 555, '[]', 'planned')"
            )
        )


def test_a_duplicate_email_is_rejected(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        make_user(active, "ada@example.com")

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        make_user(active, "ada@example.com")


def test_an_email_is_stored_in_lower_case(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active, "  Ada@Example.COM  ")

    assert user.email == "ada@example.com"


def test_email_uniqueness_ignores_case_in_the_database(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        make_user(active, "ada@example.com")

    # Raw SQL bypasses the ORM validator, so this proves the column collation.
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users "
                "(id, email, password_hash, display_name, created_at, updated_at) "
                "VALUES ('u2', 'ADA@Example.com', 'hash', 'Ada', "
                "'2026-11-25 09:00:00.000000', '2026-11-25 09:00:00.000000')"
            )
        )


def test_a_second_profile_for_one_user_is_rejected(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        make_profile(active, user)

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        make_profile(active, active.get(User, user.id))


def test_a_checkin_can_only_exist_once_per_local_day(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        active.add(Checkin(user_id=user.id, local_date=date(2026, 11, 25), energy=Energy.STEADY))

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        active.add(Checkin(user_id=user.id, local_date=date(2026, 11, 25), energy=Energy.HIGH))


def test_a_checkin_can_only_have_one_plan(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        checkin, _plan, _blocks = make_day(active, user)

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        active.add(Plan(checkin_id=checkin.id))


def test_a_block_can_only_be_completed_once(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        _checkin, _plan, blocks = make_day(active, user)

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        active.add(Completion(block_id=blocks[1].id, outcome=CompletionOutcome.SKIPPED))
        active.flush()
        active.add(Completion(block_id=blocks[1].id, outcome=CompletionOutcome.DONE))


def test_a_consent_is_unique_per_version(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        active.add(Consent(user_id=user.id, version="2026-11"))

    with session_scope(factory) as active:
        active.add(Consent(user_id=user.id, version="2026-12"))

    with pytest.raises(IntegrityError), session_scope(factory) as active:
        active.add(Consent(user_id=user.id, version="2026-11"))


def test_an_unknown_block_status_is_rejected_by_the_database(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        _checkin, _plan, blocks = make_day(active, user)
        block_id = blocks[0].id

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text("UPDATE plan_blocks SET status = 'cancelled' WHERE id = :id"),
            {"id": block_id},
        )


def test_a_backwards_commitment_is_rejected(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        checkin = Checkin(user_id=user.id, local_date=date(2026, 11, 25), energy=Energy.LOW)
        active.add(checkin)
        active.flush()
        checkin_id = checkin.id

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO commitments (id, checkin_id, label, start_minute, end_minute) "
                "VALUES ('c1', :checkin, 'Bad', 600, 500)"
            ),
            {"checkin": checkin_id},
        )


def test_a_bedtime_before_wake_time_is_rejected(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        user_id = user.id

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO profiles "
                "(id, user_id, conditions, interests, equipment, wake_minute, bed_minute, "
                "doctor_clearance, onboarding_step, updated_at) "
                "VALUES ('p1', :user, '[]', '[]', '[]', 1300, 400, 0, 1, "
                "'2026-11-25 09:00:00.000000')"
            ),
            {"user": user_id},
        )


def test_a_session_must_expire_after_it_begins(engine: Engine) -> None:
    factory = create_session_factory(engine)
    with session_scope(factory) as active:
        user = make_user(active)
        user_id = user.id

    now = datetime(2026, 11, 25, 8, 0, tzinfo=UTC)
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO auth_sessions (id, user_id, token_hash, created_at, expires_at) "
                "VALUES ('s1', :user, 'abc', :created, :expires)"
            ),
            {
                "user": user_id,
                "created": now.strftime("%Y-%m-%d %H:%M:%S.%f"),
                "expires": (now - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S.%f"),
            },
        )


# ------------------------------------------------------------------- cascades


def test_deleting_a_user_removes_everything_they_own(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        make_profile(active, user)
        active.add(Consent(user_id=user.id, version="2026-11"))
        active.add(
            AuthSession(
                user_id=user.id,
                token_hash="token-hash",
                expires_at=datetime.now(UTC) + timedelta(days=1),
            )
        )
        _checkin, _plan, _blocks = make_day(active, user)
        active.add(SymptomNote(user_id=user.id, note="felt lightheaded", checkin_id=None))
        user_id = user.id

    # Delete with raw SQL so this proves the database cascades, not the ORM.
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})

    with engine.connect() as connection:
        for table in EXPECTED_TABLES:
            remaining = connection.execute(
                text(f"SELECT COUNT(*) FROM {table}"),
            ).scalar()
            assert remaining == 0, f"{table} still has rows"


def test_deleting_a_checkin_keeps_the_user(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        checkin, _plan, _blocks = make_day(active, user)
        user_id, checkin_id = user.id, checkin.id

    with engine.begin() as connection:
        connection.execute(text("DELETE FROM checkins WHERE id = :id"), {"id": checkin_id})

    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM users")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM plans")).scalar() == 0
        assert connection.execute(text("SELECT COUNT(*) FROM plan_blocks")).scalar() == 0
        assert connection.execute(text("SELECT COUNT(*) FROM completions")).scalar() == 0
        assert connection.execute(text("SELECT COUNT(*) FROM commitments")).scalar() == 0
        assert (
            connection.execute(
                text("SELECT COUNT(*) FROM users WHERE id = :id"), {"id": user_id}
            ).scalar()
            == 1
        )


def test_a_symptom_note_survives_its_checkin(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        checkin = Checkin(user_id=user.id, local_date=date(2026, 11, 25), energy=Energy.LOW)
        active.add(checkin)
        active.flush()
        active.add(SymptomNote(user_id=user.id, checkin_id=checkin.id, note="dizzy at 3pm"))
        checkin_id = checkin.id

    with engine.begin() as connection:
        connection.execute(text("DELETE FROM checkins WHERE id = :id"), {"id": checkin_id})

    with engine.connect() as connection:
        row = connection.execute(text("SELECT checkin_id, note FROM symptom_notes")).one()

    assert row.checkin_id is None
    assert row.note == "dizzy at 3pm"


# ------------------------------------------------------------------ round trip


def test_list_fields_survive_a_round_trip_in_order(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        make_profile(active, user)
        user_id = user.id

    with session_scope(factory) as active:
        profile = active.query(Profile).filter_by(user_id=user_id).one()

        assert profile.conditions == ["hypertension", "asthma"]
        assert profile.interests == ["music", "walking", "gardening"]
        assert profile.equipment == ["chair", "resistance bands"]


def test_an_empty_list_reads_back_as_an_empty_list(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        active.add(Profile(user_id=user.id))
        user_id = user.id

    with session_scope(factory) as active:
        profile = active.query(Profile).filter_by(user_id=user_id).one()

        assert profile.conditions == []
        assert profile.interests == []


def test_timestamps_are_stored_in_utc_and_read_back_aware(engine: Engine) -> None:
    factory = create_session_factory(engine)
    written = datetime(2026, 11, 25, 14, 30, tzinfo=UTC)

    with session_scope(factory) as active:
        user = make_user(active)
        user.created_at = written
        user_id = user.id

    with session_scope(factory) as active:
        stored = active.get(User, user_id).created_at

    assert stored.tzinfo is not None
    assert stored.utcoffset() == timedelta(0)
    assert stored == written


def test_a_timezone_aware_timestamp_is_normalised_to_utc(engine: Engine) -> None:
    factory = create_session_factory(engine)
    # 09:00 in a +02:00 zone is 07:00 UTC.
    local = datetime(2026, 11, 25, 9, 0, tzinfo=timezone(timedelta(hours=2)))

    with session_scope(factory) as active:
        user = make_user(active)
        user.created_at = local
        user_id = user.id

    with session_scope(factory) as active:
        stored = active.get(User, user_id).created_at

    assert stored == datetime(2026, 11, 25, 7, 0, tzinfo=UTC)


def test_a_naive_timestamp_is_rejected(engine: Engine) -> None:
    factory = create_session_factory(engine)

    # SQLAlchemy wraps the type error on flush; what matters is that the write
    # cannot silently store a local time as if it were UTC.
    with (
        pytest.raises(StatementError, match="timezone-aware"),
        session_scope(factory) as active,
    ):
        user = make_user(active)
        user.created_at = datetime(2026, 11, 25, 9, 0)
        active.flush()


def test_minute_fields_round_trip_exactly(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        _checkin, plan, _blocks = make_day(active, user)
        plan_id = plan.id

    with session_scope(factory) as active:
        blocks = (
            active.query(PlanBlock).filter_by(plan_id=plan_id).order_by(PlanBlock.position).all()
        )

    assert [(block.start_minute, block.end_minute) for block in blocks] == [
        (540, 555),
        (960, 975),
    ]


def test_enums_round_trip_as_their_values(engine: Engine) -> None:
    factory = create_session_factory(engine)

    with session_scope(factory) as active:
        user = make_user(active)
        checkin, _plan, blocks = make_day(active, user)
        checkin_id, block_id = checkin.id, blocks[1].id

    with session_scope(factory) as active:
        stored_checkin = active.get(Checkin, checkin_id)
        stored_block = active.get(PlanBlock, block_id)
        newest = active.query(Completion).one()

    assert stored_checkin.energy is Energy.STEADY
    assert stored_block.intensity is Intensity.LOW
    assert stored_block.status is BlockStatus.PLANNED
    assert newest.outcome is CompletionOutcome.DONE
    assert newest.felt_rating is FeltRating.JUST_RIGHT


# ---------------------------------------------------------------- concurrency


def test_two_concurrent_writers_do_not_corrupt_the_database(database_url: str) -> None:
    upgrade_to_head(database_url)

    def write(index: int) -> None:
        engine = create_engine_for(database_url)
        factory = create_session_factory(engine)
        try:
            with session_scope(factory) as active:
                active.add(
                    User(
                        email=f"writer{index}@example.com",
                        password_hash="hash",
                        display_name=f"Writer {index}",
                    )
                )
        finally:
            engine.dispose()

    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(write, range(2)))

    engine = create_engine_for(database_url)
    with engine.connect() as connection:
        count = connection.execute(text("SELECT COUNT(*) FROM users")).scalar()
        integrity = connection.execute(text("PRAGMA integrity_check")).scalar()
    engine.dispose()

    assert count == 2
    assert integrity == "ok"


def test_the_app_exposes_a_working_session_factory(database_url: str, static_dir: Path) -> None:
    upgrade_to_head(database_url)

    app = create_app(
        Settings(
            environment="test",
            database_url=database_url,
            static_dir=static_dir,
            _env_file=None,
        )
    )

    with session_scope(app.state.session_factory) as active:
        active.add(User(email="boot@example.com", password_hash="hash", display_name="Boot"))

    with session_scope(app.state.session_factory) as active:
        assert active.query(User).count() == 1
