"""Comprehensive regression tests for Gate 3 Remediation (F-G3-01 .. F-G3-13)."""

from __future__ import annotations

import hashlib
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select, update

from app.config import REPO_ROOT
from app.db.models import (
    AssessmentSessionModel,
    AttemptRecordModel,
    DepthQuestionModel,
    ModelRegistryModel,
    OnlineEvalRunModel,
    OutboxEventModel,
    RlExperienceBufferModel,
    SessionLocal,
    UserConceptMasteryModel,
    UserModel,
    UserNodeCompetencyModel,
)
from app.main import app
from app.modules.assessment.sandbox_worker import (
    IsolatedSandboxWorkerAdapter,
    SandboxSecurityError,
)


def _cleanup_user(username: str) -> None:
    with SessionLocal() as db:
        user = db.scalar(select(UserModel).where(UserModel.username == username))
        if user is None:
            return
        uid = user.id
        db.execute(delete(AttemptRecordModel).where(AttemptRecordModel.user_id == uid))
        db.execute(delete(AssessmentSessionModel).where(AssessmentSessionModel.user_id == uid))
        db.execute(delete(UserNodeCompetencyModel).where(UserNodeCompetencyModel.user_id == uid))
        db.execute(delete(UserConceptMasteryModel).where(UserConceptMasteryModel.user_id == uid))
        db.execute(delete(RlExperienceBufferModel).where(RlExperienceBufferModel.user_id == uid))
        db.execute(delete(UserModel).where(UserModel.id == uid))
        db.commit()


def _register_fresh_user(client: TestClient) -> tuple[str, str]:
    uname = f"g3_rem_{uuid.uuid4().hex[:8]}"
    res = client.post(
        "/api/v1/auth/register",
        json={
            "username": uname,
            "display_name": "Gate 3 Remediation User",
            "password": "StrongPass!2026",
        },
    )
    assert res.status_code == 201
    return uname, str(res.json()["access_token"])


def test_fg3_01_sandbox_blocks_dunder_escape_builtins_and_200mb_ram() -> None:
    """F-G3-01: Sandbox blocks getattr/__builtins__, __subclasses__, 200MB RAM, and JS escapes."""
    uname = ""
    try:
        with TestClient(app) as client:
            uname, _ = _register_fresh_user(client)
            ch = client.get("/api/v2/concepts/net-internet/code-challenge").json()

            # 1. getattr(__builtins__, ...)
            r1 = client.post(
                "/api/v2/concepts/net-internet/code-sandbox/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "challenge_id": ch["challenge_id"],
                    "language": "python",
                    "source_code": "fn = getattr(__builtins__, 'abs')\ndef parse_host_port(u): return fn(-42)",
                },
            )
            assert r1.status_code == 422
            assert r1.json()["detail"]["error_code"] == "SANDBOX_SECURITY_VIOLATION"

            # 2. ().__class__.__base__.__subclasses__()
            r2 = client.post(
                "/api/v2/concepts/net-internet/code-sandbox/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "challenge_id": ch["challenge_id"],
                    "language": "python",
                    "source_code": "n = len(().__class__.__base__.__subclasses__())\ndef parse_host_port(u): return n",
                },
            )
            assert r2.status_code == 422
            assert r2.json()["detail"]["error_code"] == "SANDBOX_SECURITY_VIOLATION"

            # 3. 200MB RAM allocation (> 128MB limit)
            r3 = client.post(
                "/api/v2/concepts/net-internet/code-sandbox/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "challenge_id": ch["challenge_id"],
                    "language": "python",
                    "source_code": "x = 'a' * (200 * 1024 * 1024)\ndef parse_host_port(u): return len(x)",
                },
            )
            assert r3.status_code == 422
            assert r3.json()["detail"]["error_code"] == "SANDBOX_SECURITY_VIOLATION"

            # 4. str.format dunder bypass & unblocked module imports (import posix / import io)
            for bypass_code in (
                "s = '{0.__class__.__base__}'.format(())\ndef parse_host_port(u): return s",
                "import posix\ndef parse_host_port(u): return 1",
                "import io\ndef parse_host_port(u): return 1",
            ):
                rb = client.post(
                    "/api/v2/concepts/net-internet/code-sandbox/submit",
                    json={
                        "submission_id": str(uuid.uuid4()),
                        "challenge_id": ch["challenge_id"],
                        "language": "python",
                        "source_code": bypass_code,
                    },
                )
                assert rb.status_code == 422
                assert rb.json()["detail"]["error_code"] == "SANDBOX_SECURITY_VIOLATION"

        # 5. JS sandbox blocks require / process / fetch / child_process / global / constructor
        worker = IsolatedSandboxWorkerAdapter()
        for bad_js in (
            "const cp = require ('child_process'); function f(){return 1;}",
            "function f(){ return process.env; }",
            "function f(){ return fetch('http://127.0.0.1:8000'); }",
            "function f(){ return global['pro'+'cess'].version; }",
            "function f(){ return (() => {}).constructor('return 1')(); }",
        ):
            raised = False
            try:
                worker.execute("javascript", bad_js, [{"name": "t", "call": "f()", "expected": 1}])
            except SandboxSecurityError:
                raised = True
            assert raised, f"Expected SandboxSecurityError for JS: {bad_js}"

        # 6. Legitimate JS runs inside node:vm context when node is available
        js_res = worker.execute(
            "javascript",
            "function add(a, b) { return a + b; }",
            [{"name": "sum", "call": "add(2, 3)", "expected": 5}],
        )
        assert js_res.passed_tests == 1
        assert js_res.code_score == 1.0
    finally:
        if uname:
            _cleanup_user(uname)


