"""Gate 2 RED -> GREEN Behavioral Tests for Plumora v4.2 Hardening & Maintainability."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings


def test_v42_s03_migration_role_password_fails_fast_in_production(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """S-03: Production migrations must never silently fall back to hardcoded dev password."""
    from app.db.migrations import resolve_service_role_password

    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("AUTH_DB_PASSWORD", raising=False)
    with pytest.raises(RuntimeError, match="AUTH_DB_PASSWORD"):
        resolve_service_role_password("auth_svc_user")

    monkeypatch.setenv("AUTH_DB_PASSWORD", "ProdStrongPass#2026")
    assert resolve_service_role_password("auth_svc_user") == "ProdStrongPass#2026"

    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.delenv("AUTH_DB_PASSWORD", raising=False)
    assert resolve_service_role_password("auth_svc_user") == "plumora_dev_pass_local_only"


def test_v42_s03_demo_accounts_gated_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    """S-03: Demo accounts (admin_demo/expert_demo/learner_*) must not be seeded in production by default."""
    from app.modules.content.seed_loader import should_seed_demo_accounts

    monkeypatch.delenv("SEED_DEMO_ACCOUNTS", raising=False)
    assert should_seed_demo_accounts(Settings(app_env="production")) is False
    assert should_seed_demo_accounts(Settings(app_env="development")) is True

    monkeypatch.setenv("SEED_DEMO_ACCOUNTS", "true")
    assert should_seed_demo_accounts(Settings(app_env="production")) is True


def test_v42_r03_microservice_live_and_ready_health_probes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """R-03: Microservices expose /health/live (200) and /health/ready (checks DB+Redis, 503 on DB down)."""
    from services import _runtime, user_auth_service

    with TestClient(user_auth_service.app) as client:
        live = client.get("/health/live")
        assert live.status_code == 200
        assert live.json()["status"] == "up"

        ready = client.get("/health/ready")
        assert ready.status_code == 200
        body = ready.json()
        assert body["postgres"] == "up"
        assert body["status"] in ("ok", "degraded")

        monkeypatch.setattr(_runtime, "_probe_postgres", lambda: False)
        ready_down = client.get("/health/ready")
        assert ready_down.status_code == 503
        assert ready_down.json()["postgres"] == "down"


def test_v42_o01_s06_json_logging_and_audit_events_with_request_id() -> None:
    """O-01 & S-06: JsonLogFormatter injects request_id and audit payload without leaking secrets."""
    from app.core.observability import (
        REQUEST_ID_CTX,
        JsonLogFormatter,
        emit_audit_event,
    )

    formatter = JsonLogFormatter(service_name="user-auth-service")
    token = REQUEST_ID_CTX.set("req-trace-v42")
    captured: list[str] = []

    class _ListHandler(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(formatter.format(record))

    audit_logger = logging.getLogger("plumora.audit")
    handler = _ListHandler()
    audit_logger.addHandler(handler)
    prev_level = audit_logger.level
    audit_logger.setLevel(logging.INFO)
    try:
        emit_audit_event(
            action="auth.login",
            actor_id=str(uuid.uuid4()),
            role="admin",
            resource="/api/v1/auth/login",
            outcome="denied",
            details={"reason": "wrong_portal"},
        )
    finally:
        audit_logger.removeHandler(handler)
        audit_logger.setLevel(prev_level)
        REQUEST_ID_CTX.reset(token)

    assert len(captured) == 1
    parsed = json.loads(captured[0])
    assert parsed["service"] == "user-auth-service"
    assert parsed["request_id"] == "req-trace-v42"
    assert parsed["audit"]["action"] == "auth.login"
    assert parsed["audit"]["outcome"] == "denied"


def test_v42_f02_global_exception_handlers_422_and_500_with_request_id() -> None:
    """F-02: Global handlers standardize 422 validation errors and hide tracebacks on 500."""
    from pydantic import BaseModel

    from services._runtime import register_common_middleware_and_handlers

    mini = FastAPI()
    register_common_middleware_and_handlers(mini, service_name="test-svc")

    class _Item(BaseModel):
        count: int

    @mini.post("/validate")
    def _val(item: _Item) -> dict[str, int]:
        return {"count": item.count}

    @mini.get("/boom")
    def _boom() -> dict[str, Any]:
        raise RuntimeError("secret internal db trace")

    with TestClient(mini, raise_server_exceptions=False) as client:
        r422 = client.post(
            "/validate",
            json={"count": "not-an-int"},
            headers={"X-Request-ID": "trace-422"},
        )
        assert r422.status_code == 422
        assert r422.headers.get("x-request-id") == "trace-422"
        body422 = r422.json()
        assert body422["error_code"] == "VALIDATION_ERROR"
        assert body422["request_id"] == "trace-422"

        r500 = client.get("/boom", headers={"X-Request-ID": "trace-500"})
        assert r500.status_code == 500
        assert r500.headers.get("x-request-id") == "trace-500"
        body500 = r500.json()
        assert body500["error_code"] == "INTERNAL_SERVER_ERROR"
        assert body500["request_id"] == "trace-500"
        assert "secret internal db trace" not in json.dumps(body500)


def test_v42_m01_recommendation_route_not_duplicated_in_assessment_router() -> None:
    """M-01: POST /api/v2/recommendations must live solely in recommendation/router_v2.py."""
    from app.modules.assessment.router_v2 import router as assess_router
    from app.modules.recommendation.router_v2 import router as rec_router

    assess_paths = {getattr(r, "path", "") for r in assess_router.routes}
    rec_paths = {getattr(r, "path", "") for r in rec_router.routes}
    assert "/api/v2/recommendations" not in assess_paths
    assert "/api/v2/recommendations" in rec_paths
