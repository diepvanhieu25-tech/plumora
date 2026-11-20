"""Behavioral RED tests for PL3-ROLE-01 & INV-ONLINE-RL-01: RBAC, Expert Studio, Safety Gate & Rollback."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import delete, select, update

from app.db.models import (
    DepthQuestionModel,
    DomainConceptMapModel,
    DomainModel,
    GradingRubricModel,
    ModelRegistryModel,
    OutboxEventModel,
    SessionLocal,
)
from app.main import app


def _login(client: TestClient, username: str) -> None:
    portal = (
        "admin"
        if username == "admin_demo"
        else "expert"
        if username == "expert_demo"
        else "learner"
    )
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "PlumoraDemo#2026", "portal": portal},
    )
    assert res.status_code == 200


def test_pl3_role_01_rbac_matrix_blocks_unauthorized_roles_with_403() -> None:
    """Learner cannot access Expert/Admin; Expert cannot access Admin (403 FORBIDDEN_ROLE)."""
    with TestClient(app) as client:
        _login(client, "learner_new")
        assert client.post("/api/v2/expert/domains", json={"slug": "xx", "title": "XX"}).status_code == 403
        assert client.get("/api/v2/admin/online-rl/status").status_code == 403
        assert client.get("/api/v2/admin/system-health").status_code == 403

        _login(client, "expert_demo")
        assert client.get("/api/v2/admin/online-rl/status").status_code == 403
        assert client.post("/api/v2/admin/models/rollback", json={"reason": "test"}).status_code == 403


def test_portal_login_rejects_wrong_role_with_403() -> None:
    """Wrong-role portal login must be rejected with 403 FORBIDDEN_ROLE."""
    with TestClient(app) as client:
        r1 = client.post(
            "/api/v1/auth/login",
            json={"username": "learner_new", "password": "PlumoraDemo#2026", "portal": "admin"},
        )
        assert r1.status_code == 403
        assert r1.json()["error_code"] == "FORBIDDEN_ROLE"

        r2 = client.post(
            "/api/v1/auth/login",
            json={"username": "learner_new", "password": "PlumoraDemo#2026", "portal": "expert"},
        )
        assert r2.status_code == 403
        assert r2.json()["error_code"] == "FORBIDDEN_ROLE"

        r3 = client.post(
            "/api/v1/auth/login",
            json={"username": "expert_demo", "password": "PlumoraDemo#2026", "portal": "admin"},
        )
        assert r3.status_code == 403
        assert r3.json()["error_code"] == "FORBIDDEN_ROLE"

        r4 = client.post(
            "/api/v1/auth/login",
            json={"username": "admin_demo", "password": "PlumoraDemo#2026", "portal": "learner"},
        )
        assert r4.status_code == 403
        assert r4.json()["error_code"] == "FORBIDDEN_ROLE"

        r_ok = client.post(
            "/api/v1/auth/login",
            json={"username": "admin_demo", "password": "PlumoraDemo#2026", "portal": "admin"},
        )
        assert r_ok.status_code == 200


def test_pl3_role_01_expert_dag_cycle_and_rubric_weight_validation() -> None:
    """Expert domain graph rejects cycles (422 DAG_CYCLE_DETECTED) and invalid rubric weights (422)."""
    slug = f"exp_{uuid.uuid4().hex[:6]}"
    try:
        with TestClient(app) as client:
            _login(client, "expert_demo")
            r_dom = client.post(
                "/api/v2/expert/domains",
                json={"slug": slug, "title": "Expert Test Domain", "description": "Test"},
            )
            assert r_dom.status_code == 201

            r_cycle = client.put(
                f"/api/v2/expert/domains/{slug}/graph",
                json={
                    "nodes": [
                        {"slug": f"{slug}-a", "title": "Node A", "tier": 1, "is_shared": False, "lesson_markdown": "A"},
                        {"slug": f"{slug}-b", "title": "Node B", "tier": 2, "is_shared": False, "lesson_markdown": "B"},
                    ],
                    "edges": [
                        {"concept_slug": f"{slug}-b", "prereq_slug": f"{slug}-a"},
                        {"concept_slug": f"{slug}-a", "prereq_slug": f"{slug}-b"},
                    ],
                },
            )
            assert r_cycle.status_code == 422
            assert r_cycle.json()["detail"]["error_code"] == "DAG_CYCLE_DETECTED"

            r_bad_rubric = client.post(
                "/api/v2/expert/concepts/net-internet/questions",
                json={
                    "depth_tier": 3,
                    "task_type": "troubleshooting",
                    "prompt": "Test prompt for rubric sum validation.",
                    "rubric": {
                        "criteria": [
                            {"name": "C1", "weight": 0.4, "required_keywords": ["dns"]},
                            {"name": "C2", "weight": 0.4, "required_keywords": ["tcp"]},
                        ],
                        "reference_explanation": "Ref",
                    },
                },
            )
            assert r_bad_rubric.status_code == 422
            assert r_bad_rubric.json()["detail"]["error_code"] == "RUBRIC_WEIGHT_SUM_INVALID"
    finally:
        with SessionLocal() as db:
            db.execute(delete(DomainConceptMapModel).where(DomainConceptMapModel.domain_slug == slug))
            db.execute(delete(DomainModel).where(DomainModel.slug == slug))
            db.commit()


def test_inv_online_rl_01_safety_gate_blocks_bad_candidate_and_allows_rollback() -> None:
    """Admin cannot activate a BLOCKED model (422); can activate PASSED and 1-Click Rollback."""
    blocked_id = uuid.uuid4()
    passed_id = uuid.uuid4()
    with SessionLocal() as db:
        prev_active_id = db.scalar(
            select(ModelRegistryModel.id).where(ModelRegistryModel.is_active.is_(True))
        )

    try:
        with TestClient(app) as client:
            _login(client, "admin_demo")
            st = client.get("/api/v2/admin/online-rl/status")
            assert st.status_code == 200

            # Insufficient buffer check
            r_insuff = client.post(
                "/api/v2/admin/online-rl/micro-batch",
                json={"batch_size": 2000, "kl_target_max": 0.02},
            )
            assert r_insuff.status_code == 409
            assert r_insuff.json()["detail"]["error_code"] == "INSUFFICIENT_BUFFER_SAMPLES"

            # Seed a blocked candidate & a passed candidate directly to test Safety Gate enforcement
            with SessionLocal() as db:
                db.add(
                    ModelRegistryModel(
                        id=blocked_id,
                        version_tag=f"cand-blocked-{uuid.uuid4().hex[:6]}",
                        checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
                        checkpoint_sha256="0" * 64,
                        kl_divergence=0.09,
                        gate_verdict="BLOCKED",
                        is_active=False,
                        eval_metrics_json={"invalid_action_rate_unmasked": 0.12},
                    )
                )
                db.add(
                    ModelRegistryModel(
                        id=passed_id,
                        version_tag=f"cand-passed-{uuid.uuid4().hex[:6]}",
                        checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
                        checkpoint_sha256="1" * 64,
                        kl_divergence=0.01,
                        gate_verdict="PASSED",
                        is_active=False,
                        eval_metrics_json={"invalid_action_rate_unmasked": 0.0},
                    )
                )
                db.commit()

            r_block = client.post(
                f"/api/v2/admin/models/{blocked_id}/activate",
                json={"reason": "Should fail"},
            )
            assert r_block.status_code == 422
            assert r_block.json()["detail"]["error_code"] == "SAFETY_GATE_NOT_PASSED"

            r_act = client.post(
                f"/api/v2/admin/models/{passed_id}/activate",
                json={"reason": "Passed safety gate"},
            )
            assert r_act.status_code == 200
            assert r_act.json()["active_model_id"] == str(passed_id)

            r_rb = client.post(
                "/api/v2/admin/models/rollback",
                json={"reason": "Emergency rollback test"},
            )
            assert r_rb.status_code == 200
            assert r_rb.json()["switch_latency_ms"] < 2000
    finally:
        with SessionLocal() as db:
            db.execute(delete(ModelRegistryModel).where(ModelRegistryModel.id.in_([blocked_id, passed_id])))
            if prev_active_id is not None:
                db.execute(update(ModelRegistryModel).values(is_active=False))
                db.execute(
                    update(ModelRegistryModel)
                    .where(ModelRegistryModel.id == prev_active_id)
                    .values(is_active=True)
                )
            db.commit()


def test_expert_graph_update_preserves_existing_lesson_markdown() -> None:
    """Updating DAG without lesson_markdown must preserve existing rich lesson_markdown."""
    slug = f"exp_md_{uuid.uuid4().hex[:6]}"
    published_event_ids: list[uuid.UUID] = []
    try:
        with TestClient(app) as client:
            _login(client, "expert_demo")
            assert (
                client.post(
                    "/api/v2/expert/domains",
                    json={"slug": slug, "title": "Markdown Preserve Domain", "description": "Test"},
                ).status_code
                == 201
            )
            r1 = client.put(
                f"/api/v2/expert/domains/{slug}/graph",
                json={
                    "nodes": [
                        {
                            "slug": f"{slug}-n1",
                            "title": "Node 1",
                            "tier": 1,
                            "is_shared": False,
                            "lesson_markdown": "## Rich Custom Lesson\n\nDetailed content.",
                        }
                    ],
                    "edges": [],
                },
            )
            assert r1.status_code == 200
            if "published_event_id" in r1.json():
                published_event_ids.append(uuid.UUID(r1.json()["published_event_id"]))

            # Re-publish without lesson_markdown (simulating SCR-15 graph edit)
            r2 = client.put(
                f"/api/v2/expert/domains/{slug}/graph",
                json={
                    "nodes": [
                        {
                            "slug": f"{slug}-n1",
                            "title": "Node 1 Updated",
                            "tier": 1,
                            "is_shared": True,
                        }
                    ],
                    "edges": [],
                },
            )
            assert r2.status_code == 200
            if "published_event_id" in r2.json():
                published_event_ids.append(uuid.UUID(r2.json()["published_event_id"]))

            with SessionLocal() as db:
                row = db.query(DomainConceptMapModel).filter_by(domain_slug=slug).first()
                assert row is not None
                assert row.title == "Node 1 Updated"
                assert row.is_shared is True
                assert "Rich Custom Lesson" in row.lesson_markdown
    finally:
        with SessionLocal() as db:
            if published_event_ids:
                db.execute(delete(OutboxEventModel).where(OutboxEventModel.event_id.in_(published_event_ids)))
            db.execute(delete(DomainConceptMapModel).where(DomainConceptMapModel.domain_slug == slug))
            db.execute(delete(DomainModel).where(DomainModel.slug == slug))
            db.commit()


def test_expert_mcq_question_creation_with_options() -> None:
    """Expert can create a Tier 1 MCQ question with options A-D and correct_option_key."""
    created_item_id: uuid.UUID | None = None
    try:
        with TestClient(app) as client:
            _login(client, "expert_demo")
            r = client.post(
                "/api/v2/expert/concepts/net-internet/questions",
                json={
                    "depth_tier": 1,
                    "task_type": "mcq",
                    "prompt": "Giao thức nào phân giải tên miền sang địa chỉ IP?",
                    "options": {"A": "DNS", "B": "SMTP", "C": "FTP", "D": "SSH"},
                    "correct_option_key": "A",
                    "rubric": None,
                },
            )
            assert r.status_code == 201
            assert "item_id" in r.json()
            created_item_id = uuid.UUID(r.json()["item_id"])
    finally:
        if created_item_id is not None:
            with SessionLocal() as db:
                db.execute(delete(GradingRubricModel).where(GradingRubricModel.question_id == created_item_id))
                db.execute(delete(DepthQuestionModel).where(DepthQuestionModel.id == created_item_id))
                db.commit()
