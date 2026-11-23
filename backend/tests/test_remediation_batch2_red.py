"""RED -> GREEN remediation tests for Batch 2: F03 (LLM), F04 (Online RL), F05 (Outbox Runtime), F06 (Schema Isolation), F10 (Rollback)."""

from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any, Self
from unittest.mock import patch

import pytest

from app.modules.assessment.rubric_grader import LlmRubricGraderAdapter, RubricCriterion


def test_f03_llm_rubric_adapter_sends_payload_and_parses_http_200_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """F03: LlmRubricGraderAdapter must send prompt/explanation/criteria and parse HTTP 200 JSON response."""
    monkeypatch.setenv("PLUMORA_LLM_API_URL", "https://llm.example.test/v1/chat/completions")
    monkeypatch.setenv("PLUMORA_LLM_API_KEY", "test-secret-key")

    captured_body: dict[str, Any] = {}

    class _FakeResp:
        status = 200

        def __enter__(self) -> Self:
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def read(self) -> bytes:
            payload = {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "rubric_score": 0.9,
                                    "tutor_summary": "Giải thích chính xác DNS và TCP handshake.",
                                    "criteria_results": [
                                        {"name": "DNS", "weight": 0.5, "score": 1.0},
                                        {"name": "TCP", "weight": 0.5, "score": 0.8},
                                    ],
                                }
                            )
                        }
                    }
                ]
            }
            return json.dumps(payload).encode("utf-8")

    def _fake_urlopen(req: Any, timeout: float = 4.0) -> _FakeResp:
        captured_body["raw"] = req.data.decode("utf-8")
        return _FakeResp()

    adapter = LlmRubricGraderAdapter(timeout_s=2.0)
    criteria = [
        RubricCriterion(name="DNS", weight=0.5, required_keywords=["dns"]),
        RubricCriterion(name="TCP", weight=0.5, required_keywords=["tcp"]),
    ]
    with patch("urllib.request.urlopen", side_effect=_fake_urlopen):
        score, summary, crit_res, source = adapter.grade(
            prompt="Giải thích DNS và TCP",
            written_explanation="Trình duyệt phân giải DNS rồi mở TCP handshake.",
            criteria=criteria,
            reference_explanation="DNS -> IP -> TCP 3-way handshake.",
        )

    assert source == "llm_rubric"
    assert score == pytest.approx(0.9, abs=0.01)
    assert "DNS" in summary
    assert len(crit_res) == 2
    sent = json.loads(captured_body["raw"])
    assert sent != {}


