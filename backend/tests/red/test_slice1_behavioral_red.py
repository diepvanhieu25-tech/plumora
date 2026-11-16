"""Expanded behavioral TDD tests for SLICE-01 (PL-AUTH-01..PL-REC-02)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_pl_auth_01_unauthenticated_me_returns_401() -> None:
    """PL-AUTH-01: Unauthenticated request to /api/v1/auth/me must return 401 AUTH_REQUIRED."""
    client = TestClient(app)
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error_code"] == "AUTH_REQUIRED"


def test_pl_auth_01_seeded_demo_learner_login_succeeds() -> None:
    """PL-AUTH-01 (D-11): Seeded learner_foundation account can authenticate via real login."""
    client = TestClient(app)
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "learner_foundation", "password": "PlumoraDemo#2026"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "learner_foundation"
    assert data["user"]["state_version"] >= 1


def test_pl_auth_01_register_and_logout_flow() -> None:
    """PL-AUTH-01: Register new user, access /me, logout, and verify /me returns 401."""
    client = TestClient(app)
    unique_user = f"usr_{uuid.uuid4().hex[:8]}"
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": unique_user,
            "display_name": "Học viên Kiểm thử",
            "password": "SafePassword#2026",
        },
    )
    assert reg_res.status_code == 201
    assert reg_res.json()["user"]["username"] == unique_user

    me_res = client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["username"] == unique_user

    logout_res = client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["logged_out"] is True

    me_after = client.get("/api/v1/auth/me")
    assert me_after.status_code == 401


def test_pl_content_01_roadmap_returns_12_concepts_across_4_tiers() -> None:
    """PL-CONTENT-01 (D-05): GET /api/v1/roadmap returns 12 concepts across 4 DAG tiers."""
    client = TestClient(app)
    client.post(
        "/api/v1/auth/login",
        json={"username": "learner_new", "password": "PlumoraDemo#2026"},
    )
    response = client.get("/api/v1/roadmap")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total_concepts"] == 12
    assert len(payload["nodes"]) == 12
    tier1_slugs = {n["slug"] for n in payload["nodes"] if n["tier"] == 1}
    assert tier1_slugs == {"net-internet", "os-basics"}


def test_pl_quiz_01_and_progress_01_boundary_75_and_idempotency() -> None:
    """PL-QUIZ-01 & PL-PROGRESS-01 (D-06, D-10): 3/4 correct passes (75%) and is idempotent."""
    client = TestClient(app)
    client.post(
        "/api/v1/auth/login",
        json={"username": "learner_new", "password": "PlumoraDemo#2026"},
    )
    # Reset to clean new_learner preset first
    preset_res = client.post("/api/v1/me/preset", json={"preset_key": "new_learner"})
    assert preset_res.status_code == 200

    concept_res = client.get("/api/v1/concepts/net-internet")
    assert concept_res.status_code == 200
    questions = concept_res.json()["questions"]
    assert len(questions) == 4
    for q in questions:
        assert "correct_option_key" not in q

    # Boundary 1: 2/4 correct (50% < 75% -> passed = False)
    # In our seed bank, correct option for all 4 questions is 'A'
    sub_id_50 = str(uuid.uuid4())
    answers_50 = [
        {"question_id": questions[0]["id"], "selected_option": "A"},
        {"question_id": questions[1]["id"], "selected_option": "A"},
        {"question_id": questions[2]["id"], "selected_option": "B"},
        {"question_id": questions[3]["id"], "selected_option": "B"},
    ]
    res_50 = client.post(
        "/api/v1/concepts/net-internet/attempts",
        json={"submission_id": sub_id_50, "answers": answers_50},
    )
    assert res_50.status_code == 200
    data_50 = res_50.json()
    assert data_50["correct_count"] == 2
    assert data_50["attempt_score"] == 0.50
    assert data_50["passed"] is False
    assert data_50["mastery_after"] == 0.50

    # Boundary 2: 3/4 correct (75% >= 75% -> passed = True, unlocks web-http)
    sub_id_75 = str(uuid.uuid4())
    answers_75 = [
        {"question_id": questions[0]["id"], "selected_option": "A"},
        {"question_id": questions[1]["id"], "selected_option": "A"},
        {"question_id": questions[2]["id"], "selected_option": "A"},
        {"question_id": questions[3]["id"], "selected_option": "B"},
    ]
    sub1 = client.post(
        "/api/v1/concepts/net-internet/attempts",
        json={"submission_id": sub_id_75, "answers": answers_75},
    )
    assert sub1.status_code == 200
    d1 = sub1.json()
    assert d1["correct_count"] == 3
    assert d1["attempt_score"] == 0.75
    assert d1["passed"] is True
    assert d1["mastery_before"] == 0.50
    assert d1["mastery_after"] == 0.75
    assert "web-http" in d1["newly_unlocked_slugs"]

    # Idempotency check: repeating same submission_id returns exact same attempt_id & state_version
    sub2 = client.post(
        "/api/v1/concepts/net-internet/attempts",
        json={"submission_id": sub_id_75, "answers": answers_75},
    )
    assert sub2.status_code == 200
    assert sub2.json()["idempotent_replay"] is True
    assert sub2.json()["attempt_id"] == d1["attempt_id"]
    assert sub2.json()["state_version"] == d1["state_version"]

    # High-Water Mark check (INV-MASTERY-01): retaking with 0/4 keeps mastery_after at 0.75
    sub_id_0 = str(uuid.uuid4())
    answers_0 = [{"question_id": q["id"], "selected_option": "D"} for q in questions]
    res_0 = client.post(
        "/api/v1/concepts/net-internet/attempts",
        json={"submission_id": sub_id_0, "answers": answers_0},
    )
    assert res_0.status_code == 200
    assert res_0.json()["attempt_score"] == 0.0
    assert res_0.json()["mastery_after"] == 0.75


def test_pl_quiz_01_locked_concept_rejected_with_403() -> None:
    """INV-DAG-01 (PL-QUIZ-01): Accessing or submitting quiz for Locked concept returns 403."""
    client = TestClient(app)
    client.post(
        "/api/v1/auth/login",
        json={"username": "learner_new", "password": "PlumoraDemo#2026"},
    )
    client.post("/api/v1/me/preset", json={"preset_key": "new_learner"})
    response = client.get("/api/v1/concepts/sec-api")
    assert response.status_code == 403
    assert response.json()["error_code"] == "CONCEPT_LOCKED"


def test_pl_rec_01_and_02_recommendation_returns_provenance_metadata() -> None:
    """PL-REC-01 & PL-REC-02 (D-07, D-10): Recommendation returns honest policy/state source."""
    client = TestClient(app)
    client.post(
        "/api/v1/auth/login",
        json={"username": "learner_foundation", "password": "PlumoraDemo#2026"},
    )
    client.post("/api/v1/me/preset", json={"preset_key": "foundation_ready"})
    response = client.post("/api/v1/recommendations")
    assert response.status_code == 200
    data = response.json()
    assert data["policy_source"] in {"dqn", "dqn_masked_q", "fallback_rule"}
    assert data["state_source"] in {
        "redis_cache",
        "postgres_cache_warm",
        "postgres_fallback",
    }
    assert data["recommended_concept"]["slug"] in {
        "db-transactions",
        "db-nosql",
        "api-rest",
    }
    assert len(data["observation_24d"]) == 24
