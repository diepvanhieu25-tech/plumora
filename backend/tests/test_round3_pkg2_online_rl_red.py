"""RED -> GREEN tests for Round 3 Package 2: R3-02, R3-03, R3-05, R3-06 (Online RL & Model Serving)."""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db.models import (
    DomainConceptMapModel,
    ModelRegistryModel,
    RlExperienceBufferModel,
    SessionLocal,
)
from app.main import app


def _register_user_and_token(client: TestClient) -> tuple[str, str]:
    uname = f"r3_rl_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={"username": uname, "display_name": "RL Learner", "password": "StrongPass!2026"},
    )
    assert res.status_code == 201
    data = res.json()
    return data["user"]["id"], data["access_token"]


def test_r3_03_competency_update_records_distinct_before_and_after_observations() -> None:
    """R3-03: Outbox -> stream -> buffer must record distinct obs_before and obs_after with real node_idx."""
    from app.modules.events.outbox import (
        consume_competency_stream_once,
        relay_pending_outbox_events,
    )

    with TestClient(app) as client:
        user_id_str, token = _register_user_and_token(client)
        headers = {"Authorization": f"Bearer {token}"}

        # Start placement in frontend domain
        start = client.post(
            "/api/v2/domains/frontend/placement/start",
            headers=headers,
        )
        assert start.status_code == 201
        start_body = start.json()
        session_id = start_body["session_id"]
        q = start_body["current_question"]
        concept_slug = q["concept_slug"]

        ans = client.post(
            f"/api/v2/domains/frontend/placement/{session_id}/answer",
            json={
                "question_id": q["question_id"],
                "selected_option": "A",
                "submission_id": str(uuid.uuid4()),
            },
            headers=headers,
        )
        assert ans.status_code == 200

    # Relay outbox and consume stream into rl_experience_buffer
    with SessionLocal() as db:
        relay_pending_outbox_events(db)
        db.commit()
    with SessionLocal() as db:
        consume_competency_stream_once(db)
        db.commit()

    with SessionLocal() as db:
        user_uuid = uuid.UUID(user_id_str)
        rows = db.scalars(
            select(RlExperienceBufferModel)
            .where(RlExperienceBufferModel.user_id == user_uuid)
            .order_by(RlExperienceBufferModel.created_at.desc())
        ).all()
        assert len(rows) >= 1, "Expected RlExperienceBufferModel row after assessment answer"
        row = rows[0]

        nodes_ordered = db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug == "frontend")
            .order_by(DomainConceptMapModel.node_idx)
        ).all()
        expected_idx = next(i for i, n in enumerate(nodes_ordered) if n.concept_slug == concept_slug)

        assert isinstance(row.obs_before_json, dict) and isinstance(row.obs_after_json, dict)
        assert row.obs_before_json.get("action_node_idx") == expected_idx, (
            f"action_node_idx={row.obs_before_json.get('action_node_idx')} != expected graph node_idx={expected_idx} for {concept_slug}"
        )
        assert row.obs_before_json != row.obs_after_json, (
            "obs_before_json and obs_after_json must differ after competency update"
        )
        assert "node_order" in row.obs_before_json and row.obs_before_json["node_order"][expected_idx] == concept_slug
        before_node = row.obs_before_json["nodes"][expected_idx]
        after_node = row.obs_after_json["nodes"][expected_idx]
        assert before_node != after_node, "Target node features must change between obs_before and obs_after"
        assert "retention" in after_node and "needs_review" in after_node


def test_r3_02_trainer_uses_real_topology_and_rejects_malformed_transitions() -> None:
    """R3-02: Trainer must use real domain DAG edges/node_order and reject malformed/synthetic transitions."""
    from app.modules.recommendation.admin_service import _build_transition_tensors

    # 1. Malformed transition missing obs_before/obs_after or invalid node_order must be rejected
    bad_rows = [
        {
            "domain_slug": "frontend",
            "action_node_idx": 999,  # out of bounds
            "reward": 0.5,
            "obs_before_json": {"nodes": []},
            "obs_after_json": {"nodes": []},
        }
    ]
    with pytest.raises(ValueError, match="valid transitions|malformed|obs_before"), SessionLocal() as db:
        _build_transition_tensors(db, bad_rows, domain_slug="frontend")

    # 2. Valid transitions must build real DAG adjacency (not sequential 0->1->2 chain)
    with SessionLocal() as db:
        nodes = db.scalars(
            select(DomainConceptMapModel)
            .where(DomainConceptMapModel.domain_slug == "frontend")
            .order_by(DomainConceptMapModel.node_idx)
        ).all()
        node_order = [n.concept_slug for n in nodes]
        real_edges = sum(len(n.prerequisites_json or []) for n in nodes)
        assert real_edges > 0

        valid_row = {
            "domain_slug": "frontend",
            "concept_slug": node_order[0],
            "action_mode": "Learn_New",
            "action_node_idx": 0,
            "reward": 0.6,
            "obs_before_json": {
                "domain_slug": "frontend",
                "node_order": node_order,
                "nodes": [{"mastery": 0.1, "confidence": 0.1, "retention": 1.0} for _ in node_order],
            },
            "obs_after_json": {
                "domain_slug": "frontend",
                "node_order": node_order,
                "nodes": [{"mastery": 0.5, "confidence": 0.3, "retention": 1.0} for _ in node_order],
            },
        }
        tensors = _build_transition_tensors(db, [valid_row], domain_slug="frontend")
        edge_index = tensors["edge_index"]
        # edge_index has shape (2, E); E must match real DAG prerequisite count (bidirectional or directed)
        assert edge_index.shape[1] >= real_edges
        # Verify an actual prerequisite edge exists rather than blind sequential chain if non-sequential exists
        slug_to_idx = {s: i for i, s in enumerate(node_order)}
        expected_pairs = {
            (slug_to_idx[prereq], slug_to_idx[n.concept_slug])
            for n in nodes
            for prereq in (n.prerequisites_json or [])
            if prereq in slug_to_idx
        }
        actual_pairs = {(int(edge_index[0, k]), int(edge_index[1, k])) for k in range(edge_index.shape[1])}
        assert expected_pairs.issubset(actual_pairs), "Trainer edge_index missing real domain prerequisite edges"


