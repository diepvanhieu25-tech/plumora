"""Behavioral RED tests for PL3-MEMORY-01: Ebbinghaus Memory Decay & Review Recovery."""

from __future__ import annotations

import math
import uuid

from fastapi.testclient import TestClient

from app.main import app


def test_pl3_memory_01_ebbinghaus_formula_decay_and_recovery() -> None:
    """Verify R(t) = exp(-dt / S) with S0=3.0, needs_review < 0.60, and S_new update rules."""
    from app.modules.assessment.ebbinghaus import (
        INITIAL_STABILITY_DAYS,
        compute_retention,
        update_stability,
    )

    assert INITIAL_STABILITY_DAYS == 3.0
    r_0 = compute_retention(delta_days=0.0, stability_s=3.0)
    assert math.isclose(r_0, 1.0, rel_tol=1e-6)

    r_5 = compute_retention(delta_days=5.0, stability_s=3.0)
    assert math.isclose(r_5, math.exp(-5.0 / 3.0), rel_tol=1e-6)
    assert r_5 < 0.60

    s_pass = update_stability(old_s=3.0, score=1.0)
    assert math.isclose(s_pass, 3.0 * 1.8, rel_tol=1e-6)

    s_fail = update_stability(old_s=3.0, score=0.5)
    assert math.isclose(s_fail, max(1.5, 0.7 * 3.0), rel_tol=1e-6)


def test_pl3_memory_01_roadmap_simulated_time_offset_triggers_needs_review() -> None:
    """Passing simulated_time_offset_days=5.0 in dev/test triggers needs_review=True on mastered nodes."""
    with TestClient(app) as client:
        uname = f"p3_mem_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={
                "username": uname,
                "display_name": "P3 Memory User",
                "password": "StrongPass!2026",
            },
        )
        assert reg.status_code == 201
        user_id = uuid.UUID(reg.json()["user"]["id"])

        # Seed mastered state on net-internet (depth >= 0.75, S0 = 3.0 days) via DB SSoT
        from datetime import UTC, datetime

        from sqlalchemy.orm import Session

        from app.db.models import UserNodeCompetencyModel, engine

        with Session(engine) as db:
            now = datetime.now(UTC)
            db.merge(
                UserNodeCompetencyModel(
                    user_id=user_id,
                    concept_slug="net-internet",
                    depth_level_norm=0.75,
                    peak_depth_level_norm=0.75,
                    depth_label="Deep Understanding",
                    confidence=0.85,
                    stability_s=3.0,
                    last_practiced_at=now,
                    playbook_completed_at=now,
                    code_practice_score=0.0,
                    updated_at=now,
                )
            )
            db.commit()

        res = client.get("/api/v2/domains/backend/roadmap?simulated_time_offset_days=5.0")
        assert res.status_code == 200
        nodes = {n["slug"]: n for n in res.json()["nodes"]}
        assert nodes["net-internet"]["retention_ebbinghaus"] < 0.60
        assert nodes["net-internet"]["needs_review"] is True
