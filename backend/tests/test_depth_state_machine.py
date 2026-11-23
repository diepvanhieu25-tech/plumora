"""Behavioral RED tests for PL3-ASSESS-01: Adaptive Placement & 5-Depth State Machine."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _register_fresh_user(client: TestClient) -> str:
    uname = f"p3_assess_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "display_name": "P3 Assess Learner",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201
    return uname


def test_pl3_assess_01_adaptive_placement_cap_at_075_and_confidence_060() -> None:
    """Adaptive Placement asks <= 6 questions and caps initialized depth_level_norm at 0.75."""
    with TestClient(app) as client:
        _register_fresh_user(client)
        start_res = client.post("/api/v2/domains/frontend/placement/start")
        assert start_res.status_code == 201
        data = start_res.json()
        assert data["max_questions"] <= 6
        session_id = data["session_id"]
        q = data["current_question"]
        assert q is not None

        # Answer up to 6 questions (using deterministic correct option from placement engine)
        steps = 0
        last_body: dict[str, object] = {}
        while q is not None and steps < 6:
            steps += 1
            ans_res = client.post(
                f"/api/v2/domains/frontend/placement/{session_id}/answer",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "question_id": q["question_id"],
                    "selected_option": "A",
                },
            )
            assert ans_res.status_code == 200
            last_body = ans_res.json()
            if last_body["placement_status"] == "completed":
                break
            q = last_body["next_question"]

        initialized = last_body.get("initialized_nodes", [])
        assert isinstance(initialized, list)
        for node in initialized:
            assert node["depth_level_norm"] <= 0.75
            if node["depth_level_norm"] > 0.0:
                assert node["confidence"] == 0.60
                assert node["stability_s"] == 3.0


def test_pl3_assess_01_locked_concept_returns_403() -> None:
    """Starting depth probe on a locked concept raises 403 CONCEPT_LOCKED (INV-DAG-01)."""
    with TestClient(app) as client:
        _register_fresh_user(client)
        res = client.post(
            "/api/v2/assessments/start",
            json={
                "domain_slug": "frontend",
                "concept_slug": "fe-xss-csrf",
                "session_mode": "depth_probe",
            },
        )
        assert res.status_code == 403
        assert res.json()["detail"]["error_code"] == "CONCEPT_LOCKED"


def test_pl3_assess_01_five_depth_state_machine_ceiling_and_idempotency() -> None:
    """5-Depth State Machine stops on 2 consecutive fails at same tier and enforces idempotency."""
    with TestClient(app) as client:
        _register_fresh_user(client)
        pb = client.post(
            "/api/v2/domains/frontend/concepts/fe-dom-events/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
        )
        assert pb.status_code == 200
        start = client.post(
            "/api/v2/assessments/start",
            json={
                "domain_slug": "frontend",
                "concept_slug": "fe-dom-events",
                "session_mode": "depth_probe",
            },
        )
        assert start.status_code == 201
        sess = start.json()
        session_id = sess["session_id"]
        q1 = sess["step_item"]
        assert q1["depth_tier"] == 1

        # Fail twice at tier 1 with wrong answer
        sub1 = str(uuid.uuid4())
        r1 = client.post(
            f"/api/v2/assessments/{session_id}/submit",
            json={
                "submission_id": sub1,
                "question_id": q1["question_id"],
                "selected_option": "Z",
                "written_explanation": None,
            },
        )
        assert r1.status_code == 200
        assert r1.json()["step_passed"] is False
        assert r1.json()["session_status"] == "active"

        # Idempotent replay
        r1_replay = client.post(
            f"/api/v2/assessments/{session_id}/submit",
            json={
                "submission_id": sub1,
                "question_id": q1["question_id"],
                "selected_option": "Z",
                "written_explanation": None,
            },
        )
        assert r1_replay.status_code == 200
        assert r1_replay.json()["idempotent_replay"] is True

        # Second consecutive fail at tier 1 -> ceiling_reached at d=0
        r2 = client.post(
            f"/api/v2/assessments/{session_id}/submit",
            json={
                "submission_id": str(uuid.uuid4()),
                "question_id": q1["question_id"],
                "selected_option": "Z",
                "written_explanation": None,
            },
        )
        assert r2.status_code == 200
        assert r2.json()["session_status"] == "ceiling_reached"
        assert r2.json()["updated_competency"]["depth_level_norm"] == 0.25
        assert r2.json()["updated_competency"]["confidence"] >= 0.50


def test_pl3_assess_01_insufficient_evidence_preserves_existing_competency() -> None:
    """Abandoning a session with < 2 steps returns insufficient_evidence without overwriting."""
    from app.modules.assessment.depth_state_machine import map_depth_to_competency

    mapped = map_depth_to_competency(
        highest_passed_tier=1,
        passed_code_sandbox=False,
        rubric_score=None,
        abandoned=True,
        steps_completed=1,
        existing_depth=0.50,
    )
    assert mapped.depth_label == "insufficient_evidence"
    assert mapped.depth_level_norm == 0.50
    assert mapped.confidence < 0.50
