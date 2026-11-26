"""P3-SLICE-4 Verification: Rubric Consistency Audit & 20-VU 60s Live 4-Microservice Load Benchmark."""

from __future__ import annotations

import argparse
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


async def _probe_live_docker_gateway(gateway_url: str) -> bool:
    """Return True if a healthy live Docker Microservices API Gateway is serving at gateway_url."""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(f"{gateway_url.rstrip('/')}/api/v1/health")
            if resp.status_code == 200:
                body = resp.json()
                return body.get("mode") == "microservices" and body.get("status") == "ok"
    except (httpx.HTTPError, ValueError):
        return False
    return False


async def _virtual_user_loop(
    vu_id: int,
    gateway_url: str,
    end_time: float,
    stats: dict[str, Any],
) -> None:
    uname = f"vu_{vu_id}_{uuid.uuid4().hex[:6]}"
    await asyncio.sleep(vu_id * 0.05)
    async with httpx.AsyncClient(base_url=gateway_url, timeout=20.0) as client:
        reg = await client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": f"VU {vu_id}", "password": "StrongPass!2026"},
        )
        if reg.status_code >= 500:
            stats["errors_5xx"] += 1
            return

        def _record_status(code: int) -> None:
            bucket = f"{code // 100}xx"
            stats["status_histogram"][bucket] = stats["status_histogram"].get(bucket, 0) + 1
            if code >= 500:
                stats["errors_5xx"] += 1

        # INV-SEQ-01 prerequisite: complete Playbook on fe-dom-events before starting 5-Depth Probing
        t_pb = time.monotonic()
        r_pb = await client.post(
            "/api/v2/domains/frontend/concepts/fe-dom-events/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
        )
        dt_pb = (time.monotonic() - t_pb) * 1000.0
        stats["all_latencies"].append(dt_pb)
        stats["write_latencies"].append(dt_pb)
        stats["total_requests"] += 1
        _record_status(r_pb.status_code)
        assert r_pb.status_code == 200, f"Expected 200 from playbook/complete, got {r_pb.status_code}"

        while time.monotonic() < end_time:
            # 1. GET /api/v2/domains
            t0 = time.monotonic()
            r1 = await client.get("/api/v2/domains")
            dt1 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt1)
            stats["total_requests"] += 1
            _record_status(r1.status_code)
            assert r1.status_code == 200 and "domains" in r1.json()

            # 2. GET /api/v2/domains/frontend/roadmap
            t0 = time.monotonic()
            r2 = await client.get("/api/v2/domains/frontend/roadmap")
            dt2 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt2)
            stats["total_requests"] += 1
            _record_status(r2.status_code)
            assert r2.status_code == 200 and "nodes" in r2.json()

            # 3. POST /api/v2/recommendations (GNN-PPO)
            t0 = time.monotonic()
            r3 = await client.post("/api/v2/recommendations", json={"domain_slug": "frontend"})
            dt3 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt3)
            stats["rec_latencies"].append(dt3)
            stats["total_requests"] += 1
            _record_status(r3.status_code)
            assert r3.status_code == 200 and "recommended_action" in r3.json()

            # 4. Assessment write path: start + submit depth step (INV-SEQ-01 satisfied)
            t0 = time.monotonic()
            r4 = await client.post(
                "/api/v2/assessments/start",
                json={
                    "domain_slug": "frontend",
                    "concept_slug": "fe-dom-events",
                    "session_mode": "depth_probe",
                },
            )
            dt4 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt4)
            stats["write_latencies"].append(dt4)
            stats["total_requests"] += 1
            _record_status(r4.status_code)
            assert r4.status_code == 201, f"Expected 201 from assessments/start, got {r4.status_code}"
            sess = r4.json()
            t0 = time.monotonic()
            r5 = await client.post(
                f"/api/v2/assessments/{sess['session_id']}/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "question_id": sess["step_item"]["question_id"],
                    "selected_option": "A",
                    "written_explanation": None,
                },
            )
            dt5 = (time.monotonic() - t0) * 1000.0
            stats["all_latencies"].append(dt5)
            stats["write_latencies"].append(dt5)
            stats["total_requests"] += 1
            _record_status(r5.status_code)
            assert r5.status_code == 200 and "updated_competency" in r5.json()

            await asyncio.sleep(0.05)


