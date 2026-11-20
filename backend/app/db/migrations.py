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


def _migration_0004(conn: Connection) -> None:
    """Add role column to users for Phase 3 RBAC (Expand migration)."""
    if conn.dialect.name == "sqlite":
        cols = {row[1] for row in conn.execute(text("PRAGMA table_info(users);")).fetchall()}
        if cols and "role" not in cols:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN role VARCHAR(16) NOT NULL DEFAULT 'learner';")
            )
    else:
        conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) NOT NULL DEFAULT 'learner';"
            )
        )


def _migration_0005(conn: Connection) -> None:
    """Create 4 isolated PostgreSQL schemas (auth_svc, content_svc, assess_svc, rec_ai_svc) and roles."""
    if conn.dialect.name == "sqlite":
        return

    schemas_and_roles = [
        ("auth_svc", "auth_role"),
        ("content_svc", "content_role"),
        ("assess_svc", "assess_role"),
        ("rec_ai_svc", "rec_ai_role"),
    ]
    for schema_name, role_name in schemas_and_roles:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
        conn.execute(
            text(
                f"CREATE TABLE IF NOT EXISTS {schema_name}.service_marker ("
                "service_name VARCHAR(64) PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
            )
        )
        conn.execute(
            text(
                f"INSERT INTO {schema_name}.service_marker (service_name) "
                f"VALUES ('{schema_name}') ON CONFLICT DO NOTHING;"
            )
        )
        conn.execute(
            text(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{role_name}') THEN
                        CREATE ROLE {role_name} NOLOGIN;
                    END IF;
                END
                $$;
                """
            )
        )

    # Grant each role strictly to its own schema & revoke cross-schema access
    for owner_schema, role_name in schemas_and_roles:
        for target_schema, _ in schemas_and_roles:
            conn.execute(text(f"REVOKE ALL ON SCHEMA {target_schema} FROM {role_name};"))
            conn.execute(
                text(f"REVOKE ALL ON ALL TABLES IN SCHEMA {target_schema} FROM {role_name};")
            )
        conn.execute(text(f"GRANT USAGE ON SCHEMA {owner_schema} TO {role_name};"))
        conn.execute(
            text(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {owner_schema} TO {role_name};"
            )
        )


def _migration_0006(conn: Connection) -> None:
    """Add performance indexes for outbox_events, model_registry, assessment_sessions, online_eval_runs."""
    index_specs = [
        (
            "outbox_events",
            "CREATE INDEX IF NOT EXISTS idx_outbox_events_unpublished_created ON outbox_events (published_at, created_at);",
        ),
        (
            "model_registry",
            "CREATE INDEX IF NOT EXISTS idx_model_registry_active_created ON model_registry (is_active, created_at);",
        ),
        (
            "assessment_sessions",
            "CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user_mode_status ON assessment_sessions (user_id, session_mode, status);",
        ),
        (
            "online_eval_runs",
            "CREATE INDEX IF NOT EXISTS idx_online_eval_runs_candidate_model ON online_eval_runs (candidate_model_id);",
        ),
    ]
    if conn.dialect.name == "sqlite":
        existing_tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table';")
            ).fetchall()
        }
        for table_name, stmt in index_specs:
            if table_name in existing_tables:
                conn.execute(text(stmt))
    else:
        for _, stmt in index_specs:
            conn.execute(text(stmt))


MIGRATIONS: list[tuple[str, Callable[[Connection], None]]] = [
    ("0001_initial_schema", _migration_0001),
    ("0002_add_quiz_attempt_state_version_and_unlocked", _migration_0002),
    ("0003_drop_legacy_attempt_defaults", _migration_0003),
    ("0004_add_user_role_column", _migration_0004),
    ("0005_phase3_four_schemas_and_online_rl", _migration_0005),
    ("0006_add_performance_indexes", _migration_0006),
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