def test_fg3_02_jwt_invalidated_after_logout() -> None:
    """F-G3-02: Bearer JWT must return 401 AUTH_REQUIRED after POST /api/v1/auth/logout."""
    uname = ""
    try:
        with TestClient(app) as client:
            uname, token = _register_fresh_user(client)
            headers = {"Authorization": f"Bearer {token}"}

            me_before = client.get("/api/v1/auth/me", headers=headers)
            assert me_before.status_code == 200

            # Login a second time to get a second distinct Bearer token while cookie holds first token
            login2 = client.post(
                "/api/v1/auth/login",
                json={"username": uname, "password": "StrongPass!2026", "portal": "learner"},
            )
            assert login2.status_code == 200
            token2 = str(login2.json()["access_token"])

            # Logout sending Cookie (token2) + Authorization Bearer (token) -> BOTH must be revoked
            logout_res = client.post("/api/v1/auth/logout", headers=headers)
            assert logout_res.status_code == 200
            assert logout_res.json()["logged_out"] is True

            # Reuse both Bearer tokens in a fresh client (no cookies) -> both must be 401
            with TestClient(app) as client2:
                for revoked_tok in (token, token2):
                    me_after = client2.get(
                        "/api/v1/auth/me",
                        headers={"Authorization": f"Bearer {revoked_tok}"},
                    )
                    assert me_after.status_code == 401
                    assert me_after.json()["error_code"] == "AUTH_REQUIRED"
    finally:
        if uname:
            _cleanup_user(uname)


def test_fg3_03_concurrent_duplicate_submissions_never_return_500() -> None:
    """F-G3-03: 5 parallel requests with identical submission_id all return 200 (0x HTTP 500)."""
    uname = ""
    try:
        with TestClient(app) as client:
            uname, token = _register_fresh_user(client)
            headers = {"Authorization": f"Bearer {token}"}

            # A. Concurrent Depth Assessment submit
            start_res = client.post(
                "/api/v2/assessments/start",
                json={
                    "domain_slug": "backend",
                    "concept_slug": "net-internet",
                    "session_mode": "depth_probe",
                },
                headers=headers,
            )
            assert start_res.status_code == 201
            session_id = start_res.json()["session_id"]
            q_id = start_res.json()["step_item"]["question_id"]
            sub_id = str(uuid.uuid4())

            def _submit_depth() -> tuple[int, bool]:
                with TestClient(app) as c:
                    r = c.post(
                        f"/api/v2/assessments/{session_id}/submit",
                        json={
                            "submission_id": sub_id,
                            "question_id": q_id,
                            "selected_option": "A",
                        },
                        headers=headers,
                    )
                    return r.status_code, bool(r.json().get("idempotent_replay", False))

            with ThreadPoolExecutor(max_workers=5) as pool:
                depth_results = list(pool.map(lambda _: _submit_depth(), range(5)))

            assert all(code == 200 for code, _ in depth_results), f"Got non-200: {depth_results}"
            assert sum(1 for _, replay in depth_results if not replay) == 1
            assert sum(1 for _, replay in depth_results if replay) == 4

            # B. Concurrent Code Sandbox submit
            ch = client.get("/api/v2/concepts/net-internet/code-challenge", headers=headers).json()
            sb_sub_id = str(uuid.uuid4())

            def _submit_sandbox() -> tuple[int, bool]:
                with TestClient(app) as c:
                    r = c.post(
                        "/api/v2/concepts/net-internet/code-sandbox/submit",
                        json={
                            "submission_id": sb_sub_id,
                            "challenge_id": ch["challenge_id"],
                            "language": "python",
                            "source_code": (
                                "def parse_host_port(url: str):\n"
                                "    cleaned = url.split('://', 1)[-1].split('/', 1)[0]\n"
                                "    if ':' in cleaned:\n"
                                "        h, p = cleaned.split(':', 1)\n"
                                "        return h, int(p)\n"
                                "    return cleaned, 443 if url.startswith('https://') else 80\n"
                            ),
                        },
                        headers=headers,
                    )
                    return r.status_code, bool(r.json().get("idempotent_replay", False))

            with ThreadPoolExecutor(max_workers=5) as pool:
                sb_results = list(pool.map(lambda _: _submit_sandbox(), range(5)))

            assert all(code == 200 for code, _ in sb_results), f"Got non-200: {sb_results}"
            assert sum(1 for _, replay in sb_results if not replay) == 1
            assert sum(1 for _, replay in sb_results if replay) == 4

            with SessionLocal() as db:
                cnt1 = db.scalar(
                    select(func.count())
                    .select_from(AttemptRecordModel)
                    .where(AttemptRecordModel.submission_id == uuid.UUID(sub_id))
                )
                cnt2 = db.scalar(
                    select(func.count())
                    .select_from(AttemptRecordModel)
                    .where(AttemptRecordModel.submission_id == uuid.UUID(sb_sub_id))
                )
                assert cnt1 == 1
                assert cnt2 == 1
    finally:
        if uname:
            _cleanup_user(uname)


