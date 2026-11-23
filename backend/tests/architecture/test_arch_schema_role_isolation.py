"""Fitness Function 2: 4-Schema Role Isolation & Migration 0010 Verification."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.config import settings
from app.db.migrations import run_database_migrations
from app.db.models import engine as app_engine
from app.main import app


def test_arch_migration_0010_creates_per_schema_outbox_and_v3_columns() -> None:
    """Migration 0010 must add v3 columns and, on PostgreSQL, content_svc.outbox_events & assess_svc.consumed_events."""
    with TestClient(app):
        pass
    run_database_migrations(app_engine)

    insp = inspect(app_engine)
    if app_engine.dialect.name == "postgresql":
        with app_engine.connect() as conn:
            # Verify content_svc.outbox_events and assess_svc.consumed_events exist
            content_outbox = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'content_svc' AND table_name = 'outbox_events'"
                )
            ).scalar()
            assess_consumed = conn.execute(
                text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_schema = 'assess_svc' AND table_name = 'consumed_events'"
                )
            ).scalar()
            assert content_outbox == 1, "content_svc.outbox_events missing after migration 0010"
            assert assess_consumed == 1, "assess_svc.consumed_events missing after migration 0010"

            # Verify no cross-schema FK constraints referencing auth_svc.users from assess_svc or rec_ai_svc
            cross_fks = conn.execute(
                text(
                    """
                    SELECT tc.table_schema, tc.table_name, tc.constraint_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.constraint_column_usage ccu
                      ON tc.constraint_name = ccu.constraint_name
                     AND tc.constraint_schema = ccu.constraint_schema
                    WHERE tc.constraint_type = 'FOREIGN KEY'
                      AND tc.table_schema IN ('assess_svc', 'rec_ai_svc')
                      AND ccu.table_schema = 'auth_svc'
                      AND ccu.table_name = 'users'
                    """
                )
            ).fetchall()
            assert not cross_fks, f"Cross-schema FKs to auth_svc.users still exist: {cross_fks}"
    else:
        u_cols = {c["name"] for c in insp.get_columns("user_node_competency")}
        assert "playbook_completed_at" in u_cols
        dq_cols = {c["name"] for c in insp.get_columns("depth_questions")}
        assert {"is_active", "version", "display_order"}.issubset(dq_cols)
        cc_cols = {c["name"] for c in insp.get_columns("code_challenges")}
        assert {"setup_sql", "is_active", "version", "display_order"}.issubset(cc_cols)


def test_arch_postgres_content_svc_user_can_write_outbox_without_500() -> None:
    """On PostgreSQL, restricted role content_svc_user can write content_svc.outbox_events and cannot read auth_svc.users."""
    if app_engine.dialect.name != "postgresql":
        return

    with TestClient(app):
        pass

    base_url = settings.database_url
    # Build restricted content_svc_user URL from settings.database_url
    at_idx = base_url.index("@")
    scheme_prefix = base_url.split("://", 1)[0]
    host_db = base_url[at_idx + 1 :]
    content_url = f"{scheme_prefix}://content_svc_user:plumora_dev_pass_local_only@{host_db}"

    c_engine = create_engine(content_url, pool_pre_ping=True)
    try:
        ev_id = uuid.uuid4()
        row_id = uuid.uuid4()
        with c_engine.begin() as conn:
            # 1. Must be able to write to content_svc.outbox_events
            conn.execute(
                text(
                    "INSERT INTO content_svc.outbox_events "
                    "(id, event_id, event_type, stream_name, payload_json) "
                    "VALUES (:id, :eid, 'DomainGraphUpdatedEvent', 'plumora:stream:domain_events', CAST(:payload AS jsonb))"
                ),
                {"id": row_id, "eid": ev_id, "payload": '{"domain_slug":"backend","test":true}'},
            )
            conn.execute(text("DELETE FROM content_svc.outbox_events WHERE id = :id"), {"id": row_id})

        # 2. Must be denied reading auth_svc.users
        denied = False
        try:
            with c_engine.connect() as conn:
                conn.execute(text("SELECT COUNT(*) FROM auth_svc.users"))
        except Exception:  # noqa: BLE001
            denied = True
        assert denied, "content_svc_user MUST NOT have permission to read auth_svc.users!"
    finally:
        c_engine.dispose()
