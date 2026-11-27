"""Gate 2 RED -> GREEN Behavioral Tests for Plumora v4.0 Final Baseline (D-31, D-34, D-35, D-36)."""

from __future__ import annotations

import json
import uuid
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient
from sqlalchemy import select

import app.db.models as db_models
import app.modules.auth.router as auth_router
from app.config import REPO_ROOT
from app.db.models import RecommendationLogModel, SessionLocal
from app.main import app
from app.modules.assessment.depth_state_machine import map_depth_to_competency
from app.modules.assessment.service_v2 import _RUBRIC_SERVICE
from app.modules.content import kg_service
from services.api_gateway import app as gateway_app

SEED_DIR = Path(__file__).resolve().parents[1] / "app" / "seed"


def test_v4_d31_legacy_v1_models_and_dead_hooks_removed_and_v2_rec_logged() -> None:
    """D-31: Orphaned v1 ORM models & dead hooks removed; PHASE3_ANALYSIS deleted; v2 recommendations logged."""
    for removed_cls in (
        "ConceptModel",
        "ConceptPrerequisiteModel",
        "QuizQuestionModel",
        "UserConceptMasteryModel",
        "QuizAttemptModel",
    ):
        assert not hasattr(db_models, removed_cls), f"Legacy v1 model {removed_cls} still exists"

    assert not hasattr(auth_router, "write_through_state_cache")
    assert not hasattr(kg_service, "sync_mvp_mastery_to_v2_competency")
    assert not (REPO_ROOT / "docs" / "proposals" / "PHASE3_ANALYSIS.md").exists()

    with TestClient(app) as client:
        uname = f"v4_reclog_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "V4 Rec Log", "password": "StrongPassword!123"},
        )
        assert reg.status_code == 201
        uid = uuid.UUID(reg.json()["user"]["id"])

        rec = client.post("/api/v2/recommendations", json={"domain_slug": "backend"})
        assert rec.status_code == 200
        with SessionLocal() as db:
            log_row = db.scalars(
                select(RecommendationLogModel).where(RecommendationLogModel.user_id == uid)
            ).first()
            assert log_row is not None
            assert log_row.domain_slug == "backend"
            assert log_row.recommended_concept_slug is not None


def test_v4_d34_dual_pillar_mastery_100_and_llm_env_timeout() -> None:
    """D-34 & D-35: Tier 5 without Code Sandbox caps at 0.75 when has_code_challenge=True; LLM timeout defaults to 8.0s."""
    # Tier 5 passed with rubric 0.95, but code sandbox NOT passed -> must cap at 0.75 Deep Understanding
    without_code = map_depth_to_competency(
        highest_passed_tier=5,
        passed_code_sandbox=False,
        rubric_score=0.95,
        has_code_challenge=True,
    )
    assert without_code.depth_level_norm == 0.75
    assert without_code.depth_label == "Deep Understanding"

    # Tier 5 passed AND code sandbox passed -> 1.00 Mastery
    with_code = map_depth_to_competency(
        highest_passed_tier=5,
        passed_code_sandbox=True,
        rubric_score=0.80,
        has_code_challenge=True,
    )
    assert with_code.depth_level_norm == 1.00
    assert with_code.depth_label == "Mastery"

    # LlmRubricGraderAdapter in service_v2 must respect default 8.0s (not hardcoded 4.0s)
    assert getattr(_RUBRIC_SERVICE.primary, "timeout_s", None) == 8.0


