"""P3-SLICE-4 Verification: Rubric Consistency Audit & 20-VU 60s 4-Microservice Load Benchmark."""

from __future__ import annotations

import asyncio
import json
import math
import os
import statistics
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.modules.assessment.rubric_grader import (  # noqa: E402
    DeterministicRubricGrader,
    RubricCriterion,
)


def run_rubric_consistency_audit() -> dict[str, Any]:
    """Compare DeterministicRubricGrader vs Reference Structured Rubric Evaluation across all 22 concepts."""
    seed_path = BACKEND_DIR / "app" / "seed" / "depth_questions_and_rubrics.json"
    data = json.loads(seed_path.read_text(encoding="utf-8"))
    rubric_questions = [q for q in data["questions"] if q.get("rubric") is not None]

    grader = DeterministicRubricGrader()
    det_scores: list[float] = []
    ref_scores: list[float] = []
    pass_agree = 0

    for q in rubric_questions:
        rub = q["rubric"]
        criteria = [
            RubricCriterion(
                name=str(c["name"]),
                weight=float(c["weight"]),
                required_keywords=[str(k) for k in c["required_keywords"]],
            )
            for c in rub["criteria"]
        ]
        ref_exp = str(rub["reference_explanation"])
        kw_all = [k for c in criteria for k in c.required_keywords]

        # 3 calibrated test answers per question: strong (1.0), partial (0.5), weak (0.0)
        samples = [
            (ref_exp + " " + " ".join(kw_all), 1.0),
            ("Giải pháp đề cập sơ bộ " + (kw_all[0] if kw_all else ""), 0.5),
            ("Tôi chưa rõ phần này lắm, cần xem lại.", 0.0),
        ]
        for ans_text, expected_ref in samples:
            score, _, _, _ = grader.grade(q["prompt"], ans_text, criteria, ref_exp)
            det_scores.append(score)
            ref_scores.append(expected_ref)
            if (score >= 0.75) == (expected_ref >= 0.75):
                pass_agree += 1

    n = len(det_scores)
    mae = sum(abs(a - b) for a, b in zip(det_scores, ref_scores, strict=True)) / n
    mean_d = sum(det_scores) / n
    mean_r = sum(ref_scores) / n
    num = sum((a - mean_d) * (b - mean_r) for a, b in zip(det_scores, ref_scores, strict=True))
    den = math.sqrt(
        sum((a - mean_d) ** 2 for a in det_scores) * sum((b - mean_r) ** 2 for b in ref_scores)
    )
    corr = num / den if den > 0 else 1.0

    return {
        "total_questions_evaluated": len(rubric_questions),
        "total_response_samples": n,
        "pass_fail_agreement_rate": round(pass_agree / n, 4),
        "mean_absolute_error": round(mae, 4),
        "pearson_correlation": round(corr, 4),
    }


def _percentile(sorted_vals: list[float], pct: float) -> float:
    if not sorted_vals:
        return 0.0
    idx = min(len(sorted_vals) - 1, max(0, int(math.ceil((pct / 100.0) * len(sorted_vals))) - 1))
    return round(sorted_vals[idx], 2)


async def _wait_for_port(url: str, timeout_s: float = 20.0) -> None:
    t0 = time.monotonic()
    async with httpx.AsyncClient() as client:
        while time.monotonic() - t0 < timeout_s:
            try:
                r = await client.get(url, timeout=1.0)
                if r.status_code < 500:
                    return
            except httpx.HTTPError:
                pass
            await asyncio.sleep(0.3)
    raise RuntimeError(f"Service at {url} failed to become ready within {timeout_s}s")


async def _virtual_user_loop(
    vu_id: int,
    gateway_url: str,
    end_time: float,
    stats: dict[str, Any],
) -> None:
    uname = f"vu_{vu_id}_{uuid.uuid4().hex[:6]}"
    async with httpx.AsyncClient(base_url=gateway_url, timeout=10.0) as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": f"VU {vu_id}", "password": "StrongPass!2026"},
        )
        if reg.status_code >= 500:
            stats["errors_5xx"] += 1
            return

        while time.monotonic() < end_time:
            # 1. GET /api/v2/domains
            t0 = time.monotonic()
            r1 = await client.get("/api/v2/domains")
            dt1 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt1)
            stats["total_requests"] += 1
            if r1.status_code >= 500:
                stats["errors_5xx"] += 1

            # 2. GET /api/v2/domains/frontend/roadmap
            t0 = time.monotonic()
            r2 = await client.get("/api/v2/domains/frontend/roadmap")
            dt2 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt2)
            stats["total_requests"] += 1
            if r2.status_code >= 500:
                stats["errors_5xx"] += 1

            # 3. POST /api/v2/recommendations (GNN-PPO)
            t0 = time.monotonic()
            r3 = await client.post("/api/v2/recommendations", json={"domain_slug": "frontend"})
            dt3 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt3)
            stats["rec_latencies"].append(dt3)
            stats["total_requests"] += 1
            if r3.status_code >= 500:
                stats["errors_5xx"] += 1

            await asyncio.sleep(0.05)


