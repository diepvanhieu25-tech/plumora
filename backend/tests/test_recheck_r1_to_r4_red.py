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
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import UserModel, engine
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


def test_r3_preset_interleaved_execution_increments_state_version_correctly() -> None:
    """R3: Applying preset must refresh locked user to prevent losing state_version increments."""
    client = TestClient(app, base_url="http://127.0.0.1:8000")
    username = f"r3_user_{uuid.uuid4().hex[:8]}"

    # Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"username": username, "display_name": "R3 Learner", "password": "ValidPassword#2026"},
    )
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Simulate interleaved transaction directly on the DB:
    # A separate transaction increments state_version from 1 to 2
    with Session(engine) as db_session:
        user = db_session.scalar(select(UserModel).where(UserModel.username == username))
        assert user is not None
        assert user.state_version == 1
        user.state_version = 2
        db_session.commit()

    # Now call POST /api/v1/me/preset
    # Because assessment/router.py calls extract_current_user before with_for_update(),
    # if it does not call db.refresh(locked_user), locked_user will have stale state_version=1
    # and locked_user.state_version += 1 will save 2 instead of 3!
    preset_res = client.post(
        "/api/v1/me/preset",
        json={"preset_key": "foundation_ready"},
        headers=headers,
    )
    assert preset_res.status_code == 200

    # Verify state_version is 3, not stale 2
    with Session(engine) as db_session:
        user = db_session.scalar(select(UserModel).where(UserModel.username == username))
        assert user is not None
        assert user.state_version == 3, f"Expected state_version == 3, got: {user.state_version}"


def test_r3_server_guard_disables_presets_when_configured() -> None:
    """R3 Guard: When enable_dev_presets is False, POST /api/v1/me/preset must return HTTP 403."""
    from app.config import settings

    client = TestClient(app, base_url="http://127.0.0.1:8000")
    username = f"r3_guard_{uuid.uuid4().hex[:8]}"

    reg_res = client.post(
        "/api/v1/auth/register",
        json={"username": username, "display_name": "R3 Guard", "password": "ValidPassword#2026"},
    )
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Temporarily set enable_dev_presets to False
    original_val = getattr(settings, "enable_dev_presets", True)
    try:
        settings.enable_dev_presets = False
        preset_res = client.post(
            "/api/v1/me/preset",
            json={"preset_key": "foundation_ready"},
            headers=headers,
        )
        assert preset_res.status_code == 403
        assert preset_res.json().get("error_code") == "DEV_PRESETS_DISABLED"
    finally:
        settings.enable_dev_presets = original_val


def test_real_05_attempts_history_returns_chronological_records() -> None:
    """REAL-05: GET /api/v1/me/attempts returns authenticated learner's quiz history."""
    client = TestClient(app, base_url="http://127.0.0.1:8000")
    username = f"r5_hist_{uuid.uuid4().hex[:8]}"

    # Register
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"username": username, "display_name": "History Learner", "password": "ValidPassword#2026"},
    )
    assert reg_res.status_code == 201

    # Check unauthenticated returns 401
    anon_client = TestClient(app, base_url="http://127.0.0.1:8000")
    anon_res = anon_client.get("/api/v1/me/attempts")
    assert anon_res.status_code == 401

    # Initially empty history
    empty_res = client.get("/api/v1/me/attempts")
    assert empty_res.status_code == 200
    assert empty_res.json()["attempts"] == []
    assert empty_res.json()["total_count"] == 0

    # Fetch concept questions to know question IDs
    concept_res = client.get("/api/v1/concepts/os-basics")
    assert concept_res.status_code == 200
    questions = concept_res.json()["questions"]
    assert len(questions) == 4

    # Submit Attempt 1 (all A: score 0.25, failed)
    sub1_id = str(uuid.uuid4())
    answers1 = [{"question_id": q["id"], "selected_option": "A"} for q in questions]
    res1 = client.post(
        "/api/v1/concepts/os-basics/attempts",
        json={"submission_id": sub1_id, "answers": answers1},
    )
    assert res1.status_code == 200
    assert res1.json()["passed"] is False

    # Submit Attempt 2 (correct answers: score 1.0, passed)
    # We query the DB for correct keys to make 4/4
    from app.db.models import QuizQuestionModel
    with Session(engine) as db_session:
        db_qs = db_session.scalars(
            select(QuizQuestionModel).where(QuizQuestionModel.concept_action_id == 1)
        ).all()
        answers2 = [
            {"question_id": str(q.id), "selected_option": q.correct_option_key}
            for q in db_qs
        ]

    sub2_id = str(uuid.uuid4())
    res2 = client.post(
        "/api/v1/concepts/os-basics/attempts",
        json={"submission_id": sub2_id, "answers": answers2},
    )
    assert res2.status_code == 200
    assert res2.json()["passed"] is True

    # Now verify history endpoint returns 2 records, newest first
    hist_res = client.get("/api/v1/me/attempts")
    assert hist_res.status_code == 200
    data = hist_res.json()
    assert data["total_count"] == 2
    attempts = data["attempts"]
    assert len(attempts) == 2

    # Newest attempt is first (Attempt 2: passed)
    assert attempts[0]["submission_id"] == sub2_id
    assert attempts[0]["concept_slug"] == "os-basics"
    assert attempts[0]["tier"] == 1
    assert attempts[0]["correct_count"] == 4
    assert attempts[0]["attempt_score"] == 1.0
    assert attempts[0]["passed"] is True

    # Older attempt is second (Attempt 1: failed)
    assert attempts[1]["submission_id"] == sub1_id
    assert attempts[1]["correct_count"] == 1
    assert attempts[1]["attempt_score"] == 0.25
    assert attempts[1]["passed"] is False

    # Also check alias /api/v1/assessment/history
    alias_res = client.get("/api/v1/assessment/history")
    assert alias_res.status_code == 200
    assert alias_res.json()["total_count"] == 2

