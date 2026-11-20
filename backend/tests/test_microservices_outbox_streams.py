"""Behavioral RED tests for PL3-ARCH-01: 4-Schema Isolation, Transactional Outbox & Idempotent Consumer."""

from __future__ import annotations

import uuid

from sqlalchemy import create_engine, text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.orm import Session

from app.config import settings
from app.main import ensure_db_initialized


def test_pl3_arch_01_four_schemas_exist_and_cross_schema_query_blocked() -> None:
    """Verify auth_svc, content_svc, assess_svc, rec_ai_svc exist and cross-schema SQL is denied."""
    ensure_db_initialized()
    admin_engine = create_engine(settings.database_url, pool_pre_ping=True)
    with admin_engine.connect() as conn:
        schemas = {
            r[0]
            for r in conn.execute(
                text(
                    "SELECT schema_name FROM information_schema.schemata "
                    "WHERE schema_name IN ('auth_svc', 'content_svc', 'assess_svc', 'rec_ai_svc')"
                )
            ).fetchall()
        }
        assert schemas == {"auth_svc", "content_svc", "assess_svc", "rec_ai_svc"}

        # Verify assess_role cannot read auth_svc.users_shadow / schema
        try:
            conn.execute(text("SET LOCAL ROLE assess_role;"))
            conn.execute(text("SELECT 1 FROM auth_svc.service_marker;"))
            raise AssertionError("Expected cross-schema query to be denied with insufficient_privilege")
        except ProgrammingError as exc:
            assert "permission denied" in str(exc).lower()
            conn.rollback()
    admin_engine.dispose()


def test_pl3_arch_01_transactional_outbox_and_idempotent_event_consumption() -> None:
    """Consuming the same event_id 3 times writes exactly 1 row to rl_experience_buffer."""
    from app.db.models import RlExperienceBufferModel, engine
    from app.modules.events.outbox import (
        consume_competency_event_idempotent,
        record_outbox_event_in_tx,
    )

    ensure_db_initialized()
    ev_id = uuid.uuid4()
    payload = {
        "event_id": str(ev_id),
        "user_id": str(uuid.uuid4()),
        "domain_slug": "backend",
        "concept_slug": "net-internet",
        "action_mode": "Deep_Probe",
        "reward": 2.5,
        "obs_before": [[0.0] * 8],
        "obs_after": [[0.5] * 8],
    }

    with Session(engine) as db:
        outbox_row = record_outbox_event_in_tx(
            db,
            event_id=ev_id,
            event_type="CompetencyUpdatedEvent",
            stream_name="plumora:stream:competency",
            payload=payload,
        )
        db.commit()
        assert outbox_row.event_id == ev_id

        # Consume 3 times -> must insert exactly 1 experience row
        assert consume_competency_event_idempotent(db, ev_id, payload) is True
        assert consume_competency_event_idempotent(db, ev_id, payload) is False
        assert consume_competency_event_idempotent(db, ev_id, payload) is False

        count = (
            db.query(RlExperienceBufferModel)
            .filter(RlExperienceBufferModel.event_id == ev_id)
            .count()
        )
        assert count == 1