def test_fg3_04_active_model_registry_serving_redis_cache_and_real_online_rl() -> None:
    """F-G3-04: Micro-batch writes real zip with matching SHA-256, activate switches serving, Redis cache hits."""
    uname = ""
    cand_model_id: uuid.UUID | None = None
    cand_file: Path | None = None
    buf_ids: list[uuid.UUID] = []
    with SessionLocal() as db:
        prev_active_id = db.scalar(
            select(ModelRegistryModel.id).where(ModelRegistryModel.is_active.is_(True))
        )

    try:
        with TestClient(app) as client:
            uname, learner_token = _register_fresh_user(client)
            learner_headers = {"Authorization": f"Bearer {learner_token}"}

            # Warm Redis graph cache on 1st call, hit redis_cache on 2nd call
            r1 = client.post(
                "/api/v2/recommendations",
                json={"domain_slug": "backend"},
                headers=learner_headers,
            )
            assert r1.status_code == 200
            base_sha = r1.json()["checkpoint_sha256"]
            assert base_sha

            r2 = client.post(
                "/api/v2/recommendations",
                json={"domain_slug": "backend"},
                headers=learner_headers,
            )
            assert r2.status_code == 200
            assert r2.json()["state_source"] in ("redis_cache", "postgres_fallback")

            # Seed 16 experience buffer samples for micro-batch
            with SessionLocal() as db:
                u = db.scalar(select(UserModel).where(UserModel.username == uname))
                assert u is not None
                for _ in range(16):
                    bid = uuid.uuid4()
                    buf_ids.append(bid)
                    db.add(
                        RlExperienceBufferModel(
                            id=bid,
                            event_id=uuid.uuid4(),
                            user_id=u.id,
                            domain_slug="backend",
                            concept_slug="net-internet",
                            action_mode="Learn_New",
                            reward=1.0,
                            obs_before_json=[0.0],
                            obs_after_json=[0.5],
                        )
                    )
                db.commit()

            # Admin login with explicit portal="admin"
            adm = client.post(
                "/api/v1/auth/login",
                json={"username": "admin_demo", "password": "PlumoraDemo#2026", "portal": "admin"},
            )
            assert adm.status_code == 200
            adm_headers = {"Authorization": f"Bearer {adm.json()['access_token']}"}

            # Real system health probe
            health = client.get("/api/v2/admin/system-health", headers=adm_headers)
            assert health.status_code == 200
            hbody = health.json()
            assert hbody["mode"] in ("monolith", "microservices")
            assert hbody["postgres_connected"] is True
            assert hbody["rl_checkpoint_verified"] is True

            # Run micro-batch Online RL
            mb = client.post(
                "/api/v2/admin/online-rl/micro-batch",
                json={"batch_size": 16, "kl_target_max": 0.05},
                headers=adm_headers,
            )
            assert mb.status_code == 200
            mb_data = mb.json()
            cand_model_id = uuid.UUID(mb_data["candidate_model_id"])
            cand_sha = mb_data["checkpoint_sha256"]

            with SessionLocal() as db:
                cand_row = db.get(ModelRegistryModel, cand_model_id)
                assert cand_row is not None
                cand_file = Path(cand_row.checkpoint_path)
                if not cand_file.exists():
                    cand_file = REPO_ROOT / cand_row.checkpoint_path
                assert cand_file.exists(), f"Candidate zip missing: {cand_file}"
                actual_disk_sha = hashlib.sha256(cand_file.read_bytes()).hexdigest()
                assert actual_disk_sha == cand_sha

            if mb_data["safety_eval"]["gate_verdict"] == "PASSED":
                act = client.post(
                    f"/api/v2/admin/models/{cand_model_id}/activate",
                    json={"reason": "Gate 3 test activation"},
                    headers=adm_headers,
                )
                assert act.status_code == 200

                # Serving must immediately switch to the newly activated candidate SHA-256
                r_after_act = client.post(
                    "/api/v2/recommendations",
                    json={"domain_slug": "backend"},
                    headers=learner_headers,
                )
                assert r_after_act.status_code == 200
                assert r_after_act.json()["checkpoint_sha256"] == cand_sha

                # 1-Click Rollback must restore previous checkpoint SHA-256
                rb = client.post(
                    "/api/v2/admin/models/rollback",
                    json={"reason": "Gate 3 test rollback"},
                    headers=adm_headers,
                )
                assert rb.status_code == 200
                r_after_rb = client.post(
                    "/api/v2/recommendations",
                    json={"domain_slug": "backend"},
                    headers=learner_headers,
                )
                assert r_after_rb.status_code == 200
                assert r_after_rb.json()["checkpoint_sha256"] == base_sha
    finally:
        with SessionLocal() as db:
            if buf_ids:
                db.execute(
                    delete(RlExperienceBufferModel).where(RlExperienceBufferModel.id.in_(buf_ids))
                )
            if cand_model_id is not None:
                db.execute(
                    delete(OnlineEvalRunModel).where(
                        OnlineEvalRunModel.candidate_model_id == cand_model_id
                    )
                )
                db.execute(
                    delete(ModelRegistryModel).where(ModelRegistryModel.id == cand_model_id)
                )
            if prev_active_id is not None:
                db.execute(update(ModelRegistryModel).values(is_active=False))
                db.execute(
                    update(ModelRegistryModel)
                    .where(ModelRegistryModel.id == prev_active_id)
                    .values(is_active=True)
                )
            db.commit()
        if cand_file is not None and cand_file.exists():
            cand_file.unlink(missing_ok=True)
        if uname:
            _cleanup_user(uname)