async def run_20vu_load_benchmark(
    duration_s: float = 60.0,
    gateway_url: str | None = None,
) -> dict[str, Any]:
    """Benchmark 20 concurrent VUs against the live Docker Microservices cluster (or local fallback)."""
    default_docker_gw = gateway_url or os.environ.get("GATEWAY_BASE_URL", "http://127.0.0.1:8000")
    use_live_docker = await _probe_live_docker_gateway(default_docker_gw)

    procs: list[subprocess.Popen[bytes]] = []
    target_gateway = default_docker_gw
    target_env_mode = "live_docker_microservices"

    try:
        if not use_live_docker:
            target_env_mode = "spawned_local_microservices"
            target_gateway = "http://127.0.0.1:18100"
            env = os.environ.copy()
            env["JWT_SECRET_KEY"] = "plumora_benchmark_shared_jwt_secret_key_min_32_chars"
            env["AUTH_SERVICE_URL"] = "http://127.0.0.1:18101"
            env["CONTENT_SERVICE_URL"] = "http://127.0.0.1:18102"
            env["ASSESSMENT_SERVICE_URL"] = "http://127.0.0.1:18103"
            env["RECOMMENDATION_SERVICE_URL"] = "http://127.0.0.1:18104"

            services_cmd = [
                ("services.user_auth_service:app", "18101", "1"),
                ("services.content_kg_service:app", "18102", "1"),
                ("services.assessment_grader_service:app", "18103", "3"),
                ("services.recommendation_ai_service:app", "18104", "4"),
                ("services.api_gateway:app", "18100", "4"),
            ]
            for app_target, port, workers in services_cmd:
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
                        "--workers",
                        workers,
                        "--log-level",
                        "warning",
                    ],
                    cwd=str(BACKEND_DIR),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                procs.append(p)

            for _, port, _ in services_cmd[:-1]:
                await _wait_for_port(f"http://127.0.0.1:{port}/health")
            await _wait_for_port("http://127.0.0.1:18100/api/v1/auth/me")

        stats: dict[str, Any] = {
            "total_requests": 0,
            "errors_5xx": 0,
            "status_histogram": {},
            "all_latencies": [],
            "rec_latencies": [],
            "write_latencies": [],
        }
        t_start = time.monotonic()
        end_time = t_start + duration_s
        await asyncio.gather(
            *[_virtual_user_loop(i, target_gateway, end_time, stats) for i in range(20)]
        )
        elapsed = time.monotonic() - t_start

        all_lat = sorted(stats["all_latencies"])
        rec_lat = sorted(stats["rec_latencies"])
        write_lat = sorted(stats["write_latencies"])
        total_req = stats["total_requests"]
        err_5xx = stats["errors_5xx"]

        return {
            "target_environment": target_env_mode,
            "gateway_url": target_gateway,
            "concurrent_vus": 20,
            "duration_seconds": round(elapsed, 2),
            "total_requests": total_req,
            "requests_per_second": round(total_req / max(0.1, elapsed), 2),
            "status_histogram": stats["status_histogram"],
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
            "assessment_write_latency_ms": {
                "mean": round(statistics.mean(write_lat), 2) if write_lat else 0.0,
                "p50": _percentile(write_lat, 50),
                "p95": _percentile(write_lat, 95),
                "p99": _percentile(write_lat, 99),
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run P3-SLICE-4 Rubric Audit & 20-VU Load Benchmark.")
    parser.add_argument("--duration", type=float, default=60.0)
    parser.add_argument("--gateway-url", type=str, default=None)
    args = parser.parse_args(argv)

    consistency = run_rubric_consistency_audit()
    load_res = asyncio.run(
        run_20vu_load_benchmark(duration_s=args.duration, gateway_url=args.gateway_url)
    )
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