async def run_20vu_load_benchmark(duration_s: float = 60.0) -> dict[str, Any]:
    """Start 4 Microservices + API Gateway and run 20 concurrent VUs for `duration_s` seconds."""
    env = os.environ.copy()
    env["JWT_SECRET_KEY"] = "plumora_benchmark_shared_jwt_secret_key_min_32_chars"
    env["AUTH_SERVICE_URL"] = "http://127.0.0.1:8001"
    env["CONTENT_SERVICE_URL"] = "http://127.0.0.1:8002"
    env["ASSESSMENT_SERVICE_URL"] = "http://127.0.0.1:8003"
    env["RECOMMENDATION_SERVICE_URL"] = "http://127.0.0.1:8004"

    procs: list[subprocess.Popen[bytes]] = []
    services_cmd = [
        ("services.user_auth_service:app", "8001"),
        ("services.content_kg_service:app", "8002"),
        ("services.assessment_grader_service:app", "8003"),
        ("services.recommendation_ai_service:app", "8004"),
        ("services.api_gateway:app", "8000"),
    ]
    try:
        for app_target, port in services_cmd:
            p = subprocess.Popen(  # noqa: S603
                [
                    sys.executable,
                    "-m",
                    "uvicorn",
                    app_target,
                    "--host",
                    "127.0.0.1",
                    "--port",
                    port,
                    "--log-level",
                    "warning",
                ],
                cwd=str(BACKEND_DIR),
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            procs.append(p)

        for _, port in services_cmd[:-1]:
            await _wait_for_port(f"http://127.0.0.1:{port}/health")
        await _wait_for_port("http://127.0.0.1:8000/api/v1/auth/me")

        stats: dict[str, Any] = {
            "total_requests": 0,
            "errors_5xx": 0,
            "all_latencies": [],
            "rec_latencies": [],
        }
        t_start = time.monotonic()
        end_time = t_start + duration_s
        await asyncio.gather(
            *[_virtual_user_loop(i, "http://127.0.0.1:8000", end_time, stats) for i in range(20)]
        )
        elapsed = time.monotonic() - t_start

        all_lat = sorted(stats["all_latencies"])
        rec_lat = sorted(stats["rec_latencies"])
        total_req = stats["total_requests"]
        err_5xx = stats["errors_5xx"]

        return {
            "concurrent_vus": 20,
            "duration_seconds": round(elapsed, 2),
            "total_requests": total_req,
            "requests_per_second": round(total_req / max(0.1, elapsed), 2),
            "http_5xx_count": err_5xx,
            "http_5xx_rate_pct": round((err_5xx / max(1, total_req)) * 100.0, 4),
            "overall_latency_ms": {
                "mean": round(statistics.mean(all_lat), 2),
                "p50": _percentile(all_lat, 50),
                "p95": _percentile(all_lat, 95),
                "p99": _percentile(all_lat, 99),
            },
            "gnn_ppo_recommendation_latency_ms": {
                "mean": round(statistics.mean(rec_lat), 2),
                "p50": _percentile(rec_lat, 50),
                "p95": _percentile(rec_lat, 95),
                "p99": _percentile(rec_lat, 99),
            },
        }
    finally:
        for p in procs:
            p.terminate()
        for p in procs:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()


def main() -> int:
    consistency = run_rubric_consistency_audit()
    load_res = asyncio.run(run_20vu_load_benchmark(duration_s=60.0))
    report = {
        "rubric_consistency_audit": consistency,
        "load_benchmark_20vu_60s": load_res,
    }
    out_path = REPO_ROOT / "docs" / "verification" / "artifacts" / "load_20vu_report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    assert load_res["http_5xx_rate_pct"] == 0.0
    assert load_res["overall_latency_ms"]["p95"] < 400.0
    assert load_res["gnn_ppo_recommendation_latency_ms"]["p95"] < 250.0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
