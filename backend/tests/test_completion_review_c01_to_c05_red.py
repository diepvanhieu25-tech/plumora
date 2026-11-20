"""RED -> GREEN tests for Completion Review C01-C05."""

from __future__ import annotations

import json
import time
import uuid

import numpy as np
import pytest
import redis
from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.db.models import OutboxEventModel, RlExperienceBufferModel, SessionLocal


def test_c01_login_succeeds_in_microservice_mode_without_cross_schema_grants(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """C01: auth_svc_user login must NOT query assess_svc/content_svc tables in microservice mode."""
    import importlib

    from fastapi.testclient import TestClient

    from services.user_auth_service import app as auth_app

    auth_router_mod = importlib.import_module("app.modules.auth.router")
    monkeypatch.setenv("MICROSERVICE_MODE", "true")
    monkeypatch.setattr(
        auth_router_mod,
        "write_through_state_cache",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("login_user must not call write_through_state_cache in microservice mode")
        ),
    )

    uname = f"c01_u_{uuid.uuid4().hex[:8]}"
    with TestClient(auth_app) as client:
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "C01 User", "password": "StrongPass!2026"},
        )
        assert reg.status_code == 201
        login = client.post(
            "/api/v1/auth/login",
            json={"username": uname, "password": "StrongPass!2026", "portal": "learner"},
        )
        assert login.status_code == 200
        assert login.json()["access_token"]