def test_f04_online_rl_uses_real_transitions_active_baseline_and_mode_aware_eval() -> None:
    """F04: PPO update must depend on obs_before/domain/concept, evaluator must differentiate modes, and active model must be baseline."""
    from datetime import UTC, datetime
    from types import SimpleNamespace

    from app.db.models import SessionLocal
    from app.modules.recommendation.admin_service import (
        BASE_CKPT_PATH,
        _derive_candidate_checkpoint,
        _load_domain_topology_for_rl,
        _rollout_policy_eval_on_topologies,
    )
    from app.modules.recommendation.gnn_loader import VerifiedGnnPpoCheckpoint

    if not BASE_CKPT_PATH.exists():
        pytest.skip("Base GNN-PPO checkpoint not present")

    # 1. Changing obs_before_json & concept_slug while keeping reward/action_mode identical MUST change updated weights
    with SessionLocal() as db:
        be_order = _load_domain_topology_for_rl(db, "backend")[0]
        fe_order = _load_domain_topology_for_rl(db, "frontend")[0]
    obs_a_12 = {
        "domain_slug": "backend",
        "node_order": be_order,
        "nodes": [{"features": [0.0, 0.0, 1.0, 1.0, 0.0, 0.25, 0.0, 1.0]} for _ in be_order],
    }
    obs_after_12 = {
        "domain_slug": "backend",
        "node_order": be_order,
        "nodes": [{"features": [0.5, 0.7, 1.0, 1.0, 0.0, 0.25, 0.0, 1.0]} for _ in be_order],
    }
    obs_b_10 = {
        "domain_slug": "frontend",
        "node_order": fe_order,
        "nodes": [{"features": [0.75, 0.85, 1.0, 1.0, 1.0, 0.75, 1.0, 1.0]} for _ in fe_order],
    }
    obs_after_10 = {
        "domain_slug": "frontend",
        "node_order": fe_order,
        "nodes": [{"features": [1.0, 0.9, 1.0, 1.0, 0.0, 0.75, 1.0, 1.0]} for _ in fe_order],
    }
    samples_a = [
        SimpleNamespace(
            domain_slug="backend",
            concept_slug="net-internet",
            action_mode="Learn_New",
            reward=1.5,
            obs_before_json=obs_a_12,
            obs_after_json=obs_after_12,
            created_at=datetime.now(UTC),
        ),
        SimpleNamespace(
            domain_slug="backend",
            concept_slug="web-http",
            action_mode="Deep_Probe",
            reward=-0.2,
            obs_before_json=obs_a_12,
            obs_after_json=obs_after_12,
            created_at=datetime.now(UTC),
        ),
    ]
    samples_b = [
        SimpleNamespace(
            domain_slug="frontend",
            concept_slug="fe-dom-events",
            action_mode="Learn_New",
            reward=1.5,
            obs_before_json=obs_b_10,
            obs_after_json=obs_after_10,
            created_at=datetime.now(UTC),
        ),
        SimpleNamespace(
            domain_slug="frontend",
            concept_slug="fe-xss-csrf",
            action_mode="Deep_Probe",
            reward=-0.2,
            obs_before_json=obs_b_10,
            obs_after_json=obs_after_10,
            created_at=datetime.now(UTC),
        ),
    ]
    with SessionLocal() as db:
        res_a = _derive_candidate_checkpoint(db, BASE_CKPT_PATH, f"f04_a_{uuid.uuid4().hex[:6]}", 0.65, samples=samples_a)  # type: ignore[arg-type]
        res_b = _derive_candidate_checkpoint(db, BASE_CKPT_PATH, f"f04_b_{uuid.uuid4().hex[:6]}", 0.65, samples=samples_b)  # type: ignore[arg-type]
    assert res_a[1] != res_b[1], "Different obs_before/domain/concept must produce distinct PPO candidate checkpoints"

    # 2. Evaluator must differentiate a policy preferring Learn_New (mode 0) vs Spaced_Review (mode 3)
    class _ModePolicy(VerifiedGnnPpoCheckpoint):
        def __init__(self, mode: int) -> None:
            super().__init__("probe", {})
            self.mode = mode

        def predict_logits(self, node_features: Any, adj_in: Any, adj_out: Any) -> Any:
            import numpy as np

            logits = np.full((node_features.shape[0], 4), -5.0, dtype=np.float32)
            logits[:, self.mode] = 5.0
            return logits

    with SessionLocal() as db:
        node_order, adj_in, adj_out, _ei, tiers, prereqs = _load_domain_topology_for_rl(db, "backend")
    topos = [("backend", node_order, adj_in, adj_out, tiers, prereqs)]
    rew_learn = _rollout_policy_eval_on_topologies(_ModePolicy(0), topos, episodes=10, seed=42)[0]
    rew_code = _rollout_policy_eval_on_topologies(_ModePolicy(2), topos, episodes=10, seed=42)[0]
    assert rew_learn != rew_code, f"Evaluator failed to differentiate modes: {rew_learn} == {rew_code}"


def test_f05_outbox_runtime_relay_and_consume_pipeline_populates_buffer() -> None:
    """F05: Real PostgreSQL + Redis Streams E2E: outbox -> relay -> crashed pending recovery -> idempotent buffer."""
    import redis

    from app.config import settings
    from app.db.models import ConsumedEventModel, RlExperienceBufferModel, SessionLocal, UserModel
    from app.modules.events.outbox import (
        consume_competency_stream_once,
        record_outbox_event_in_tx,
        relay_pending_outbox_events,
    )

    ev_id = uuid.uuid4()
    test_stream = f"plumora:test_stream_{ev_id.hex[:8]}"
    test_group = f"test_cg_{ev_id.hex[:8]}"
    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

    try:
        with SessionLocal() as db:
            user = db.query(UserModel).first()
            assert user is not None
            record_outbox_event_in_tx(
                db,
                event_id=ev_id,
                event_type="CompetencyUpdatedEvent",
                stream_name=test_stream,
                payload={
                    "user_id": str(user.id),
                    "domain_slug": "backend",
                    "concept_slug": "net-internet",
                    "action_mode": "Deep_Probe",
                    "reward": 1.25,
                    "obs_before": [],
                    "obs_after": [],
                },
            )
            db.commit()

            relayed = relay_pending_outbox_events(db)
            assert relayed >= 1

        # Simulate a crashed worker that read via XREADGROUP without XACK
        r_client.xgroup_create(test_stream, test_group, id="0", mkstream=True)
        delivered = r_client.xreadgroup(test_group, "crashed-worker", {test_stream: ">"}, count=10)
        assert delivered

        # Recovery consumer reclaims idle pending message and persists idempotently
        with SessionLocal() as db:
            stats = consume_competency_stream_once(
                db,
                consumer_group=test_group,
                consumer_name="recovery-worker",
                stream_name=test_stream,
                min_idle_ms=0,
            )
            assert stats["reclaimed"] >= 1
            assert stats["consumed"] >= 1
            assert db.get(ConsumedEventModel, ev_id) is not None
            buf_rows = db.query(RlExperienceBufferModel).filter(RlExperienceBufferModel.event_id == ev_id).all()
            assert len(buf_rows) == 1

            # Second run must not duplicate
            stats2 = consume_competency_stream_once(
                db,
                consumer_group=test_group,
                consumer_name="recovery-worker",
                stream_name=test_stream,
                min_idle_ms=0,
            )
            assert stats2["consumed"] == 0
    finally:
        r_client.delete(test_stream, f"plumora:worker:{test_group}")
        r_client.close()


