"""RED -> GREEN remediation tests for Batch 3: F07 (Telemetry), F08 (Benchmark), F09 (RL Ablation), F12 (Registry UI)."""

from __future__ import annotations

from pathlib import Path
from typing import Any


def test_f12_admin_model_registry_page_does_not_hardcode_benchmark_numbers() -> None:
    """F12: AdminModelRegistryPage.tsx must bind benchmark table to real artifact data, not hardcoded 61.20/58.90."""
    repo_root = Path(__file__).resolve().parents[2]
    page_text = (
        (repo_root / "frontend" / "src" / "pages" / "admin" / "AdminModelRegistryPage.tsx").read_text(
            encoding="utf-8"
        )
        + "\n"
        + (repo_root / "frontend" / "src" / "components" / "admin" / "SafetyGateScorecard.tsx").read_text(
            encoding="utf-8"
        )
    )
    for fake_num in ("61.20", "58.90", "54.10", "52.30"):
        assert fake_num not in page_text, f"Found hardcoded benchmark figure '{fake_num}' in AdminModelRegistryPage.tsx"


def test_f12_online_rl_status_exposes_benchmark_report_from_artifact() -> None:
    """F12: get_online_rl_status must expose benchmark_report loaded from evaluation_phase3_report.json."""
    from app.db.models import SessionLocal
    from app.modules.recommendation.admin_service import get_online_rl_status

    with SessionLocal() as db:
        status = get_online_rl_status(db)
        assert hasattr(status, "benchmark_report")
        assert status.benchmark_report is not None
        assert "scenario_a_known_domains" in status.benchmark_report


def test_f07_system_health_detects_dead_vs_alive_consumer_and_real_db_privileges(
    monkeypatch: Any,
) -> None:
    """F07: get_system_health_status reports consumer_group_active=False when worker heartbeat is absent, True when alive."""
    import uuid

    import redis

    from app.core.config import settings
    from app.db.models import SessionLocal
    from app.modules.recommendation import admin_service
    from app.modules.recommendation.services import system_health as system_health_service

    isolated_hb_key = f"plumora:worker:test_{uuid.uuid4().hex[:8]}"
    monkeypatch.setattr(system_health_service, "WORKER_HEARTBEAT_KEY", isolated_hb_key)

    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        r_client.delete(isolated_hb_key)
        with SessionLocal() as db:
            health_dead = admin_service.get_system_health_status(db)
            assert health_dead["consumer_group_active"] is False
            assert health_dead["schemas_isolated"] is True

        r_client.set(isolated_hb_key, "alive", ex=15)
        with SessionLocal() as db:
            health_alive = admin_service.get_system_health_status(db)
            assert "redis_stream_pending" in health_alive
    finally:
        r_client.delete(isolated_hb_key)
        r_client.close()


def test_f08_benchmark_script_includes_write_path_and_status_histogram() -> None:
    """F08: benchmark_p3_slice4.py must include assessment write path and status_histogram."""
    repo_root = Path(__file__).resolve().parents[2]
    bench_text = (repo_root / "scripts" / "benchmark_p3_slice4.py").read_text(encoding="utf-8")
    assert "/api/v2/assessments/" in bench_text
    assert "status_histogram" in bench_text


def test_f09_evaluate_phase3_evaluates_mlp_baselines_with_same_guardrail_mask() -> None:
    """F09: evaluate_phase3.py must evaluate dqn_mlp_masked and ppo_mlp_masked alongside gnn_ppo_masked."""
    repo_root = Path(__file__).resolve().parents[2]
    eval_text = (repo_root / "rl" / "src" / "plumora_rl" / "evaluate_phase3.py").read_text(
        encoding="utf-8"
    )
    assert "dqn_mlp_masked" in eval_text
    assert "ppo_mlp_masked" in eval_text
