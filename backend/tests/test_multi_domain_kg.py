"""Behavioral RED tests for PL3-KG-01: Multi-Domain Knowledge Graph & Shared Node Sync."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def _login_demo(client: TestClient, username: str = "learner_new") -> None:
    res = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": "PlumoraDemo#2026"},
    )
    assert res.status_code == 200


def test_pl3_kg_01_list_domains_returns_backend_frontend_devops() -> None:
    """GET /api/v2/domains returns 3 seeded domains with node counts and shared node counts."""
    with TestClient(app) as client:
        _login_demo(client)
        res = client.get("/api/v2/domains")
        assert res.status_code == 200
        body = res.json()
        domains = {d["slug"]: d for d in body["domains"]}
        assert {"backend", "frontend", "devops"}.issubset(domains.keys())
        assert domains["backend"]["total_nodes"] == 12
        assert domains["frontend"]["total_nodes"] == 10
        assert domains["frontend"]["shared_nodes_count"] == 4
        assert domains["devops"]["total_nodes"] == 9
        assert domains["devops"]["shared_nodes_count"] == 5
        assert "user_summary" in domains["backend"]


def test_pl3_kg_01_shared_node_competency_syncs_across_domains() -> None:
    """Mastering a shared node (e.g. net-internet) in backend immediately reflects in frontend & devops."""
    with TestClient(app) as client:
        # learner_foundation has first 4 backend nodes mastered (including net-internet & web-http)
        _login_demo(client, "learner_foundation")
        fe_res = client.get("/api/v2/domains/frontend/roadmap")
        assert fe_res.status_code == 200
        fe_nodes = {n["slug"]: n for n in fe_res.json()["nodes"]}
        assert fe_nodes["net-internet"]["is_shared"] is True
        assert fe_nodes["net-internet"]["depth_level_norm"] >= 0.75
        assert fe_nodes["web-http"]["is_shared"] is True
        assert fe_nodes["web-http"]["depth_level_norm"] >= 0.75
        # api-rest depends on web-http, so it must be eligible immediately in frontend
        assert fe_nodes["api-rest"]["is_eligible"] is True

        devops_res = client.get("/api/v2/domains/devops/roadmap")
        assert devops_res.status_code == 200
        devops_nodes = {n["slug"]: n for n in devops_res.json()["nodes"]}
        assert devops_nodes["os-basics"]["depth_level_norm"] >= 0.75
        assert devops_nodes["docker-containers"]["is_eligible"] is True


def test_pl3_kg_01_dag_cycle_detection_returns_422() -> None:
    """DAG cycle validator detects cycles and returns cycle path."""
    from app.modules.content.dag_validator import DagCycleError, validate_dag_acyclic

    nodes = ["a", "b", "c"]
    edges = [("b", "a"), ("c", "b"), ("a", "c")]
    try:
        validate_dag_acyclic(nodes, edges)
        raise AssertionError("Expected DagCycleError for cyclic graph")
    except DagCycleError as exc:
        assert exc.error_code == "DAG_CYCLE_DETECTED"
        assert len(exc.cycle_path) >= 2
