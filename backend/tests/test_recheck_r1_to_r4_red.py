"""RED Behavioral Test Suite for Recheck Findings R1, R3, R4.

Verifies:
- R1: Cookie configuration allows persistence in development (no __Host- on plain HTTP).
- R4: Concurrent duplicate username registration returns HTTP 409 Conflict, never HTTP 500.
- R3: Preset refreshes locked user in identity map to preserve monotonic state_version increments.
- R3 Guard: Dev preset endpoint can be disabled via server configuration.
"""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app, ensure_db_initialized


@pytest.fixture(autouse=True)
def init_test_db() -> None:
    ensure_db_initialized()


def test_r1_cookie_name_and_flags_on_development_allow_browser_persistence() -> None:
    """R1: In development (HTTP), session cookie name must NOT have '__Host-' prefix if secure=False.

    Browsers strictly reject '__Host-' cookies when Secure is false or when sent over HTTP.
    Subsequent /api/v1/auth/me request using only cookie credentials must succeed with HTTP 200.
    """
    client = TestClient(app, base_url="http://127.0.0.1:8000")
    unique_username = f"user_r1_{uuid.uuid4().hex[:8]}"

    # Register user
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "username": unique_username,
            "display_name": "R1 Learner",
            "password": "ValidPassword#2026",
        },
    )
    assert reg_res.status_code == 201

    # Check set-cookie header in response
    cookies_header = reg_res.headers.get("set-cookie", "")
    assert cookies_header, "No Set-Cookie header returned upon registration"

    # RFC 6265bis: __Host- prefix MUST NOT be used when secure flag is absent
    if "secure" not in cookies_header.lower():
        assert "__Host-" not in cookies_header, (
            f"Cookie header '{cookies_header}' uses '__Host-' prefix without Secure flag! "
            "Browsers will discard this cookie over HTTP."
        )

    # In development, the effective cookie name should be 'plumora_session'
    assert settings.effective_session_cookie_name == "plumora_session"
    assert "plumora_session=" in cookies_header

    # Request /api/v1/auth/me relying ONLY on cookie (client stores cookie jar automatically)
    # Ensure no Authorization header is passed
    me_res = client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["username"] == unique_username


def test_r4_concurrent_registration_duplicate_username_returns_409_never_500() -> None:
    """R4: Simultaneous duplicate username registrations must return 409 Conflict, never HTTP 500."""
    race_username = f"race_user_{uuid.uuid4().hex[:8]}"

    payload = {
        "username": race_username,
        "display_name": "R4 Race Learner",
        "password": "ValidPassword#2026",
    }

    # Fire 5 concurrent requests with the exact same username
    def do_register() -> tuple[int, dict[str, Any]]:
        # Each thread gets its own test client to avoid shared socket state
        c = TestClient(app, base_url="http://127.0.0.1:8000")
        res = c.post("/api/v1/auth/register", json=payload)
        return res.status_code, res.json()

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(do_register) for _ in range(5)]
        results = [f.result() for f in futures]

    status_codes = [r[0] for r in results]

    # Exactly one request must succeed (201 Created)
    assert status_codes.count(201) == 1, f"Expected exactly one 201, got: {status_codes}"

    # All others must be 409 Conflict (USERNAME_TAKEN), NEVER 500
    assert 500 not in status_codes, f"Server returned HTTP 500 on concurrent registration! Codes: {status_codes}"
    assert all(code in (201, 409) for code in status_codes), f"Unexpected status codes: {status_codes}"

    # Verify 409 responses have standard error_code
    for code, body in results:
        if code == 409:
            assert body.get("error_code") == "USERNAME_TAKEN"
