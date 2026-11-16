"""Adversarial & Fallback Verification Tests for SLICE-01 (PL-REC-02, PL-QUIZ-01, PL-AUTH-01)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import UserConceptMasteryModel, UserModel, engine
from app.main import app, ensure_db_initialized
from app.modules.recommendation import compute_recommendation


def test_pl_rec_02_corrupted_checkpoint_falls_back_to_fallback_rule_never_dqn() -> None:
    """PL-REC-02 (INV-RL-01): Missing/corrupted checkpoint must return policy_source='fallback_rule'."""
    ensure_db_initialized()
    with Session(engine) as db:
        user = db.scalar(select(UserModel).where(UserModel.username == "learner_foundation"))
        assert user is not None
        res = compute_recommendation(
            db,
            user.id,
            checkpoint_path_override="/nonexistent/corrupted_checkpoint.zip",
        )
        assert res["status"] == "active"
        assert res["policy_source"] == "fallback_rule"
        assert res["degraded"] is True
        assert res["checkpoint_sha256"] is None
        assert res["recommended_concept"]["slug"] == "db-transactions"


def test_pl_rec_02_redis_unavailable_falls_back_to_postgres_fallback() -> None:
    """PL-REC-02 (D-10): When Redis is unreachable, recommendation uses state_source='postgres_fallback'."""
    ensure_db_initialized()
    with Session(engine) as db:
        user = db.scalar(select(UserModel).where(UserModel.username == "learner_foundation"))
        assert user is not None
        res = compute_recommendation(
            db,
            user.id,
            redis_url_override="redis://127.0.0.1:6399/0",  # Unreachable port
        )
        assert res["status"] == "active"
        assert res["state_source"] == "postgres_fallback"
        assert res["degraded"] is True
        assert res["policy_source"] in {"dqn", "dqn_masked_q"}


def test_pl_rec_02_all_12_concepts_mastered_returns_completed_state() -> None:
    """PL-REC-02 (D-07): When all 12/12 concepts have mastery >= 0.75, status is 'completed'."""
    client = TestClient(app)
    unique_user = f"grad_{uuid.uuid4().hex[:8]}"
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "username": unique_user,
            "display_name": "Học viên Hoàn thành 12/12",
            "password": "SafePassword#2026",
        },
    )
    assert reg.status_code == 201
    user_id = uuid.UUID(reg.json()["user"]["id"])

    with Session(engine) as db:
        rows = db.scalars(
            select(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == user_id)
        ).all()
        for r in rows:
            r.mastery_score = 1.0
            r.is_mastered = True
        u = db.get(UserModel, user_id)
        assert u is not None
        u.state_version += 1
        db.commit()

    rec_res = client.post("/api/v1/recommendations")
    assert rec_res.status_code == 200
    data = rec_res.json()
    assert data["status"] == "completed"
    assert data["policy_source"] == "completed"
    assert data["recommended_concept"] is None


def test_pl_quiz_01_rejects_incomplete_answers_and_locked_submission() -> None:
    """PL-QUIZ-01: Rejects <4 answers with 422 and Locked concept POST attempt with 403."""
    client = TestClient(app)
    client.post(
        "/api/v1/auth/login",
        json={"username": "learner_new", "password": "PlumoraDemo#2026"},
    )
    client.post("/api/v1/me/preset", json={"preset_key": "new_learner"})

    # 1. Attempting to submit quiz on locked concept sec-api returns 403 CONCEPT_LOCKED
    locked_post = client.post(
        "/api/v1/concepts/sec-api/attempts",
        json={
            "submission_id": str(uuid.uuid4()),
            "answers": [
                {"question_id": "00000000-0000-4000-8000-000000001101", "selected_option": "A"},
                {"question_id": "00000000-0000-4000-8000-000000001102", "selected_option": "A"},
                {"question_id": "00000000-0000-4000-8000-000000001103", "selected_option": "A"},
                {"question_id": "00000000-0000-4000-8000-000000001104", "selected_option": "A"},
            ],
        },
    )
    assert locked_post.status_code == 403
    assert locked_post.json()["error_code"] == "CONCEPT_LOCKED"

    # 2. Submitting only 3 answers on unlocked concept net-internet returns 422
    incomplete_post = client.post(
        "/api/v1/concepts/net-internet/attempts",
        json={
            "submission_id": str(uuid.uuid4()),
            "answers": [
                {"question_id": "00000000-0000-4000-8000-000000000001", "selected_option": "A"},
                {"question_id": "00000000-0000-4000-8000-000000000002", "selected_option": "A"},
                {"question_id": "00000000-0000-4000-8000-000000000003", "selected_option": "A"},
            ],
        },
    )
    assert incomplete_post.status_code == 422
    assert incomplete_post.json()["error_code"] == "QUIZ_VALIDATION_ERROR"


def test_pl_auth_01_anti_idor_session_isolation() -> None:
    """PL-AUTH-01 (D-11): Applying a preset on learner_new never mutates learner_api_stage."""
    client_a = TestClient(app)
    client_b = TestClient(app)

    client_a.post(
        "/api/v1/auth/login",
        json={"username": "learner_new", "password": "PlumoraDemo#2026"},
    )
    client_b.post(
        "/api/v1/auth/login",
        json={"username": "learner_api_stage", "password": "PlumoraDemo#2026"},
    )

    client_b.post("/api/v1/me/preset", json={"preset_key": "api_stage_ready"})
    client_a.post("/api/v1/me/preset", json={"preset_key": "new_learner"})

    roadmap_a = client_a.get("/api/v1/roadmap").json()
    roadmap_b = client_b.get("/api/v1/roadmap").json()
    assert roadmap_a["mastered_count"] == 0
    assert roadmap_b["mastered_count"] == 7
