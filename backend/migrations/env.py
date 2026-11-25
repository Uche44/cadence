"""Alembic environment.

The database URL comes from the environment (``CADENCE_DATABASE_URL``) or the
application settings, never from ``alembic.ini``, so migrations run against the
same database the app uses and no URL is committed.
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.db.models  # noqa: F401,E402  (imported for its side effect: table registration)
from app.config import get_settings  # noqa: E402
from app.db import Base  # noqa: E402
from app.db.base import StringList, UtcTimestamp  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def render_item(type_: str, obj: object, autogen_context: object) -> str | bool:
    """Render our custom column types as their underlying SQL types.

    A migration that imports ``app.db.base`` breaks the moment that module
    changes. Rendering ``sa.DateTime()`` and ``sa.Text()`` keeps every revision
    readable and independent of today's Python code.
    """
    if type_ == "type":
        if isinstance(obj, UtcTimestamp):
            return "sa.DateTime()"
        if isinstance(obj, StringList):
            return "sa.Text()"
    return False


def _database_url() -> str:
    configured = config.get_main_option("sqlalchemy.url")
    if configured:
        return configured
    return get_settings().database_url


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
        compare_type=True,
        render_item=render_item,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
            compare_type=True,
            render_item=render_item,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