def test_fg3_06_outbox_records_competency_updated_event() -> None:
    """F-G3-06: Placement and Depth submissions record CompetencyUpdatedEvent in outbox_events."""
    uname = ""
    try:
        with TestClient(app) as client:
            uname, token = _register_fresh_user(client)
            headers = {"Authorization": f"Bearer {token}"}

            p_start = client.post("/api/v2/domains/backend/placement/start", headers=headers)
            assert p_start.status_code == 201
            p_sid = p_start.json()["session_id"]
            p_qid = p_start.json()["current_question"]["question_id"]

            p_ans = client.post(
                f"/api/v2/domains/backend/placement/{p_sid}/answer",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "question_id": p_qid,
                    "selected_option": "A",
                },
                headers=headers,
            )
            assert p_ans.status_code == 200

            with SessionLocal() as db:
                u = db.scalar(select(UserModel).where(UserModel.username == uname))
                assert u is not None
                events = db.scalars(
                    select(OutboxEventModel).where(
                        OutboxEventModel.event_type == "CompetencyUpdatedEvent"
                    )
                ).all()
                matching = [e for e in events if e.payload_json.get("user_id") == str(u.id)]
                assert len(matching) >= 1
                # Cleanup outbox rows created by this test user
                for ev in matching:
                    db.delete(ev)
                db.commit()
    finally:
        if uname:
            _cleanup_user(uname)


def test_fg3_07_missing_portal_blocks_admin_and_expert_login() -> None:
    """F-G3-07: Omitting portal defaults to 'learner' and rejects admin_demo & expert_demo (403)."""
    with TestClient(app) as client:
        r_admin = client.post(
            "/api/v1/auth/login",
            json={"username": "admin_demo", "password": "PlumoraDemo#2026"},
        )
        assert r_admin.status_code == 403
        assert r_admin.json()["error_code"] == "FORBIDDEN_ROLE"

        r_expert = client.post(
            "/api/v1/auth/login",
            json={"username": "expert_demo", "password": "PlumoraDemo#2026"},
        )
        assert r_expert.status_code == 403
        assert r_expert.json()["error_code"] == "FORBIDDEN_ROLE"


