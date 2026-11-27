"""Versioned schema migrations for Plumora PostgreSQL database (H2)."""

from __future__ import annotations

import logging
import os
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import Connection, Engine, text
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

_SVC_ROLE_PASSWORD_ENV: dict[str, str] = {
    "auth_svc_user": "AUTH_DB_PASSWORD",
    "content_svc_user": "CONTENT_DB_PASSWORD",
    "assess_svc_user": "ASSESS_DB_PASSWORD",
    "rec_ai_svc_user": "REC_AI_DB_PASSWORD",
}
_LOCAL_DEV_DB_FALLBACK = "plumora_dev_pass_local_only"  # noqa: S105


def resolve_service_role_password(login_user: str) -> str:
    """Resolve per-service PostgreSQL LOGIN role password from env; fail fast in production."""
    env_var = _SVC_ROLE_PASSWORD_ENV.get(login_user)
    if env_var is None:
        raise RuntimeError(f"Unknown service role: {login_user}")
    val = os.environ.get(env_var, "").strip()
    if val:
        return val
    app_env = os.environ.get("APP_ENV", "development").strip().lower()
    if app_env == "production":
        raise RuntimeError(
            f"{env_var} must be set in production environment for DB role '{login_user}'."
        )
    return _LOCAL_DEV_DB_FALLBACK


def _migration_0001(conn: Connection) -> None:
    """Initial schema marker (tables created via Base.metadata.create_all)."""
    # Table creation is handled idempotently by create_all


def _migration_0002(conn: Connection) -> None:
    """Add state_version and newly_unlocked_json columns to quiz_attempts if legacy table exists."""
    if conn.dialect.name == "sqlite":
        cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(quiz_attempts);")).fetchall()
        }
        if cols:
            if "state_version" not in cols:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN state_version INTEGER;"))
            if "newly_unlocked_json" not in cols:
                conn.execute(text("ALTER TABLE quiz_attempts ADD COLUMN newly_unlocked_json TEXT;"))
    else:
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS quiz_attempts ADD COLUMN IF NOT EXISTS state_version INTEGER;"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE IF EXISTS quiz_attempts ADD COLUMN IF NOT EXISTS newly_unlocked_json JSONB;"
            )
        )


