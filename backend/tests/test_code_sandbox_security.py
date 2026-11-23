"""Behavioral & Security RED tests for PL3-GRADER-01: Isolated Code Sandbox Worker."""

from __future__ import annotations

import time
import uuid

from fastapi.testclient import TestClient

from app.main import app


def _register_and_login(client: TestClient) -> None:
    uname = f"p3_sandbox_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "display_name": "P3 Sandbox User",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201


def _complete_playbook(client: TestClient, domain_slug: str = "backend", concept_slug: str = "net-internet") -> None:
    pb = client.post(
        f"/api/v2/domains/{domain_slug}/concepts/{concept_slug}/playbook/complete",
        json={"submission_id": str(uuid.uuid4())},
    )
    assert pb.status_code == 200


def test_pl3_grader_01_code_sandbox_happy_path_and_idempotency() -> None:
    """Valid Python solution passes all test cases and supports idempotent submission_id replay."""
    with TestClient(app) as client:
        _register_and_login(client)
        # net-internet is Tier 1 root (unlocked) and has a code challenge
        res = client.get("/api/v2/domains/backend/roadmap")
        assert res.status_code == 200
        _complete_playbook(client, "backend", "net-internet")

        challenge_res = client.get("/api/v2/concepts/net-internet/code-challenge")
        assert challenge_res.status_code == 200
        ch = challenge_res.json()

        sub_id = str(uuid.uuid4())
        submit_res = client.post(
            "/api/v2/concepts/net-internet/code-sandbox/submit",
            json={
                "submission_id": sub_id,
                "challenge_id": ch["challenge_id"],
                "language": ch["language"],
                "source_code": ch.get("reference_solution_for_test_only", "def parse_host_port(url: str) -> tuple[str, int]:\n    cleaned = url.split('://', 1)[-1].split('/', 1)[0]\n    if ':' in cleaned:\n        h, p = cleaned.split(':', 1)\n        return h, int(p)\n    return cleaned, 443 if url.startswith('https://') else 80\n"),
            },
        )
        assert submit_res.status_code == 200
        body = submit_res.json()
        assert body["passed_tests"] == body["total_tests"]
        assert body["code_score"] == 1.0
        assert body["runtime_ms"] <= 3000
        assert body["idempotent_replay"] is False

        replay_res = client.post(
            "/api/v2/concepts/net-internet/code-sandbox/submit",
            json={
                "submission_id": sub_id,
                "challenge_id": ch["challenge_id"],
                "language": ch["language"],
                "source_code": "def parse_host_port(url): return ('x', 80)",
            },
        )
        assert replay_res.status_code == 200
        assert replay_res.json()["idempotent_replay"] is True


def test_pl3_grader_01_infinite_loop_terminated_within_3200ms() -> None:
    """Infinite loop in user code is killed and returns 408 SANDBOX_TIMEOUT <= 3.2s (INV-SANDBOX-01)."""
    with TestClient(app) as client:
        _register_and_login(client)
        _complete_playbook(client, "backend", "net-internet")
        ch = client.get("/api/v2/concepts/net-internet/code-challenge").json()
        t0 = time.monotonic()
        res = client.post(
            "/api/v2/concepts/net-internet/code-sandbox/submit",
            json={
                "submission_id": str(uuid.uuid4()),
                "challenge_id": ch["challenge_id"],
                "language": "python",
                "source_code": "def parse_host_port(url: str):\n    while True:\n        pass\n",
            },
        )
        elapsed = time.monotonic() - t0
        assert res.status_code == 408
        assert res.json()["detail"]["error_code"] == "SANDBOX_TIMEOUT"
        assert elapsed <= 3.8


def test_pl3_grader_01_network_and_filesystem_isolation() -> None:
    """Forbidden network/filesystem imports or calls are blocked with 422 SANDBOX_SECURITY_VIOLATION."""
    with TestClient(app) as client:
        _register_and_login(client)
        _complete_playbook(client, "backend", "net-internet")
        ch = client.get("/api/v2/concepts/net-internet/code-challenge").json()
        res = client.post(
            "/api/v2/concepts/net-internet/code-sandbox/submit",
            json={
                "submission_id": str(uuid.uuid4()),
                "challenge_id": ch["challenge_id"],
                "language": "python",
                "source_code": "import socket\ndef parse_host_port(url):\n    s = socket.socket()\n    return ('a', 80)\n",
            },
        )
        assert res.status_code == 422
        assert res.json()["detail"]["error_code"] == "SANDBOX_SECURITY_VIOLATION"
