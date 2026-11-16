"""Environment smoke tests verifying PostgreSQL, Redis, and FastAPI health probe (ENV-01)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app


def test_health_probe_verifies_live_postgres_and_redis() -> None:
    """Verify GET /api/v1/health connects to live Docker PostgreSQL 16 and Redis 7."""
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["postgres"] == "up"
    assert payload["redis"] == "up"
    assert payload["status"] == "ok"
    assert "rl_checkpoint" in payload


def test_security_headers_attached_to_responses() -> None:
    """Verify mandatory security headers are present on HTTP responses."""
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert "frame-ancestors 'self'" in response.headers.get("content-security-policy", "")
    assert "camera=()" in response.headers.get("permissions-policy", "")