def test_v4_d35_all_22_playbooks_5_sections_shared_identical_and_220_questions_rotate() -> None:
    """D-35: All 3 domains have 5-part Playbooks >=2200 chars, identical shared markdown, and 220 rotating questions."""
    shared_markdown: dict[str, str] = {}
    for fname, expected in (
        ("backend_12_concepts.json", 12),
        ("frontend_10_concepts.json", 10),
        ("devops_9_concepts.json", 9),
    ):
        data = json.loads((SEED_DIR / fname).read_text(encoding="utf-8"))
        concepts = data["concepts"]
        assert len(concepts) == expected
        for c in concepts:
            assert "questions" not in c, f"{fname}:{c['slug']} still embeds legacy v1 MCQ questions"
            md = str(c["lesson_markdown"]).strip()
            assert len(md) >= 2200, f"{fname}:{c['slug']} Playbook too short: {len(md)}"
            for sec in ("## 1.", "## 2.", "## 3.", "## 4.", "## 5."):
                assert sec in md, f"{fname}:{c['slug']} missing section {sec}"
            if c.get("is_shared"):
                slug = str(c["slug"])
                if slug in shared_markdown:
                    assert shared_markdown[slug] == md, f"Shared concept {slug} markdown diverges in {fname}"
                else:
                    shared_markdown[slug] = md

    dq = json.loads((SEED_DIR / "depth_questions_and_rubrics.json").read_text(encoding="utf-8"))["questions"]
    assert len(dq) == 220, f"Expected 220 questions (2 per tier x 5 tiers x 22 concepts), got {len(dq)}"

    # Verify question rotation on 1st failure in depth_probe
    with TestClient(app) as client:
        uname = f"v4_qrot_{uuid.uuid4().hex[:8]}"
        client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "V4 QRot", "password": "StrongPassword!123"},
        )
        client.post(
            "/api/v2/domains/backend/concepts/net-internet/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
        )
        s_res = client.post(
            "/api/v2/assessments/start",
            json={"domain_slug": "backend", "concept_slug": "net-internet", "session_mode": "depth_probe"},
        )
        assert s_res.status_code == 201
        sid = s_res.json()["session_id"]
        q1_id = s_res.json()["step_item"]["question_id"]

        # Intentionally fail Attempt 1 on Tier 1 -> next_step_item MUST be a DIFFERENT Tier 1 question
        q1_correct = next(q["correct_option_key"] for q in dq if q["id"] == q1_id)
        wrong_opt = "B" if q1_correct == "A" else "A"
        sub1 = client.post(
            f"/api/v2/assessments/{sid}/submit",
            json={"submission_id": str(uuid.uuid4()), "question_id": q1_id, "selected_option": wrong_opt},
        )
        assert sub1.status_code == 200
        assert sub1.json()["session_status"] == "active"
        q2_id = sub1.json()["next_step_item"]["question_id"]
        assert q2_id != q1_id, "Retry on Tier 1 repeated the exact same question instead of rotating!"


def test_v4_d36_gateway_request_id_rate_limit_and_k8s_v4_manifests(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """D-36: API Gateway attaches X-Request-ID + enforces 429 rate limit; k8s/ manifests synced to v4.0."""
    monkeypatch.setenv("GATEWAY_AUTH_RATE_LIMIT_PER_MIN", "3")
    with TestClient(gateway_app) as gw:
        r_health = gw.get("/api/v1/health", headers={"X-Request-ID": "req-test-12345"})
        assert r_health.headers.get("X-Request-ID") == "req-test-12345"

        statuses = []
        for _ in range(5):
            resp = gw.post(
                "/api/v1/auth/login",
                json={"username": "nobody", "password": "wrong"},
                headers={"X-Forwarded-For": "198.51.100.77"},
            )
            statuses.append(resp.status_code)
        assert 429 in statuses, f"Expected 429 RATE_LIMITED after exceeding limit, got {statuses}"

    k8s_dir = REPO_ROOT / "k8s"
    docs = []
    for yf in sorted(k8s_dir.glob("*.yaml")):
        docs.extend([d for d in yaml.safe_load_all(yf.read_text(encoding="utf-8")) if d])

    kinds_names = {(d.get("kind"), d.get("metadata", {}).get("name")) for d in docs}
    assert ("PersistentVolumeClaim", "plumora-rl-candidates-pvc") in kinds_names
    assert ("Deployment", "frontend") in kinds_names
    assert ("Job", "db-migrate-seed") in kinds_names
    for d in docs:
        if d.get("kind") == "Deployment":
            pod_spec = d["spec"]["template"]["spec"]
            assert pod_spec.get("securityContext", {}).get("runAsNonRoot") is True
