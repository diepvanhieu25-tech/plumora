"""RED -> GREEN tests for Round 3 Package 3: R3-07 (Honest Telemetry) & R3-08 (Stream DLQ & Per-Message Error Handling)."""

from __future__ import annotations

import json
import uuid

import pytest
import redis
from sqlalchemy import select

from app.config import settings
from app.db.models import RlExperienceBufferModel, SessionLocal


def test_r3_07_system_health_honest_monolith_vs_microservices_and_unknown_metrics(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R3-07: Telemetry must distinguish monolith vs microservices, and return -1/None for unknown metrics."""
    from app.modules.recommendation.admin_service import get_system_health_status

    # 1. Monolith mode (no external service URLs)
    for var in (
        "AUTH_SERVICE_URL",
        "CONTENT_SERVICE_URL",
        "ASSESSMENT_SERVICE_URL",
        "ASSESS_SERVICE_URL",
        "RECOMMENDATION_SERVICE_URL",
        "REC_AI_SERVICE_URL",
    ):
        monkeypatch.delenv(var, raising=False)

    with SessionLocal() as db:
        health = get_system_health_status(db)
        assert health["mode"] == "monolith"
        # Monolith must NOT claim independent microservices are "up" — should report "in_process"
        assert all(v == "in_process" for v in health["services"].values()), (
            f"Monolith reported misleading service statuses: {health['services']}"
        )

    # 2. Unreachable assessment service -> outbox_pending_count must be -1 (unknown), NOT fake 0
    monkeypatch.setenv("ASSESSMENT_SERVICE_URL", "http://127.0.0.1:19999")
    with SessionLocal() as db:
        health2 = get_system_health_status(db)
        assert health2["mode"] == "microservices"
        assert health2["outbox_pending_count"] == -1, (
            f"Expected -1 (unknown) when assessment service unreachable, got {health2['outbox_pending_count']}"
        )
        assert health2["services"]["assessment_grader"] == "down"


def test_r3_08_poison_message_goes_to_dlq_and_does_not_block_valid_events() -> None:
    """R3-08: Poison/malformed messages must go to DLQ and never block subsequent valid events."""
    from app.modules.events.outbox import consume_competency_stream_once

    stream_name = f"plumora:test_stream_{uuid.uuid4().hex[:8]}"
    dlq_name = f"{stream_name}:dlq"
    valid_event_id = uuid.uuid4()
    test_user_id = uuid.uuid4()

    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        # 1. Push poison message (corrupt JSON & invalid UUID)
        r_client.xadd(
            stream_name,
            {
                "event_type": "CompetencyUpdatedEvent",
                "event_id": "not-a-valid-uuid",
                "payload": "{corrupt-json",
            },
        )
        # 2. Push valid message right after
        r_client.xadd(
            stream_name,
            {
                "event_type": "CompetencyUpdatedEvent",
                "event_id": str(valid_event_id),
                "payload": json.dumps(
                    {
                        "user_id": str(test_user_id),
                        "domain_slug": "frontend",
                        "concept_slug": "fe-html-css",
                        "action_mode": "Learn_New",
                        "reward": 1.0,
                        "obs_before": {"node_order": ["fe-html-css"], "nodes": []},
                        "obs_after": {"node_order": ["fe-html-css"], "nodes": []},
                    }
                ),
            },
        )

        with SessionLocal() as db:
            stats = consume_competency_stream_once(
                db,
                stream_name=stream_name,
                consumer_group="test_dlq_cg",
                consumer_name="test-worker",
            )

        assert stats["consumed"] == 1, f"Valid event blocked by poison message: {stats}"
        assert stats.get("dlq", 0) == 1, f"Poison message not routed to DLQ: {stats}"
        assert r_client.xlen(dlq_name) == 1

        with SessionLocal() as db:
            row = db.scalar(
                select(RlExperienceBufferModel).where(RlExperienceBufferModel.event_id == valid_event_id)
            )
            assert row is not None
    finally:
        r_client.delete(stream_name, dlq_name, "plumora:worker:test_dlq_cg")
        r_client.close()