def _migration_0003(conn: Connection) -> None:
    """Drop any legacy fake defaults (DEFAULT 1, DEFAULT '[]'::jsonb) from quiz_attempts if present."""
    if conn.dialect.name != "sqlite":
        exists = conn.execute(text("SELECT to_regclass('quiz_attempts') IS NOT NULL")).scalar()
        if exists:
            conn.execute(text("ALTER TABLE quiz_attempts ALTER COLUMN state_version DROP DEFAULT;"))
            conn.execute(
                text("ALTER TABLE quiz_attempts ALTER COLUMN newly_unlocked_json DROP DEFAULT;")
            )


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
                f"INSERT INTO {schema_name}.service_marker (service_name) "  # noqa: S608
                "VALUES (:svc) ON CONFLICT DO NOTHING;"
            ),
            {"svc": schema_name},
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
                """  # noqa: S608
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


def _migration_0007(conn: Connection) -> None:
    """Move application tables into their 4 owning schemas and configure per-service LOGIN roles."""
    if conn.dialect.name != "postgresql":
        return

    table_ownership: list[tuple[str, str]] = [
        ("auth_svc", "users"),
        ("content_svc", "domains"),
        ("content_svc", "concepts"),
        ("content_svc", "concept_prerequisites"),
        ("content_svc", "domain_concept_map"),
        ("content_svc", "quiz_questions"),
        ("content_svc", "depth_questions"),
        ("content_svc", "grading_rubrics"),
        ("content_svc", "code_challenges"),
        ("assess_svc", "user_concept_mastery"),
        ("assess_svc", "quiz_attempts"),
        ("assess_svc", "user_node_competency"),
        ("assess_svc", "assessment_sessions"),
        ("assess_svc", "attempt_records"),
        ("assess_svc", "outbox_events"),
        ("rec_ai_svc", "recommendation_logs"),
        ("rec_ai_svc", "rl_experience_buffer"),
        ("rec_ai_svc", "model_registry"),
        ("rec_ai_svc", "online_eval_runs"),
        ("rec_ai_svc", "consumed_events"),
    ]
    for schema_name, tbl_name in table_ownership:
        conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name};"))
        conn.execute(
            text(
                f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = '{tbl_name}'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = '{schema_name}' AND table_name = '{tbl_name}'
                    ) THEN
                        EXECUTE 'ALTER TABLE public.{tbl_name} SET SCHEMA {schema_name}';
                    END IF;
                END
                $$;
                """  # noqa: S608
            )
        )

    svc_users = [
        ("auth_svc", "auth_svc_user"),
        ("content_svc", "content_svc_user"),
        ("assess_svc", "assess_svc_user"),
        ("rec_ai_svc", "rec_ai_svc_user"),
    ]
    for owner_schema, login_user in svc_users:
        role_pw = resolve_service_role_password(login_user)
        pw_sql_lit = role_pw.replace("'", "''")
        conn.execute(
            text(
                f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{login_user}') THEN
                        CREATE ROLE {login_user} LOGIN PASSWORD '{pw_sql_lit}';
                    ELSE
                        ALTER ROLE {login_user} WITH PASSWORD '{pw_sql_lit}';
                    END IF;
                END
                $$;
                """  # noqa: S608
            )
        )
        for target_schema, _ in svc_users:
            conn.execute(text(f"REVOKE ALL ON SCHEMA {target_schema} FROM {login_user};"))
            conn.execute(text(f"REVOKE ALL ON ALL TABLES IN SCHEMA {target_schema} FROM {login_user};"))
        conn.execute(text(f"GRANT USAGE ON SCHEMA {owner_schema} TO {login_user};"))
        conn.execute(
            text(
                f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA {owner_schema} TO {login_user};"
            )
        )
        conn.execute(text(f"ALTER ROLE {login_user} SET search_path TO {owner_schema};"))

    # Allow monolith owner role to resolve tables across all 4 schemas seamlessly (public last)
    conn.execute(
        text("ALTER ROLE CURRENT_USER SET search_path TO auth_svc, content_svc, assess_svc, rec_ai_svc, public;")
    )


def migrate_public_table_safely(conn: Connection, target_schema: str, table_name: str) -> None:
    """Preflight PK conflicts and dependent FKs before moving a public table into target_schema."""
    if conn.dialect.name != "postgresql":
        return
    public_exists = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_name = :tbl"
        ),
        {"tbl": table_name},
    ).scalar()
    target_exists = conn.execute(
        text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_schema = :schema AND table_name = :tbl"
        ),
        {"schema": target_schema, "tbl": table_name},
    ).scalar()
    if not public_exists or not target_exists:
        return

    pk_cols = list(
        conn.execute(
            text(
                """
                SELECT kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                  AND tc.table_schema = :schema
                  AND tc.table_name = :tbl
                ORDER BY kcu.ordinal_position
                """
            ),
            {"schema": target_schema, "tbl": table_name},
        ).scalars()
    )
    if pk_cols:
        join_cond = " AND ".join(f"p.{col} = t.{col}" for col in pk_cols)
        overlap_count = int(
            conn.execute(
                text(
                    f"SELECT COUNT(*) FROM public.{table_name} p "  # noqa: S608
                    f"JOIN {target_schema}.{table_name} t ON {join_cond}"
                )
            ).scalar()
            or 0
        )
        if overlap_count > 0:
            raise RuntimeError(
                f"Migration conflict: public.{table_name} has {overlap_count} "
                f"conflicting primary key row(s) with {target_schema}.{table_name}"
            )

    dep_fks = list(
        conn.execute(
            text(
                """
                SELECT tc.table_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.referential_constraints rc
                  ON tc.constraint_name = rc.constraint_name
                 AND tc.constraint_schema = rc.constraint_schema
                JOIN information_schema.table_constraints pk
                  ON rc.unique_constraint_name = pk.constraint_name
                 AND rc.unique_constraint_schema = pk.constraint_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND pk.table_schema = 'public'
                  AND pk.table_name = :tbl
                  AND tc.table_name <> :tbl
                """
            ),
            {"tbl": table_name},
        ).scalars()
    )
    if dep_fks:
        raise RuntimeError(
            f"Migration conflict: public.{table_name} has dependent FKs in public schema: {dep_fks}"
        )

    conn.execute(
        text(f"INSERT INTO {target_schema}.{table_name} SELECT * FROM public.{table_name};")  # noqa: S608
    )
    conn.execute(text(f"DROP TABLE public.{table_name};"))


def _migration_0008(conn: Connection) -> None:
    """Clean up duplicate tables in public schema if already present in owning service schemas."""
    if conn.dialect.name != "postgresql":
        return

    table_ownership: list[tuple[str, str]] = [
        ("auth_svc", "users"),
        ("content_svc", "domains"),
        ("content_svc", "concepts"),
        ("content_svc", "concept_prerequisites"),
        ("content_svc", "domain_concept_map"),
        ("content_svc", "quiz_questions"),
        ("content_svc", "depth_questions"),
        ("content_svc", "grading_rubrics"),
        ("content_svc", "code_challenges"),
        ("assess_svc", "user_concept_mastery"),
        ("assess_svc", "quiz_attempts"),
        ("assess_svc", "user_node_competency"),
        ("assess_svc", "assessment_sessions"),
        ("assess_svc", "attempt_records"),
        ("assess_svc", "outbox_events"),
        ("rec_ai_svc", "recommendation_logs"),
        ("rec_ai_svc", "rl_experience_buffer"),
        ("rec_ai_svc", "model_registry"),
        ("rec_ai_svc", "online_eval_runs"),
        ("rec_ai_svc", "consumed_events"),
    ]
    for schema_name, tbl_name in table_ownership:
        migrate_public_table_safely(conn, schema_name, tbl_name)
    conn.execute(
        text("ALTER ROLE CURRENT_USER SET search_path TO auth_svc, content_svc, assess_svc, rec_ai_svc, public;")
    )


def _migration_0009(conn: Connection) -> None:
    """Enforce single active model invariant via unique partial index (F10)."""
    if conn.dialect.name == "postgresql":
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS uq_model_registry_single_active "
                "ON rec_ai_svc.model_registry (is_active) WHERE is_active IS TRUE;"
            )
        )
    else:
        existing_tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table';")
            ).fetchall()
        }
        if "model_registry" in existing_tables:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_model_registry_single_active "
                    "ON model_registry (is_active) WHERE is_active = 1;"
                )
            )


def _migration_0010(conn: Connection) -> None:
    """Add per-schema outbox/consumed tables, drop cross-schema user FKs, and add v3 content/playbook columns."""
    if conn.dialect.name == "sqlite":
        existing_tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table';")
            ).fetchall()
        }
        if "user_node_competency" in existing_tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(user_node_competency);")).fetchall()
            }
            if "playbook_completed_at" not in cols:
                conn.execute(
                    text("ALTER TABLE user_node_competency ADD COLUMN playbook_completed_at DATETIME;")
                )
        if "depth_questions" in existing_tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(depth_questions);")).fetchall()
            }
            if "is_active" not in cols:
                conn.execute(
                    text("ALTER TABLE depth_questions ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;")
                )
            if "version" not in cols:
                conn.execute(
                    text("ALTER TABLE depth_questions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;")
                )
            if "display_order" not in cols:
                conn.execute(
                    text("ALTER TABLE depth_questions ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;")
                )
        if "code_challenges" in existing_tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(code_challenges);")).fetchall()
            }
            if "setup_sql" not in cols:
                conn.execute(text("ALTER TABLE code_challenges ADD COLUMN setup_sql TEXT;"))
            if "is_active" not in cols:
                conn.execute(
                    text("ALTER TABLE code_challenges ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;")
                )
            if "version" not in cols:
                conn.execute(
                    text("ALTER TABLE code_challenges ADD COLUMN version INTEGER NOT NULL DEFAULT 1;")
                )
            if "display_order" not in cols:
                conn.execute(
                    text("ALTER TABLE code_challenges ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;")
                )
        return

    # PostgreSQL: 1. Create content_svc.outbox_events and assess_svc.consumed_events
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS content_svc.outbox_events (
                id UUID PRIMARY KEY,
                event_id UUID UNIQUE NOT NULL,
                event_type VARCHAR(64) NOT NULL,
                stream_name VARCHAR(64) NOT NULL,
                payload_json JSONB NOT NULL,
                published_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_content_outbox_unpublished_created "
            "ON content_svc.outbox_events (published_at, created_at);"
        )
    )
    conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS assess_svc.consumed_events (
                event_id UUID PRIMARY KEY,
                consumer_group VARCHAR(64) NOT NULL,
                consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    )
    conn.execute(
        text(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON content_svc.outbox_events "
            "TO content_svc_user, content_role;"
        )
    )
    conn.execute(
        text(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON assess_svc.consumed_events "
            "TO assess_svc_user, assess_role;"
        )
    )

    # PostgreSQL: 2. Drop cross-schema Foreign Keys pointing to auth_svc.users
    for schema_name, tbl_name in (
        ("assess_svc", "user_concept_mastery"),
        ("assess_svc", "quiz_attempts"),
        ("assess_svc", "user_node_competency"),
        ("assess_svc", "assessment_sessions"),
        ("assess_svc", "attempt_records"),
        ("rec_ai_svc", "recommendation_logs"),
    ):
        fk_names = list(
            conn.execute(
                text(
                    """
                    SELECT tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.referential_constraints rc
                      ON tc.constraint_name = rc.constraint_name
                     AND tc.constraint_schema = rc.constraint_schema
                    JOIN information_schema.table_constraints pk
                      ON rc.unique_constraint_name = pk.constraint_name
                     AND rc.unique_constraint_schema = pk.constraint_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_schema = :schema
                      AND tc.table_name = :tbl
                      AND pk.table_name = 'users'
                    """
                ),
                {"schema": schema_name, "tbl": tbl_name},
            ).scalars()
        )
        for fk_name in fk_names:
            conn.execute(
                text(f'ALTER TABLE {schema_name}.{tbl_name} DROP CONSTRAINT IF EXISTS "{fk_name}";')
            )

    # PostgreSQL: 3. Idempotent v3 column additions
    conn.execute(
        text(
            "ALTER TABLE assess_svc.user_node_competency "
            "ADD COLUMN IF NOT EXISTS playbook_completed_at TIMESTAMPTZ;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.depth_questions "
            "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.depth_questions "
            "ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.depth_questions "
            "ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.code_challenges "
            "ADD COLUMN IF NOT EXISTS setup_sql TEXT;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.code_challenges "
            "ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.code_challenges "
            "ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE content_svc.code_challenges "
            "ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;"
        )
    )


def _migration_0011(conn: Connection) -> None:
    """Drop retired MVP v1 tables and upgrade recommendation_logs to v2 multi-domain schema (D-31)."""
    legacy_tables = (
        "quiz_attempts",
        "user_concept_mastery",
        "quiz_questions",
        "concept_prerequisites",
        "concepts",
    )
    if conn.dialect.name == "sqlite":
        for tbl in legacy_tables:
            conn.execute(text(f"DROP TABLE IF EXISTS {tbl};"))
        cols = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info(recommendation_logs);")).fetchall()
        }
        if cols:
            if "domain_slug" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE recommendation_logs "
                        "ADD COLUMN domain_slug VARCHAR(64) NOT NULL DEFAULT 'backend';"
                    )
                )
            if "recommended_concept_slug" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE recommendation_logs "
                        "ADD COLUMN recommended_concept_slug VARCHAR(64);"
                    )
                )
            if "recommended_mode" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE recommendation_logs ADD COLUMN recommended_mode VARCHAR(32);"
                    )
                )
        return

    for schema_name in ("assess_svc", "content_svc", "public"):
        for tbl in legacy_tables:
            conn.execute(text(f"DROP TABLE IF EXISTS {schema_name}.{tbl} CASCADE;"))

    conn.execute(
        text(
            "ALTER TABLE IF EXISTS rec_ai_svc.recommendation_logs "
            "ADD COLUMN IF NOT EXISTS domain_slug VARCHAR(64) NOT NULL DEFAULT 'backend';"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE IF EXISTS rec_ai_svc.recommendation_logs "
            "ADD COLUMN IF NOT EXISTS recommended_concept_slug VARCHAR(64);"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE IF EXISTS rec_ai_svc.recommendation_logs "
            "ADD COLUMN IF NOT EXISTS recommended_mode VARCHAR(32);"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE IF EXISTS rec_ai_svc.recommendation_logs "
            "ALTER COLUMN state_version SET DEFAULT 1;"
        )
    )
    conn.execute(
        text(
            "ALTER TABLE IF EXISTS rec_ai_svc.recommendation_logs "
            "DROP COLUMN IF EXISTS recommended_action_id;"
        )
    )
    conn.execute(
        text(
            "CREATE INDEX IF NOT EXISTS idx_rec_logs_domain_created "
            "ON rec_ai_svc.recommendation_logs (domain_slug, created_at);"
        )
    )
    conn.execute(
        text(
            "GRANT SELECT, INSERT, UPDATE, DELETE ON rec_ai_svc.recommendation_logs "
            "TO rec_ai_svc_user, rec_ai_role;"
        )
    )


MIGRATIONS: list[tuple[str, Callable[[Connection], None]]] = [
    ("0001_initial_schema", _migration_0001),
    ("0002_add_quiz_attempt_state_version_and_unlocked", _migration_0002),
    ("0003_drop_legacy_attempt_defaults", _migration_0003),
    ("0004_add_user_role_column", _migration_0004),
    ("0005_phase3_four_schemas_and_online_rl", _migration_0005),
    ("0006_add_performance_indexes", _migration_0006),
    ("0007_strict_schema_isolation", _migration_0007),
    ("0008_cleanup_public_duplicates", _migration_0008),
    ("0009_single_active_model_index", _migration_0009),
    ("0010_v3_per_schema_outbox_and_content_columns", _migration_0010),
    ("0011_v4_drop_legacy_v1_tables_and_upgrade_rec_logs", _migration_0011),
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


def run_database_migrations_on_connection(conn: Connection) -> list[str]:
    """Execute all pending versioned migrations on an already-open transaction/connection."""
    applied_versions: list[str] = []
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
    return applied_versions


def run_database_migrations(engine: Engine) -> list[str]:
    """Execute all pending versioned migrations in order.

    Strictly fails and raises RuntimeError on any migration error.
    Never swallows migration exceptions.
    """
    try:
        with engine.begin() as conn:
            applied_versions = run_database_migrations_on_connection(conn)
    except SQLAlchemyError as exc:
        logger.error("Database migration execution failed: %s", exc)
        raise RuntimeError(f"Database migration failed: {exc}") from exc

    if engine.dialect.name == "postgresql" and (
        "0007_strict_schema_isolation" in applied_versions
        or "0008_cleanup_public_duplicates" in applied_versions
    ):
        engine.dispose()

    return applied_versions