def test_r3_05_activate_and_rollback_verify_checkpoint_file_and_sha256(tmp_path: Path) -> None:
    """R3-05: Activate and rollback must verify checkpoint file existence and SHA-256 before serving."""
    from app.modules.recommendation.admin_service import (
        activate_candidate_model,
    )

    bad_tag = f"r3_05_bad_{uuid.uuid4().hex[:6]}"
    good_tag = f"r3_05_good_{uuid.uuid4().hex[:6]}"
    ckpt_file = tmp_path / f"{good_tag}.zip"
    ckpt_file.write_bytes(b"valid-checkpoint-bytes-for-test")
    good_sha = hashlib.sha256(ckpt_file.read_bytes()).hexdigest()

    with SessionLocal() as db:
        # Insert a valid active model first so we have a safe baseline
        existing_active = db.scalar(select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)))
        prev_active_id = existing_active.id if existing_active else None
        if existing_active is not None:
            existing_active.is_active = False
            db.flush()

        good_model = ModelRegistryModel(
            id=uuid.uuid4(),
            version_tag=good_tag,
            checkpoint_path=str(ckpt_file),
            checkpoint_sha256=good_sha,
            kl_divergence=0.01,
            gate_verdict="PASSED",
            is_active=True,
            eval_metrics_json={"eval_episodes": 200},
        )
        bad_model = ModelRegistryModel(
            id=uuid.uuid4(),
            version_tag=bad_tag,
            checkpoint_path=str(tmp_path / "missing_file.zip"),
            checkpoint_sha256="deadbeef" * 8,
            kl_divergence=0.01,
            gate_verdict="PASSED",
            is_active=False,
            eval_metrics_json={"eval_episodes": 200},
        )
        db.add_all([good_model, bad_model])
        db.commit()

    try:
        with SessionLocal() as db:
            # 1. Activating a model with missing/tampered checkpoint must fail
            with pytest.raises(HTTPException) as exc_info:
                activate_candidate_model(db, bad_model.id)
            assert exc_info.value.status_code in (400, 422)

            # 2. Tamper good_model file on disk -> activate must reject
            ckpt_file.write_bytes(b"tampered-bytes")
            with pytest.raises(HTTPException) as exc_info2:
                activate_candidate_model(db, good_model.id)
            assert exc_info2.value.status_code in (400, 422)
    finally:
        with SessionLocal() as db:
            db.execute(delete(ModelRegistryModel).where(ModelRegistryModel.version_tag.in_([bad_tag, good_tag])))
            if prev_active_id is not None:
                prev = db.get(ModelRegistryModel, prev_active_id)
                if prev is not None:
                    prev.is_active = True
            db.commit()


def test_r3_06_safety_gate_evaluates_200_scenarios_against_active_model() -> None:
    """R3-06: Safety Gate must evaluate 200 scenarios across real domain graphs against active model."""
    from app.modules.recommendation.admin_service import _evaluate_candidate_against_active

    ckpt = Path(__file__).resolve().parents[2] / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
    assert ckpt.exists(), f"Missing base checkpoint: {ckpt}"

    with SessionLocal() as db:
        report = _evaluate_candidate_against_active(
            db,
            candidate_checkpoint_path=ckpt,
            active_checkpoint_path=ckpt,
            eval_episodes=200,
        )
        assert report["eval_episodes"] == 200
        assert "candidate_mean_reward" in report
        assert "active_mean_reward" in report
        assert "reward_delta" in report
        assert "kl_divergence" in report
        assert "guardrail_violations" in report
        assert len(report.get("domains_evaluated", [])) >= 3
