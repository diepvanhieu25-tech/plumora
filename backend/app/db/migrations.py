"""Versioned schema migrations for Plumora PostgreSQL database (H2)."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)


def _migration_0001(conn: Connection) -> None:
    """Initial schema marker (tables created via Base.metadata.create_all)."""
    # Table creation is handled idempotently by create_all


def _migration_0002(conn: Connection) -> None:
    """Add state_version and newly_unlocked_json columns to quiz_attempts without defaults."""
    if conn.dialect.name == "sqlite":
        cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(quiz_attempts);")).fetchall()
        }
        if "state_version" not in cols:
            conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN state_version INTEGER;"))
        if "newly_unlocked_json" not in cols:
            conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN newly_unlocked_json TEXT;"))
    else:
        conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS state_version INTEGER;"))
        conn.execute(
            text("ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS newly_unlocked_json JSONB;")
        )


def _migration_0003(conn: Connection) -> None:
    """Drop any legacy fake defaults (DEFAULT 1, DEFAULT '[]'::jsonb) from quiz_attempts."""
    if conn.dialect.name != "sqlite":
        conn.execute(text("ALTER TABLE quiz_attempts ALTER COLUMN state_version DROP DEFAULT;"))
        conn.execute(text("ALTER TABLE quiz_attempts ALTER COLUMN newly_unlocked_json DROP DEFAULT;"))


MIGRATIONS: list[tuple[str, Callable[[Connection], None]]] = [
    ("0001_initial_schema", _migration_0001),
    ("0002_add_quiz_attempt_state_version_and_unlocked", _migration_0002),
    ("0003_drop_legacy_attempt_defaults", _migration_0003),
]


def ensure_migrations_table(conn: Connection) -> None:
    """Ensure schema_migrations tracking table exists."""
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(64) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL
            );
            """
        )
    )


def run_database_migrations(engine: Engine) -> list[str]:
    """Execute all pending versioned migrations in order.

    Strictly fails and raises RuntimeError on any migration error.
    Never swallows migration exceptions.
    """
    applied_versions: list[str] = []
    try:
        with engine.begin() as conn:
            ensure_migrations_table(conn)
            rows = conn.execute(
                text("SELECT version FROM schema_migrations ORDER BY version")
            ).fetchall()
            existing = {r[0] for r in rows}

            for version, migration_fn in MIGRATIONS:
                if version in existing:
                    continue
                logger.info("Applying database migration %s...", version)
                migration_fn(conn)
                conn.execute(
                    text("INSERT INTO schema_migrations (version, applied_at) VALUES (:v, :now)"),
                    {"v": version, "now": datetime.now(UTC)},
                )
                applied_versions.append(version)
                logger.info("Applied database migration %s successfully.", version)
    except SQLAlchemyError as exc:
        logger.error("Database migration execution failed: %s", exc)
        raise RuntimeError(f"Database migration failed: {exc}") from exc

    return applied_versions
