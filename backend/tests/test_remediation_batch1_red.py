"""RED -> GREEN remediation tests for Batch 1: F01 (SQL Sandbox), F02 (Assessment Integrity), F13 (Hidden Test Leak)."""

from __future__ import annotations

import time
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxTimeoutError,
)


def _register_fresh_user(client: TestClient, prefix: str = "rem_b1") -> None:
    uname = f"{prefix}_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "display_name": "Remediation Batch 1 User",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201


def test_f01_sql_recursive_query_times_out_in_isolated_worker() -> None:
    """F01: Recursive SQL CPU bomb must be terminated by timeout_ms in isolated subprocess."""
    worker = IsolatedSandboxWorkerAdapter()
    recursive_sql = (
        "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM cnt) "
        "SELECT COUNT(*) FROM cnt;"
    )
    t0 = time.monotonic()
    with pytest.raises(SandboxTimeoutError):
        worker.execute(
            language="sql",
            source_code=recursive_sql,
            test_cases=[{"name": "t1", "expected": [[1]]}],
            timeout_ms=200,
        )
    elapsed = time.monotonic() - t0
    assert elapsed < 1.5, f"SQL timeout took too long: {elapsed:.2f}s"


def test_f02_depth_probe_rejects_resubmitting_tier1_question_to_climb_tiers() -> None:
    """F02: Re-submitting Tier 1 question with new submission_id must be rejected once session is at Tier 2."""
    with TestClient(app) as client:
        _register_fresh_user(client, "f02_depth")
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

        # Find the correct option for q1 by checking seeded DB or trying; in fe-dom-events tier 1 we can read from DB
        from app.db.models import DepthQuestionModel, SessionLocal

        with SessionLocal() as db:
            q_row = db.get(DepthQuestionModel, uuid.UUID(q1["question_id"]))
            assert q_row is not None
            correct_opt = q_row.correct_option_key or "A"

        # Step 1: Pass Tier 1 legitimately -> advances to Tier 2
        r1 = client.post(
            f"/api/v2/assessments/{session_id}/submit",
            json={
                "submission_id": str(uuid.uuid4()),
                "question_id": q1["question_id"],
                "selected_option": correct_opt,
                "written_explanation": None,
            },
        )
        assert r1.status_code == 200
        assert r1.json()["step_passed"] is True
        assert r1.json()["next_depth_tier"] == 2

        # Step 2 (Exploit attempt): Re-submit Tier 1 question_id with a brand new submission_id
        r_exploit = client.post(
            f"/api/v2/assessments/{session_id}/submit",
            json={
                "submission_id": str(uuid.uuid4()),
                "question_id": q1["question_id"],
                "selected_option": correct_opt,
                "written_explanation": None,
            },
        )
        assert r_exploit.status_code in (400, 409)
        assert r_exploit.json()["detail"]["error_code"] in (
            "QUESTION_TIER_MISMATCH",
            "QUESTION_STEP_MISMATCH",
        )


def test_f02_placement_rejects_non_current_question_id() -> None:
    """F02: Placement answer must match the currently issued question_id in session state."""
    with TestClient(app) as client:
        _register_fresh_user(client, "f02_place")
        start = client.post("/api/v2/domains/frontend/placement/start")
        assert start.status_code == 201
        data = start.json()
        session_id = data["session_id"]
        curr_q_id = data["current_question"]["question_id"]

        # Pick another question from the same domain 'frontend'
        from sqlalchemy import select

        from app.db.models import DepthQuestionModel, DomainConceptMapModel, SessionLocal

        with SessionLocal() as db:
            other_q = db.scalars(
                select(DepthQuestionModel)
                .join(
                    DomainConceptMapModel,
                    DomainConceptMapModel.concept_slug == DepthQuestionModel.concept_slug,
                )
                .where(
                    DomainConceptMapModel.domain_slug == "frontend",
                    DepthQuestionModel.id != uuid.UUID(curr_q_id),
                )
            ).first()
            assert other_q is not None

        res = client.post(
            f"/api/v2/domains/frontend/placement/{session_id}/answer",
            json={
                "submission_id": str(uuid.uuid4()),
                "question_id": str(other_q.id),
                "selected_option": "A",
            },
        )
        assert res.status_code in (400, 409)
        assert res.json()["detail"]["error_code"] == "QUESTION_STEP_MISMATCH"


def test_f13_hidden_test_cases_do_not_leak_expected_or_actual() -> None:
    """F13: Hidden test cases (is_hidden=True) must not expose expected or actual in test_results."""
    worker = IsolatedSandboxWorkerAdapter()
    cases = [
        {"name": "public_case", "call": "add(1, 2)", "expected": 3, "is_hidden": False},
        {"name": "hidden_case", "call": "add(10, 20)", "expected": 30, "is_hidden": True},
    ]
    res = worker.execute(
        language="python",
        source_code="def add(a, b):\n    return 0\n",
        test_cases=cases,
    )
    by_name = {r["name"]: r for r in res.test_results}
    assert by_name["public_case"]["expected"] == 3
    assert "expected" not in by_name["hidden_case"]
    assert "actual" not in by_name["hidden_case"]
    assert by_name["hidden_case"]["is_hidden"] is True
    assert by_name["hidden_case"]["passed"] is False


def test_f13_hidden_test_error_does_not_leak_hidden_inputs() -> None:
    """F13: Exceptions raised with hidden arguments must not leak hidden inputs in public error field."""
    worker = IsolatedSandboxWorkerAdapter()
    cases = [
        {"name": "public_case", "call": "add(1, 2)", "expected": 3, "is_hidden": False},
        {"name": "hidden_case", "call": "add(918273, 645321)", "expected": 1563594, "is_hidden": True},
    ]
    res = worker.execute(
        language="python",
        source_code="def add(a, b):\n    raise ValueError(f'{a}:{b}')\n",
        test_cases=cases,
    )
    by_name = {r["name"]: r for r in res.test_results}
    assert "918273" not in str(by_name["hidden_case"])
    assert "645321" not in str(by_name["hidden_case"])
    assert by_name["hidden_case"].get("error") == "Hidden test execution failed"
