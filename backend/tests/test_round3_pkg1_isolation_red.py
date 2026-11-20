"""RED -> GREEN tests for Round 3 Package 1: R3-01 (Internal API Auth/Gateway Block) & R3-04 (Migration Conflict Safety)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app


def test_r3_01_internal_endpoints_block_anonymous_and_learner_tokens() -> None:
    """R3-01: Internal service endpoints must reject anonymous callers and learner JWTs."""
    with TestClient(app) as client:
        # 1. Anonymous domain bundle -> must NOT return 200
        r1 = client.get("/api/v2/internal/domains/frontend/bundle")
        assert r1.status_code in (401, 403), f"Anonymous leaked domain bundle: {r1.status_code}"

        # 2. Anonymous concept bundle -> must NOT return 200
        r2 = client.get("/api/v2/internal/concepts/net-internet/bundle")
        assert r2.status_code in (401, 403), f"Anonymous leaked concept bundle: {r2.status_code}"

        # 3. Anonymous user competencies -> must NOT return 200
        r3 = client.get(f"/api/v2/internal/users/{uuid.uuid4()}/competencies")
        assert r3.status_code in (401, 403), f"Anonymous leaked competencies: {r3.status_code}"

        # 4. Learner JWT must also be rejected with 401/403
        uname = f"r3_01_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "Learner", "password": "StrongPass!2026"},
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        r4 = client.get(
            "/api/v2/internal/domains/frontend/bundle",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r4.status_code in (401, 403), f"Learner token accessed internal bundle: {r4.status_code}"


def test_r3_01_api_gateway_blocks_public_access_to_internal_routes() -> None:
    """R3-01: API Gateway must block /api/v2/internal/* at the public edge with 403."""
    from services.api_gateway import app as gw_app

    with TestClient(gw_app) as gw_client:
        r = gw_client.get("/api/v2/internal/domains/frontend/bundle")
        assert r.status_code == 403


def test_r3_04_migration_preflight_refuses_to_drop_conflicting_public_rows() -> None:
    """R3-04: Migration helper must abort cleanly when public and target schema have conflicting PK data."""
    from sqlalchemy import text

    from app.db import migrations as mig_mod
    from app.db.models import engine

    assert hasattr(mig_mod, "migrate_public_table_safely"), (
        "Safe preflight migration helper migrate_public_table_safely missing"
    )
    tbl = f"r3_04_test_{uuid.uuid4().hex[:8]}"
    with engine.begin() as conn:
        conn.execute(text(f"CREATE TABLE public.{tbl} (id TEXT PRIMARY KEY, val TEXT NOT NULL);"))
        conn.execute(text(f"CREATE TABLE content_svc.{tbl} (id TEXT PRIMARY KEY, val TEXT NOT NULL);"))
        conn.execute(text(f"INSERT INTO public.{tbl} (id, val) VALUES ('k1', 'from_public');"))
        conn.execute(text(f"INSERT INTO content_svc.{tbl} (id, val) VALUES ('k1', 'from_content');"))

    try:
        with pytest.raises(RuntimeError, match="conflict"), engine.begin() as conn:
            mig_mod.migrate_public_table_safely(conn, "content_svc", tbl)
        # Verify public table was NOT dropped
        with engine.begin() as conn:
            val = conn.execute(text(f"SELECT val FROM public.{tbl} WHERE id = 'k1'")).scalar()
            assert val == "from_public"
    finally:
        with engine.begin() as conn:
            conn.execute(text(f"DROP TABLE IF EXISTS public.{tbl};"))
            conn.execute(text(f"DROP TABLE IF EXISTS content_svc.{tbl};"))


def test_r3_01_internal_endpoints_accept_valid_service_token() -> None:
    """R3-01 regression: valid X-Service-Token allows service-to-service access on internal routes."""
    from app.modules.auth.security import create_internal_service_token

    svc_token = create_internal_service_token("recommendation-ai-service")
    with TestClient(app) as client:
        r = client.get(
            "/api/v2/internal/domains/frontend/bundle",
            headers={"X-Service-Token": svc_token},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["domain"]["slug"] == "frontend"
        assert len(body["nodes"]) >= 10
        assert len(body["questions"]) > 0
