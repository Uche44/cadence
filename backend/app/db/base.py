"""Database foundation: engine, session, and the column types we rely on.

Two decisions live here that the rest of the schema inherits:

* **Timestamps are stored in UTC and read back timezone-aware.** SQLite has no
  timezone type, so a type decorator normalises on write and re-attaches UTC on
  read. A naive datetime is rejected rather than silently assumed to be local.
* **SQLite must enforce what we ask it to.** Foreign keys are off by default, so
  every connection turns them on, enables WAL for concurrent readers, and keeps
  a busy timeout. Integrity that only exists in Python is not integrity.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager, suppress
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import DateTime, Text, TypeDecorator

BUSY_TIMEOUT_MS = 5000


class UtcTimestamp(TypeDecorator[datetime]):
    """A timezone-aware UTC datetime, stored in a timezone-less column."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            raise ValueError("timestamps must be timezone-aware")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


class StringList(TypeDecorator[list[str]]):
    """An ordered list of strings, stored as JSON.

    Order matters: conditions, interests and equipment are shown back to the user
    in the order they chose them.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: list[str] | None, dialect: Any) -> str:
        if value is None:
            return "[]"
        if not all(isinstance(item, str) for item in value):
            raise ValueError("list values must all be strings")
        return json.dumps(list(value))

    def process_result_value(self, value: str | None, dialect: Any) -> list[str]:
        if not value:
            return []
        loaded = json.loads(value)
        if not isinstance(loaded, list):
            raise ValueError("stored value is not a list")
        return [str(item) for item in loaded]


class Base(DeclarativeBase):
    """Declarative base for every table in the product."""


def create_engine_for(url: str, *, echo: bool = False) -> Engine:
    engine = create_engine(url, echo=echo, future=True)
    if url.startswith("sqlite"):
        _install_sqlite_pragmas(engine)
    return engine


def _install_sqlite_pragmas(engine: Engine) -> None:
    @event.listens_for(engine, "connect")
    def _set_pragmas(dbapi_connection: sqlite3.Connection, _record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute(f"PRAGMA busy_timeout={BUSY_TIMEOUT_MS}")
        # Switching journal mode needs a brief exclusive lock. If another
        # connection is mid-write the database is already in WAL mode, which is
        # the outcome we wanted anyway.
        with suppress(sqlite3.OperationalError):
            cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, future=True)


@contextmanager
def session_scope(factory: sessionmaker[Session]) -> Iterator[Session]:
    """A transaction per unit of work: commit on success, roll back on error."""
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