def test_c02_transient_db_error_keeps_event_pending_and_recovers_without_dlq(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """C02: Transient DB error must NOT ACK to DLQ; event must retry via pending recovery and land once."""
    from app.modules.events import outbox as outbox_mod

    stream_name = f"plumora:c02_stream_{uuid.uuid4().hex[:8]}"
    dlq_name = f"{stream_name}:dlq"
    ev_id = uuid.uuid4()
    user_id = uuid.uuid4()
    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

    try:
        r_client.xadd(
            stream_name,
            {
                "event_type": "CompetencyUpdatedEvent",
                "event_id": str(ev_id),
                "db_commit_ts_ms": str(int(time.time() * 1000)),
                "payload": json.dumps(
                    {
                        "user_id": str(user_id),
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

        # 1. Simulate transient DB OperationalError during consume
        def _fail_transient(*_args: object, **_kwargs: object) -> bool:
            raise OperationalError("SELECT 1", {}, Exception("temporary PostgreSQL connection unavailable"))

        monkeypatch.setattr(outbox_mod, "consume_competency_event_idempotent", _fail_transient)
        with SessionLocal() as db:
            stats1 = outbox_mod.consume_competency_stream_once(
                db,
                stream_name=stream_name,
                consumer_group="c02_cg",
                consumer_name="w1",
            )
        assert stats1["consumed"] == 0
        assert stats1.get("dlq", 0) == 0, f"Transient DB error wrongly sent to DLQ: {stats1}"
        assert r_client.xlen(dlq_name) == 0
        assert stats1.get("transient_errors", 0) >= 1

        # 2. Restore DB and reclaim pending via xautoclaim -> must consume exactly once
        monkeypatch.undo()
        time.sleep(0.05)
        with SessionLocal() as db:
            stats2 = outbox_mod.consume_competency_stream_once(
                db,
                stream_name=stream_name,
                consumer_group="c02_cg",
                consumer_name="w2",
                min_idle_ms=10,
            )
        assert stats2["consumed"] == 1, f"Event did not recover after DB restored: {stats2}"
        assert r_client.xlen(dlq_name) == 0
        with SessionLocal() as db:
            rows = db.scalars(
                select(RlExperienceBufferModel).where(RlExperienceBufferModel.event_id == ev_id)
            ).all()
            assert len(rows) == 1
    finally:
        r_client.delete(stream_name, dlq_name, "plumora:worker:c02_cg")
        r_client.close()


def test_c03_shared_guardrail_enforces_due_review_fresh_and_locked_nodes() -> None:
    """C03: Serving and Safety Gate must share pure guardrail selector with identical adversarial behavior."""
    from app.modules.recommendation.guardrail import select_guarded_action

    # 3 nodes: node 0 mastered & due for review, node 1 fresh & eligible, node 2 locked
    depth = np.array([0.75, 0.0, 0.0], dtype=np.float32)
    retention = np.array([0.45, 1.0, 1.0], dtype=np.float32)
    eligible = np.array([True, True, False], dtype=bool)
    needs_review = np.array([True, False, False], dtype=bool)

    # 1. Adversarial logits strongly preferring locked node 2 (Learn_New) -> must still prioritize due-review node 0!
    adv_logits = np.full((3, 4), -10.0, dtype=np.float32)
    adv_logits[2, 0] = 50.0  # locked node
    sel_v, sel_m, _src, applied = select_guarded_action(
        adv_logits, eligible=eligible, needs_review=needs_review, depth=depth, retention=retention
    )
    assert (sel_v, sel_m) == (0, 3), f"Expected due review (0, Spaced_Review), got {(sel_v, sel_m)}"
    assert applied is True

    # 2. Fresh node (no due review) + adversarial logits preferring Spaced_Review (mode 3) on node 1 -> forbidden!
    needs_review_none = np.array([False, False, False], dtype=bool)
    eligible_fresh = np.array([False, True, False], dtype=bool)
    adv_logits_review = np.full((3, 4), -5.0, dtype=np.float32)
    adv_logits_review[1, 3] = 50.0  # Spaced_Review on fresh node
    adv_logits_review[1, 0] = 1.0   # Learn_New
    sel_v2, sel_m2, _src2, applied2 = select_guarded_action(
        adv_logits_review,
        eligible=eligible_fresh,
        needs_review=needs_review_none,
        depth=np.array([1.0, 0.0, 0.0], dtype=np.float32),
        retention=np.array([1.0, 1.0, 1.0], dtype=np.float32),
    )
    assert (sel_v2, sel_m2) == (1, 0), f"Spaced_Review must be forbidden on fresh node, got {(sel_v2, sel_m2)}"
    assert applied2 is True

    # 3. Locked node adversarial logits -> never selected
    adv_logits_locked = np.full((3, 4), -5.0, dtype=np.float32)
    adv_logits_locked[2, 0] = 99.0
    adv_logits_locked[1, 0] = 0.5
    sel_v3, _sel_m3, _src3, _applied3 = select_guarded_action(
        adv_logits_locked,
        eligible=eligible_fresh,
        needs_review=needs_review_none,
        depth=np.array([1.0, 0.0, 0.0], dtype=np.float32),
        retention=np.array([1.0, 1.0, 1.0], dtype=np.float32),
    )
    assert sel_v3 != 2


def test_c04_transition_validation_rejects_mismatch_nan_and_matches_canonical_needs_review() -> None:
    """C04: Reject missing node_order, mismatched action_node_idx, unknown mode, NaN; use canonical is_review_needed."""
    from app.modules.assessment.ebbinghaus import is_review_needed
    from app.modules.recommendation.admin_service import _build_transition_tensors

    assert is_review_needed(0.75, 0.57) is True
    assert is_review_needed(0.0, 0.40) is False

    node_order = ["fe-html-css", "fe-js-basics"]
    valid_nodes = [
        {"features": [0.0, 0.0, 1.0, 1.0, 0.0, 0.25, 0.0, 1.0]},
        {"features": [0.0, 0.0, 1.0, 0.0, 0.0, 0.5, 0.0, 1.0]},
    ]
    base_bad = {
        "domain_slug": "frontend",
        "concept_slug": "fe-js-basics",
        "action_mode": "Learn_New",
        "reward": 1.0,
        "obs_before_json": {"node_order": node_order, "action_node_idx": 1, "nodes": valid_nodes},
        "obs_after_json": {"node_order": node_order, "action_node_idx": 1, "nodes": valid_nodes},
    }

    # 1. Missing node_order
    bad1 = {**base_bad, "obs_before_json": {"nodes": valid_nodes}}
    # 2. action_node_idx mismatch (points to index 0 while concept_slug is index 1)
    bad2 = {
        **base_bad,
        "obs_before_json": {"node_order": node_order, "action_node_idx": 0, "nodes": valid_nodes},
    }
    # 3. Unknown mode
    bad3 = {**base_bad, "action_mode": "Unknown_Hack_Mode"}
    # 4. NaN reward
    bad4 = {**base_bad, "reward": float("nan")}

    with SessionLocal() as db:
        for bad in (bad1, bad2, bad3, bad4):
            with pytest.raises(ValueError):
                _build_transition_tensors(db, [bad], domain_slug="frontend")


def test_c05_outbox_measures_true_db_commit_to_consume_latency() -> None:
    """C05: Outbox relay -> stream consume must measure true DB commit_ts -> consume latency (not publish_ts)."""
    from app.modules.events.outbox import (
        consume_competency_stream_once,
        record_outbox_event_in_tx,
        relay_pending_outbox_events,
    )

    stream_name = f"plumora:c05_stream_{uuid.uuid4().hex[:8]}"
    ev_id = uuid.uuid4()
    user_id = uuid.uuid4()
    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

    try:
        with SessionLocal() as db:
            record_outbox_event_in_tx(
                db,
                event_id=ev_id,
                event_type="CompetencyUpdatedEvent",
                stream_name=stream_name,
                payload={
                    "user_id": str(user_id),
                    "domain_slug": "frontend",
                    "concept_slug": "fe-html-css",
                    "action_mode": "Learn_New",
                    "reward": 1.0,
                    "obs_before": {"node_order": ["fe-html-css"], "nodes": []},
                    "obs_after": {"node_order": ["fe-html-css"], "nodes": []},
                },
            )
            db.commit()

        # Simulate outbox relay delay of 120ms AFTER DB commit
        time.sleep(0.12)
        with SessionLocal() as db:
            relayed = relay_pending_outbox_events(db)
            assert relayed >= 1
        with SessionLocal() as db:
            stats = consume_competency_stream_once(
                db,
                stream_name=stream_name,
                consumer_group="c05_cg",
                consumer_name="w1",
            )
        assert stats["consumed"] >= 1
        c2c_raw = r_client.get("plumora:metrics:last_commit_to_consume_ms")
        assert c2c_raw is not None
        c2c_val = float(str(c2c_raw))
        assert c2c_val >= 100.0, (
            f"Expected commit_to_consume >= 100ms (including 120ms relay wait), got {c2c_val}"
        )
    finally:
        with SessionLocal() as db:
            db.query(OutboxEventModel).filter(OutboxEventModel.event_id == ev_id).delete()
            db.commit()
        r_client.delete(stream_name, "plumora:worker:c05_cg")
        r_client.close()