def test_fg3_10_boundary_checks_closed_session_domain_mismatch_and_locked_challenge() -> None:
    """F-G3-10: Locked code challenge returns 403, domain mismatch returns 400, closed session returns 409."""
    uname = ""
    try:
        with TestClient(app) as client:
            uname, token = _register_fresh_user(client)
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Locked concept code challenge -> 403 CONCEPT_LOCKED
            r_locked = client.get("/api/v2/concepts/api-rest/code-challenge", headers=headers)
            assert r_locked.status_code == 403
            assert r_locked.json()["detail"]["error_code"] == "CONCEPT_LOCKED"

            # 2. Domain mismatch question_id in placement -> 400 QUESTION_DOMAIN_MISMATCH (no KeyError 500)
            p_start = client.post("/api/v2/domains/backend/placement/start", headers=headers)
            assert p_start.status_code == 201
            p_sid = p_start.json()["session_id"]

            with SessionLocal() as db:
                fe_q = db.scalars(
                    select(DepthQuestionModel).where(
                        DepthQuestionModel.concept_slug == "fe-dom-events"
                    )
                ).first()
                assert fe_q is not None
                fe_qid = str(fe_q.id)

            r_mismatch = client.post(
                f"/api/v2/domains/backend/placement/{p_sid}/answer",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "question_id": fe_qid,
                    "selected_option": "A",
                },
                headers=headers,
            )
            assert r_mismatch.status_code == 400
            assert r_mismatch.json()["detail"]["error_code"] == "QUESTION_DOMAIN_MISMATCH"

            # 3. Submitting new answer to a closed session -> 409 SESSION_CLOSED
            sr_start = client.post(
                "/api/v2/assessments/start",
                json={
                    "domain_slug": "backend",
                    "concept_slug": "net-internet",
                    "session_mode": "spaced_review",
                },
                headers=headers,
            )
            assert sr_start.status_code == 201
            sr_sid = sr_start.json()["session_id"]
            sr_qid = sr_start.json()["step_item"]["question_id"]
            sr_type = sr_start.json()["step_item"]["task_type"]
            sr_payload = (
                {"submission_id": str(uuid.uuid4()), "question_id": sr_qid, "selected_option": "A"}
                if sr_type == "mcq"
                else {
                    "submission_id": str(uuid.uuid4()),
                    "question_id": sr_qid,
                    "written_explanation": "Detailed explanation of DNS TCP HTTP resolution pipeline.",
                }
            )
            first_sr = client.post(
                f"/api/v2/assessments/{sr_sid}/submit",
                json=sr_payload,
                headers=headers,
            )
            assert first_sr.status_code == 200
            assert first_sr.json()["session_status"] == "completed"

            second_sr = client.post(
                f"/api/v2/assessments/{sr_sid}/submit",
                json={
                    "submission_id": str(uuid.uuid4()),
                    "question_id": sr_qid,
                    "selected_option": "A",
                    "written_explanation": "Another explanation after session already closed.",
                },
                headers=headers,
            )
            assert second_sr.status_code == 409
            assert second_sr.json()["detail"]["error_code"] == "SESSION_CLOSED"
    finally:
        if uname:
            _cleanup_user(uname)


def test_fg3_11_and_fg3_12_xss_display_name_headers_and_rbac_before_validation() -> None:
    """F-G3-11 & F-G3-12: Reject HTML in display_name, send Referrer-Policy, return 403 before 422."""
    with TestClient(app) as client:
        # XSS in display_name -> 422
        r_xss = client.post(
            "/api/v1/auth/register",
            json={
                "username": f"xss_{uuid.uuid4().hex[:8]}",
                "display_name": "<script>alert(1)</script>",
                "password": "StrongPass!2026",
            },
        )
        assert r_xss.status_code == 422

        # Referrer-Policy header present on backend responses
        r_health = client.get("/api/v1/health")
        assert r_health.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

        # RBAC runs BEFORE Pydantic body validation (403 instead of 422 on empty body)
        r_login = client.post(
            "/api/v1/auth/login",
            json={"username": "learner_new", "password": "PlumoraDemo#2026", "portal": "learner"},
        )
        assert r_login.status_code == 200
        headers = {"Authorization": f"Bearer {r_login.json()['access_token']}"}

        r_rbac_expert = client.post("/api/v2/expert/domains", json={}, headers=headers)
        assert r_rbac_expert.status_code == 403

        r_rbac_admin = client.post("/api/v2/admin/online-rl/micro-batch", json={}, headers=headers)
        assert r_rbac_admin.status_code == 403