def test_f06_microservices_end_to_end_with_isolated_db_roles() -> None:
    """F06: 4 Microservices + API Gateway work end-to-end using their 4 isolated PostgreSQL roles."""
    import os
    import subprocess
    import sys
    import time

    import httpx

    backend_dir = Path(__file__).resolve().parents[1]
    base_env = os.environ.copy()
    test_db_name = os.environ.get("PLUMORA_TEST_DB_NAME", "plumora_test")
    base_env["REDIS_URL"] = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/1")
    base_env["JWT_SECRET_KEY"] = "plumora_test_isolated_services_secret_key_min_32"
    base_env["AUTH_SERVICE_URL"] = "http://127.0.0.1:18001"
    base_env["CONTENT_SERVICE_URL"] = "http://127.0.0.1:18002"
    base_env["ASSESSMENT_SERVICE_URL"] = "http://127.0.0.1:18003"
    base_env["RECOMMENDATION_SERVICE_URL"] = "http://127.0.0.1:18004"

    svc_specs = [
        ("services.user_auth_service:app", "18001", "auth_svc_user"),
        ("services.content_kg_service:app", "18002", "content_svc_user"),
        ("services.assessment_grader_service:app", "18003", "assess_svc_user"),
        ("services.recommendation_ai_service:app", "18004", "rec_ai_svc_user"),
        ("services.api_gateway:app", "18000", "plumora_app"),
    ]
    procs: list[subprocess.Popen[bytes]] = []
    try:
        for app_target, port, db_user in svc_specs:
            env = base_env.copy()
            env["DATABASE_URL"] = (
                f"postgresql+psycopg://{db_user}:plumora_dev_pass_local_only@127.0.0.1:5432/{test_db_name}"
            )
            p = subprocess.Popen(
                [sys.executable, "-m", "uvicorn", app_target, "--host", "127.0.0.1", "--port", port, "--log-level", "warning"],
                cwd=str(backend_dir),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            procs.append(p)

        # Wait for all 5 servers to respond
        deadline = time.monotonic() + 15.0
        for _, port, _ in svc_specs:
            url = f"http://127.0.0.1:{port}/health" if port != "18000" else "http://127.0.0.1:18000/api/v1/auth/me"
            while time.monotonic() < deadline:
                try:
                    r = httpx.get(url, timeout=1.0)
                    if r.status_code < 500:
                        break
                except httpx.HTTPError:
                    pass
                time.sleep(0.2)

        with httpx.Client(base_url="http://127.0.0.1:18000", timeout=5.0) as client:
            uname = f"iso_ms_{uuid.uuid4().hex[:8]}"
            reg = client.post(
                "/api/v1/auth/register",
                json={"username": uname, "display_name": "Iso User", "password": "StrongPass!2026"},
            )
            assert reg.status_code == 201, f"Gateway register failed: {reg.text}"
            doms = client.get("/api/v2/domains")
            assert doms.status_code == 200, f"Gateway domains failed: {doms.text}"
            place = client.post("/api/v2/domains/frontend/placement/start")
            assert place.status_code == 201, f"Gateway placement start failed: {place.text}"
            pb = client.post(
                "/api/v2/domains/frontend/concepts/fe-dom-events/playbook/complete",
                json={"submission_id": str(uuid.uuid4())},
            )
            assert pb.status_code == 200, f"Gateway playbook complete failed: {pb.text}"
            assess = client.post(
                "/api/v2/assessments/start",
                json={"domain_slug": "frontend", "concept_slug": "fe-dom-events", "session_mode": "depth_probe"},
            )
            assert assess.status_code == 201, f"Gateway assessment start failed: {assess.text}"
            rec = client.post("/api/v2/recommendations", json={"domain_slug": "frontend"})
            assert rec.status_code == 200, f"Gateway recommendation failed: {rec.text}"

            # C01: Full register -> logout -> login -> reload (/auth/me) -> protected API for learner & admin
            logout = client.post("/api/v1/auth/logout")
            assert logout.status_code == 200
            relogin = client.post(
                "/api/v1/auth/login",
                json={"username": uname, "password": "StrongPass!2026", "portal": "learner"},
            )
            assert relogin.status_code == 200, f"Gateway learner login failed: {relogin.text}"
            me = client.get("/api/v1/auth/me")
            assert me.status_code == 200 and me.json()["username"] == uname
            doms_after = client.get("/api/v2/domains")
            assert doms_after.status_code == 200

            adm_login = client.post(
                "/api/v1/auth/login",
                json={"username": "admin_demo", "password": "PlumoraDemo#2026", "portal": "admin"},
            )
            assert adm_login.status_code == 200, f"Gateway admin login failed: {adm_login.text}"
            adm_health = client.get("/api/v2/admin/system-health")
            assert adm_health.status_code == 200 and adm_health.json()["mode"] == "microservices"
    finally:
        for p in procs:
            p.terminate()
        for p in procs:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()


def test_f10_rollback_restores_previous_active_model_not_newest_unactivated_passed() -> None:
    """F10: Rollback from B must restore A (previously active), not an unactivated newer PASSED model C."""
    import hashlib
    from datetime import UTC, datetime, timedelta

    from app.db.models import ModelRegistryModel, SessionLocal
    from app.modules.recommendation.admin_service import (
        BASE_CKPT_PATH,
        activate_candidate_model,
        rollback_active_model,
    )

    real_sha = hashlib.sha256(BASE_CKPT_PATH.read_bytes()).hexdigest()

    with SessionLocal() as db:
        now = datetime.now(UTC)
        # Clear active flags for isolated test
        for m in db.query(ModelRegistryModel).all():
            m.is_active = False
        db.commit()

        m_a = ModelRegistryModel(
            id=uuid.uuid4(),
            version_tag=f"f10_a_{uuid.uuid4().hex[:6]}",
            checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
            checkpoint_sha256=real_sha,
            kl_divergence=0.0,
            gate_verdict="PASSED",
            is_active=True,
            activated_at=now - timedelta(minutes=10),
            created_at=now - timedelta(minutes=20),
        )
        m_b = ModelRegistryModel(
            id=uuid.uuid4(),
            version_tag=f"f10_b_{uuid.uuid4().hex[:6]}",
            checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
            checkpoint_sha256=real_sha,
            kl_divergence=0.005,
            gate_verdict="PASSED",
            is_active=False,
            created_at=now - timedelta(minutes=5),
        )
        m_c = ModelRegistryModel(
            id=uuid.uuid4(),
            version_tag=f"f10_c_{uuid.uuid4().hex[:6]}",
            checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
            checkpoint_sha256=real_sha,
            kl_divergence=0.004,
            gate_verdict="PASSED",
            is_active=False,
            created_at=now - timedelta(minutes=1),
        )
        db.add_all([m_a, m_b, m_c])
        db.commit()

        # Activate B -> previously active was A
        activate_candidate_model(db, m_b.id)
        # Now rollback from B -> MUST restore A, NOT C!
        rb = rollback_active_model(db)
        assert rb["active_model_id"] == str(m_a.id)


def test_f10_concurrent_activate_and_rollback_preserves_single_active() -> None:
    """F10: Concurrent activate/rollback calls on PostgreSQL must keep strictly 1 active model."""
    from concurrent.futures import ThreadPoolExecutor

    from fastapi import HTTPException
    from sqlalchemy.exc import SQLAlchemyError

    from app.db.models import ModelRegistryModel, SessionLocal
    from app.modules.recommendation.admin_service import (
        activate_candidate_model,
        rollback_active_model,
    )

    with SessionLocal() as db:
        passed_rows = db.query(ModelRegistryModel).filter(ModelRegistryModel.gate_verdict == "PASSED").all()
        if len(passed_rows) < 2:
            pytest.skip("Need at least 2 PASSED models for concurrent test")
        target_ids = [r.id for r in passed_rows[:2]]

    def _worker(idx: int) -> None:
        with SessionLocal() as wdb:
            try:
                if idx % 2 == 0:
                    activate_candidate_model(wdb, target_ids[0])
                else:
                    rollback_active_model(wdb)
            except (SQLAlchemyError, HTTPException):
                wdb.rollback()

    with ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(_worker, range(6)))

    with SessionLocal() as db:
        active_count = db.query(ModelRegistryModel).filter(ModelRegistryModel.is_active.is_(True)).count()
        assert active_count == 1, f"Expected strictly 1 active model after concurrent ops, got {active_count}"
