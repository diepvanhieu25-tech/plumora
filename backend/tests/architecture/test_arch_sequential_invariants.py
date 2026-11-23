"""Fitness Function 5: Sequential Invariants (INV-SEQ-01, INV-SEQ-02, Abandon, Placement Unlock)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.db.models import DepthQuestionModel, SessionLocal
from app.main import app


def _register_user(client: TestClient, prefix: str) -> None:
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"{prefix}_{uuid.uuid4().hex[:8]}",
            "display_name": "Seq Invariant Learner",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201


def test_arch_inv_seq_01_playbook_required_before_depth_probe_and_sandbox() -> None:
    """INV-SEQ-01: Starting depth_probe before playbook/complete returns 409 PLAYBOOK_NOT_COMPLETED."""
    with TestClient(app) as client:
        _register_user(client, "inv_seq_01")

        # 1. Attempting depth_probe before completing Playbook -> 409 PLAYBOOK_NOT_COMPLETED
        blocked = client.post(
            "/api/v2/assessments/start",
            json={
                "domain_slug": "backend",
                "concept_slug": "net-internet",
                "session_mode": "depth_probe",
            },
        )
        assert blocked.status_code == 409
        assert blocked.json()["detail"]["error_code"] == "PLAYBOOK_NOT_COMPLETED"

        # 2. Complete Playbook -> elevates to Surface (0.25)
        pb = client.post(
            "/api/v2/domains/backend/concepts/net-internet/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
        )
        assert pb.status_code == 200
        assert pb.json()["playbook_completed"] is True
        assert pb.json()["updated_competency"]["depth_level_norm"] >= 0.25

        # 3. Now depth_probe succeeds (201)
        started = client.post(
            "/api/v2/assessments/start",
            json={
                "domain_slug": "backend",
                "concept_slug": "net-internet",
                "session_mode": "depth_probe",
            },
        )
        assert started.status_code == 201

        # 4. Abandoning session with 0 steps triggers insufficient_evidence cleanly
        sid = started.json()["session_id"]
        ab = client.post(f"/api/v2/assessments/{sid}/abandon")
        assert ab.status_code == 200
        assert ab.json()["session_status"] == "insufficient_evidence"


def test_arch_inv_seq_02_double_sandbox_submit_never_reaches_mastery_100() -> None:
    """INV-SEQ-02: Submitting 100% Code Sandbox 2x without Deep Understanding (>=0.75) caps at 0.50."""
    with TestClient(app) as client:
        _register_user(client, "inv_seq_02")
        pb = client.post(
            "/api/v2/domains/backend/concepts/net-internet/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
        )
        assert pb.status_code == 200

        ch = client.get("/api/v2/concepts/net-internet/code-challenge").json()
        sol = (
            "def parse_host_port(url: str) -> tuple[str, int]:\n"
            "    cleaned = url.split('://', 1)[-1].split('/', 1)[0]\n"
            "    if ':' in cleaned:\n"
            "        h, p = cleaned.split(':', 1)\n"
            "        return h, int(p)\n"
            "    return cleaned, 443 if url.startswith('https://') else 80\n"
        )
        for _ in range(2):
            sub = client.post(
                "/api/v2/concepts/net-internet/code-sandbox/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "challenge_id": ch["challenge_id"],
                    "language": "python",
                    "source_code": sol,
                },
            )
            assert sub.status_code == 200
            body = sub.json()
            assert body["code_score"] == 1.0
            assert body["updated_competency"]["depth_level_norm"] <= 0.50, (
                f"INV-SEQ-02 violated! Double sandbox submit jumped to {body['updated_competency']['depth_level_norm']}"
            )


def test_arch_placement_tier1_pass_unlocks_tier2_on_roadmap() -> None:
    """Passing Tier 1 root in Adaptive Placement promotes it to 0.75 and unlocks Tier 2 child on /roadmap."""
    with TestClient(app) as client:
        _register_user(client, "inv_place_unlock")
        start = client.post("/api/v2/domains/frontend/placement/start")
        assert start.status_code == 201
        data = start.json()
        sid = data["session_id"]
        q = data["current_question"]
        assert q is not None

        with SessionLocal() as db:
            q_row = db.get(DepthQuestionModel, uuid.UUID(q["question_id"]))
            assert q_row is not None
            correct_opt = q_row.correct_option_key or "A"

        ans = client.post(
            f"/api/v2/domains/frontend/placement/{sid}/answer",
            json={
                "submission_id": str(uuid.uuid4()),
                "question_id": q["question_id"],
                "selected_option": correct_opt,
            },
        )
        assert ans.status_code == 200, f"Placement answer failed: {ans.text}"
        assert ans.json()["step_passed"] is True

        rm = client.get("/api/v2/domains/frontend/roadmap")
        assert rm.status_code == 200
        nodes_by_slug = {n["slug"]: n for n in rm.json()["nodes"]}
        tier2_unlocked = [n for n in nodes_by_slug.values() if n["tier"] == 2 and n["is_eligible"]]
        assert len(tier2_unlocked) >= 1, (
            f"Expected at least one Tier 2 node unlocked after passing Tier 1 placement; "
            f"root={nodes_by_slug.get(q['concept_slug'])}"
        )
