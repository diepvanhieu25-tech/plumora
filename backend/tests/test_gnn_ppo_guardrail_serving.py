"""Behavioral RED tests for PL3-GUARD-01: GNN-PPO Serving + Policy Guardrail + p95 < 250ms."""

from __future__ import annotations

import time
import uuid

from fastapi.testclient import TestClient

from app.main import app


def _register_fresh(client: TestClient) -> None:
    uname = f"p3_guard_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "display_name": "P3 Guardrail User",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201


def test_pl3_guard_01_v2_recommendations_serves_gnn_ppo_with_guardrail() -> None:
    """POST /api/v2/recommendations serves verified GNN-PPO with 8-dim node features & p95 < 250ms."""
    with TestClient(app) as client:
        _register_fresh(client)
        latencies_ms: list[float] = []
        last_body: dict[str, object] = {}
        for _ in range(10):
            t0 = time.monotonic()
            res = client.post("/api/v2/recommendations", json={"domain_slug": "frontend"})
            latencies_ms.append((time.monotonic() - t0) * 1000.0)
            assert res.status_code == 200
            last_body = res.json()

        assert last_body["policy_source"] in ("gnn_ppo", "gnn_ppo_masked")
        assert last_body["checkpoint_sha256"]
        assert "node_features_snapshot" in last_body
        snap = last_body["node_features_snapshot"]
        assert isinstance(snap, list) and len(snap) == 10
        assert len(snap[0]) == 8

        latencies_ms.sort()
        p95 = latencies_ms[int(0.95 * len(latencies_ms)) - 1]
        assert p95 < 250.0


def test_pl3_guard_01_corrupted_checkpoint_falls_back_to_fallback_rule() -> None:
    """If GNN-PPO checkpoint is missing/corrupted, serving degrades cleanly to fallback_rule (200 OK)."""
    from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

    with TestClient(app) as client:
        _register_fresh(client)
        # Test via corrupted path override in service
        from sqlalchemy.orm import Session

        from app.db.models import UserModel, engine

        with Session(engine) as db:
            user = db.query(UserModel).order_by(UserModel.created_at.desc()).first()
            assert user is not None
            res = recommend_gnn_ppo_v2(
                db,
                user.id,
                "frontend",
                checkpoint_path_override="/nonexistent/corrupted_gnn.zip",
            )
            assert res.policy_source == "fallback_rule"
            assert res.guardrail_applied is True
