"""Gate 2 RED -> GREEN Behavioral Tests for Plumora v4.1 (D-37..D-41)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _login_as(client: TestClient, username: str, password: str = "PlumoraDemo#2026", portal: str = "backoffice") -> None:
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password, "portal": portal},
    )
    assert res.status_code == 200, f"Login failed for {username}: {res.text}"


def test_v41_d39_recommendations_include_planned_next_steps_and_decision_factors() -> None:
    """D-39: POST /api/v2/recommendations returns 3-step planned_next_steps & concrete decision_factors."""
    with TestClient(app) as client:
        uname = f"v41_plan_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "V41 Learner", "password": "StrongPassword!123"},
        )
        assert reg.status_code == 201

        rec = client.post("/api/v2/recommendations", json={"domain_slug": "backend"})
        assert rec.status_code == 200
        body = rec.json()
        assert body["status"] == "active"
        assert body["recommended_action"] is not None
        assert "planned_next_steps" in body
        assert 1 <= len(body["planned_next_steps"]) <= 3
        assert body["planned_next_steps"][0]["concept_slug"] == body["recommended_action"]["concept_slug"]
        assert body["planned_next_steps"][0]["step_order"] == 1
        assert "decision_factors" in body
        assert len(body["decision_factors"]) >= 1


def test_v41_d40_admin_rl_analytics_rbac_and_log_metrics() -> None:
    """D-40: GET /api/v2/admin/rl-analytics enforces admin RBAC and aggregates recommendation_logs."""
    with TestClient(app) as client:
        # Learner must be rejected with 403
        _login_as(client, "learner_foundation", portal="learner")
        r_learner = client.get("/api/v2/admin/rl-analytics")
        assert r_learner.status_code == 403

        # Generate at least one recommendation log
        rec = client.post("/api/v2/recommendations", json={"domain_slug": "backend"})
        assert rec.status_code == 200

        # Expert must be rejected with 403
        _login_as(client, "expert_demo", portal="expert")
        r_expert = client.get("/api/v2/admin/rl-analytics")
        assert r_expert.status_code == 403

        # Admin gets real aggregated metrics from recommendation_logs
        _login_as(client, "admin_demo", portal="admin")
        r_admin = client.get("/api/v2/admin/rl-analytics?limit=10")
        assert r_admin.status_code == 200
        data = r_admin.json()
        assert data["total_recommendations"] >= 1
        assert 0.0 <= data["guardrail_intervention_rate"] <= 1.0
        assert 0.0 <= data["fallback_rate"] <= 1.0
        assert 0.0 <= data["redis_cache_hit_rate"] <= 1.0
        assert isinstance(data["by_mode"], list) and len(data["by_mode"]) >= 1
        assert isinstance(data["by_domain"], list) and len(data["by_domain"]) >= 1
        assert isinstance(data["top_concepts"], list) and len(data["top_concepts"]) >= 1
        assert isinstance(data["recent_decisions"], list) and len(data["recent_decisions"]) >= 1


def test_v41_d41_expert_playbook_patch_and_sandbox_dry_run() -> None:
    """D-41: Expert can PATCH single concept playbook & dry-run code sandbox without persisting."""
    with TestClient(app) as client:
        _login_as(client, "learner_foundation", portal="learner")
        r_forbid_pb = client.patch(
            "/api/v2/expert/concepts/net-internet/playbook",
            json={"lesson_markdown": "## 1. Test\n\nNội dung kiểm thử"},
        )
        assert r_forbid_pb.status_code == 403
        r_forbid_dr = client.post(
            "/api/v2/expert/code-challenges/dry-run",
            json={
                "concept_slug": "net-internet",
                "title": "Dry Run Test",
                "language": "python",
                "prompt": "Fix double(x)",
                "buggy_starter_code": "def double(x):\n    return x\n",
                "solution_code": "def double(x):\n    return x * 2\n",
                "test_cases": [{"name": "basic", "call": "double(3)", "expected": 6, "is_hidden": False}],
            },
        )
        assert r_forbid_dr.status_code == 403

        _login_as(client, "expert_demo", portal="expert")

        # 1. Dry-run valid challenge (passes solution & fails starter, no DB persist)
        dr_ok = client.post(
            "/api/v2/expert/code-challenges/dry-run",
            json={
                "concept_slug": "net-internet",
                "title": "Dry Run Test",
                "language": "python",
                "prompt": "Fix double(x)",
                "buggy_starter_code": "def double(x):\n    return x\n",
                "solution_code": "def double(x):\n    return x * 2\n",
                "test_cases": [{"name": "basic", "call": "double(3)", "expected": 6, "is_hidden": False}],
            },
        )
        assert dr_ok.status_code == 200, dr_ok.text
        dr_body = dr_ok.json()
        assert dr_body["verified"] is True
        assert dr_body["solution_passed"] is True
        assert dr_body["starter_failed"] is True
        assert dr_body["passed_tests"] == 1
        assert dr_body["total_tests"] == 1
        assert len(dr_body["test_results"]) == 1

        # 1b. Whitespace-only playbook must be rejected with 422
        ws_resp = client.patch(
            "/api/v2/expert/concepts/net-internet/playbook",
            json={"lesson_markdown": " " * 20},
        )
        assert ws_resp.status_code == 422

        # 2. Dry-run unsafe code must be blocked with 422
        dr_unsafe = client.post(
            "/api/v2/expert/code-challenges/dry-run",
            json={
                "concept_slug": "net-internet",
                "title": "Unsafe Test",
                "language": "python",
                "prompt": "Unsafe",
                "buggy_starter_code": "def double(x):\n    return x\n",
                "solution_code": "import os\ndef double(x):\n    return x * 2\n",
                "test_cases": [{"name": "basic", "call": "double(3)", "expected": 6, "is_hidden": False}],
            },
        )
        assert dr_unsafe.status_code == 422

        # 3. PATCH single concept playbook (then restore original markdown)
        orig_graph = client.get("/api/v2/expert/domains/backend/graph")
        assert orig_graph.status_code == 200
        orig_md = next(n["lesson_markdown"] for n in orig_graph.json()["nodes"] if n["slug"] == "net-internet")

        patched_md = orig_md + "\n\n<!-- v41-patch-check -->"
        try:
            p_res = client.patch(
                "/api/v2/expert/concepts/net-internet/playbook",
                json={"lesson_markdown": patched_md},
            )
            assert p_res.status_code == 200, p_res.text
            assert p_res.json()["concept_slug"] == "net-internet"
            assert p_res.json()["updated_domains_count"] >= 1
        finally:
            client.patch(
                "/api/v2/expert/concepts/net-internet/playbook",
                json={"lesson_markdown": orig_md},
            )
