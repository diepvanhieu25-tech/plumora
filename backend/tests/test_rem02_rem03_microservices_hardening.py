"""Behavioral RED -> GREEN tests for REM-02 & REM-03 Microservices, Cache, Outbox & Seed Hardening."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import REPO_ROOT, settings
from app.db.models import (
    CodeChallengeModel,
    DepthQuestionModel,
    DomainModel,
    ModelRegistryModel,
    SessionLocal,
    UserModel,
    UserNodeCompetencyModel,
)
from app.main import app


def test_rem02_auth_logout_secure_host_cookie_backoffice_msg_and_zero_v1_writes() -> None:
    """Logout must set Secure on __Host- deletion, login points to /backoffice/login, and v1 redis_store is gone."""
    assert not (REPO_ROOT / "backend" / "app" / "db" / "redis_store.py").exists(), (
        "Orphaned v1 app/db/redis_store.py must be removed per Decision A1"
    )

    with TestClient(app) as client:
        uname = f"rem02_u_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "REM02 User", "password": "StrongPass!2026"},
        )
        assert reg.status_code == 201
        uid = uuid.UUID(reg.json()["user"]["id"])

        # D-31: Legacy v1 ORM tables removed completely
        import app.db.models as db_models

        assert not hasattr(db_models, "UserConceptMasteryModel")
        _ = uid

        # Staff logging into learner portal must be directed to /backoffice/login (not /admin/login)
        staff_login = client.post(
            "/api/v1/auth/login",
            json={"username": "admin_demo", "password": "PlumoraDemo#2026", "portal": "learner"},
        )
        assert staff_login.status_code == 403
        msg = staff_login.json()["message"]
        assert "/backoffice/login" in msg
        assert "/admin/login" not in msg

        # Logout must include Secure attribute on __Host-plumora_session Set-Cookie header
        token = reg.json()["access_token"]
        logout = client.post("/api/v1/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert logout.status_code == 200
        set_cookies = logout.headers.get_list("set-cookie")
        host_cookies = [c for c in set_cookies if "__Host-plumora_session=" in c]
        assert host_cookies, "Expected __Host-plumora_session deletion Set-Cookie header"
        assert "Secure" in host_cookies[0], (
            f"__Host-plumora_session deletion cookie missing Secure flag: {host_cookies[0]}"
        )


def test_rem02_gateway_preserves_multi_set_cookie_security_headers_and_drops_v1_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """API Gateway must preserve multiple Set-Cookie headers, reject deleted v1 routes, and relax CSP only on /docs."""
    from services import api_gateway

    async def _fake_request(**kwargs: Any) -> httpx.Response:
        _ = kwargs
        return httpx.Response(
            status_code=200,
            content=b'{"logged_out":true}',
            headers=[
                ("content-type", "application/json"),
                ("set-cookie", "plumora_session=; Max-Age=0; Path=/"),
                ("set-cookie", "__Host-plumora_session=; Max-Age=0; Path=/; Secure"),
            ],
        )

    monkeypatch.setattr(api_gateway._GATEWAY_CLIENT, "request", _fake_request)

    with TestClient(api_gateway.app) as gw_client:
        res = gw_client.post("/api/v1/auth/logout")
        assert res.status_code == 200
        cookies = res.headers.get_list("set-cookie")
        assert len(cookies) >= 2, f"API Gateway collapsed multiple Set-Cookie headers: {cookies}"
        assert res.headers.get("x-content-type-options") == "nosniff"
        assert res.headers.get("x-frame-options") == "DENY"

        # Deleted v1 routes must return 404 directly at gateway
        for dead_v1 in ("/api/v1/roadmap", "/api/v1/concepts/net-internet", "/api/v1/recommendations"):
            r_dead = gw_client.get(dead_v1)
            assert r_dead.status_code == 404, f"Expected 404 for deleted v1 route {dead_v1}, got {r_dead.status_code}"

        # /docs must have Swagger-compatible CSP while API routes keep strict default-src 'self'
        r_docs = gw_client.get("/docs")
        assert r_docs.status_code == 200
        assert "cdn.jsdelivr.net" in r_docs.headers.get("content-security-policy", "")


def test_rem02_gateway_never_persists_or_bleeds_upstream_session_cookies(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """API Gateway httpx client must remain stateless and never bleed Set-Cookie from User A to unauthenticated User B."""
    from services import api_gateway

    def _mock_upstream(req: httpx.Request) -> httpx.Response:
        if req.url.path == "/api/v1/auth/login":
            return httpx.Response(
                status_code=200,
                content=b'{"ok":true}',
                headers=[
                    ("content-type", "application/json"),
                    ("set-cookie", "plumora_session=user_a_secret_jwt; Path=/; HttpOnly"),
                ],
            )
        return httpx.Response(
            status_code=200 if req.headers.get("cookie") else 401,
            content=json.dumps({"forwarded_cookie": req.headers.get("cookie")}).encode("utf-8"),
            headers=[("content-type", "application/json")],
        )

    stateless_client = api_gateway.build_gateway_http_client(
        transport=httpx.MockTransport(_mock_upstream)
    )
    monkeypatch.setattr(api_gateway, "_GATEWAY_CLIENT", stateless_client)

    with TestClient(api_gateway.app) as client_a:
        r_login = client_a.post("/api/v1/auth/login", json={"username": "a", "password": "b"})
        assert r_login.status_code == 200
        assert "plumora_session=user_a_secret_jwt" in r_login.headers.get("set-cookie", "")

    with TestClient(api_gateway.app) as unauthenticated_client_b:
        r_me = unauthenticated_client_b.get("/api/v1/auth/me")
        assert r_me.status_code == 401, (
            f"Gateway bled User A session cookie to unauthenticated User B: {r_me.text}"
        )
        assert r_me.json()["forwarded_cookie"] is None


def test_rem03_competency_state_version_monotonic_and_redis_first_cache_invalidation() -> None:
    """state_version must advance when existing competency updates, and _read_through_raw_competencies must read Redis first."""
    from app.modules.assessment.router_v2 import get_user_competencies_internal
    from app.modules.contracts.dtos import (
        ConceptNodeDTO,
        DomainTopologyDTO,
        UserCompetencySnapshotDTO,
    )
    from app.modules.recommendation.service_v2 import (
        _raw_comp_redis_key,
        _read_through_raw_competencies,
    )

    with TestClient(app) as client:
        uname = f"rem03_cache_{uuid.uuid4().hex[:8]}"
        reg = client.post(
            "/api/v1/auth/register",
            json={"username": uname, "display_name": "REM03 Cache", "password": "StrongPass!2026"},
        )
        assert reg.status_code == 201
        uid = uuid.UUID(reg.json()["user"]["id"])
        headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # Complete playbook on fe-dom-events -> creates 1 UserNodeCompetencyModel row (depth=0.25)
        pb = client.post(
            "/api/v2/domains/frontend/concepts/fe-dom-events/playbook/complete",
            json={"submission_id": str(uuid.uuid4())},
            headers=headers,
        )
        assert pb.status_code == 200

        with SessionLocal() as db:
            snap1 = get_user_competencies_internal(uid, db)
            ver1 = snap1["state_version"]

            # Update the SAME competency row in-place to 0.75 -> state_version MUST strictly increase!
            comp = db.get(UserNodeCompetencyModel, (uid, "fe-dom-events"))
            assert comp is not None
            comp.depth_level_norm = 0.75
            comp.updated_at = datetime.now(UTC) + timedelta(milliseconds=10)
            db.commit()

            snap2 = get_user_competencies_internal(uid, db)
            ver2 = snap2["state_version"]
            assert ver2 > ver1, f"state_version stayed stuck at {ver1} when updating existing competency row!"

        # Verify _read_through_raw_competencies reads Redis FIRST without calling competency_port on cache hit
        r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
        cache_key = _raw_comp_redis_key(uid, "frontend")
        topo = DomainTopologyDTO(
            domain_slug="frontend",
            title="Frontend",
            description="",
            graph_version=1,
            nodes=(
                ConceptNodeDTO(
                    domain_slug="frontend",
                    concept_slug="fe-dom-events",
                    node_idx=0,
                    title="DOM Events",
                    tier=1,
                    is_shared=False,
                    prerequisites=(),
                    lesson_markdown="## DOM",
                    has_code_challenge=True,
                ),
            ),
            questions=(),
        )
        r_client.set(
            cache_key,
            json.dumps(
                {
                    "state_version": 999,
                    "graph_version": 1,
                    "competencies": {},
                }
            ),
            ex=60,
        )

        class _ExplodingCompetencyPort:
            def get_user_competency_snapshot(self, _uid: uuid.UUID) -> UserCompetencySnapshotDTO:
                raise AssertionError("HTTP CompetencyPort should NOT be called on a fresh Redis cache hit!")

        _, source = _read_through_raw_competencies(uid, "frontend", topo, _ExplodingCompetencyPort())
        assert source == "redis_cache"

        # Now run an assessment step -> Redis cache key for this user MUST be invalidated!
        st = client.post(
            "/api/v2/assessments/start",
            json={"domain_slug": "frontend", "concept_slug": "fe-dom-events", "session_mode": "depth_probe"},
            headers=headers,
        )
        assert st.status_code == 201
        sess = st.json()
        step_type = sess["step_item"]["task_type"]
        sub_body: dict[str, Any] = {
            "submission_id": str(uuid.uuid4()),
            "question_id": sess["step_item"]["question_id"],
        }
        if step_type == "mcq":
            sub_body["selected_option"] = "A"
        else:
            sub_body["written_explanation"] = (
                "Cơ chế event delegation gắn listener ở phần tử cha dựa trên event bubbling giúp giảm bộ nhớ."
            )
        sub = client.post(
            f"/api/v2/assessments/{sess['session_id']}/submit",
            json=sub_body,
            headers=headers,
        )
        assert sub.status_code == 200
        assert r_client.get(cache_key) is None, (
            "Assessment competency update must invalidate plumora:raw_comp_state:{user_id}:* in Redis"
        )


def test_rem03_seed_v2_loader_preserves_expert_edits_and_soft_deletes() -> None:
    """seed_phase3_v2_data must NOT overwrite Expert-edited prompts or reactivate soft-deleted items on restart."""
    from app.modules.content.seed_v2_loader import seed_phase3_v2_data

    with SessionLocal() as db:
        q = db.scalars(
            select(DepthQuestionModel).where(DepthQuestionModel.concept_slug == "net-internet")
        ).first()
        ch = db.scalars(
            select(CodeChallengeModel).where(CodeChallengeModel.concept_slug == "net-internet")
        ).first()
        dom = db.get(DomainModel, "frontend")
        assert q is not None and ch is not None and dom is not None

        orig_q_active = q.is_active
        orig_q_prompt = q.prompt
        orig_ch_active = ch.is_active
        orig_dom_title = dom.title
        orig_dom_ver = dom.graph_version

        try:
            # Simulate Expert soft-deleting a seed question, deactivating v1 challenge, and editing domain title
            q.is_active = False
            q.prompt = "Expert customized prompt"
            ch.is_active = False
            dom.title = "Frontend Custom Studio Title"
            dom.graph_version = orig_dom_ver + 1
            db.commit()

            # Re-run seed_phase3_v2_data (as happens on container restart)
            seed_phase3_v2_data(db)
            db.expire_all()

            q_after = db.get(DepthQuestionModel, q.id)
            ch_after = db.get(CodeChallengeModel, ch.id)
            dom_after = db.get(DomainModel, "frontend")
            assert q_after is not None and q_after.is_active is False
            assert q_after.prompt == "Expert customized prompt"
            assert ch_after is not None and ch_after.is_active is False
            assert dom_after is not None and dom_after.title == "Frontend Custom Studio Title"
        finally:
            q_restore = db.get(DepthQuestionModel, q.id)
            ch_restore = db.get(CodeChallengeModel, ch.id)
            dom_restore = db.get(DomainModel, "frontend")
            if q_restore is not None:
                q_restore.is_active = orig_q_active
                q_restore.prompt = orig_q_prompt
            if ch_restore is not None:
                ch_restore.is_active = orig_ch_active
            if dom_restore is not None:
                dom_restore.title = orig_dom_title
                dom_restore.graph_version = orig_dom_ver
            db.commit()


def test_rem03_outbox_dynamic_consumer_name_and_integrity_error_acks_cleanly(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Outbox consumer must use dynamic {hostname}-{pid} consumer name and XACK duplicate IntegrityError without PEL hang."""
    from app.modules.events import outbox as outbox_mod

    assert hasattr(outbox_mod, "_default_consumer_name"), "outbox.py must define _default_consumer_name()"
    cname = outbox_mod._default_consumer_name()
    assert "-" in cname and cname != "worker-1"

    stream_name = f"plumora:rem03_ie_{uuid.uuid4().hex[:8]}"
    ev_id = uuid.uuid4()
    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        r_client.xadd(
            stream_name,
            {
                "event_type": "CompetencyUpdatedEvent",
                "event_id": str(ev_id),
                "payload": json.dumps(
                    {
                        "user_id": str(uuid.uuid4()),
                        "domain_slug": "frontend",
                        "concept_slug": "fe-dom-events",
                        "action_mode": "Learn_New",
                        "reward": 1.0,
                        "obs_before": {},
                        "obs_after": {},
                    }
                ),
            },
        )

        # Simulate concurrent worker race raising IntegrityError on duplicate event_id commit
        def _raise_dup_integrity(*_args: Any, **_kwargs: Any) -> bool:
            raise IntegrityError("INSERT INTO consumed_events", {}, Exception("duplicate key value"))

        monkeypatch.setattr(outbox_mod, "consume_competency_event_idempotent", _raise_dup_integrity)
        with SessionLocal() as db:
            stats = outbox_mod.consume_competency_stream_once(db, stream_name=stream_name)
        assert stats["acked"] == 1, f"IntegrityError left message stuck in PEL instead of ACKing: {stats}"
        pending_info = r_client.xpending(stream_name, "rec_ai_cg")
        assert int(pending_info["pending"]) == 0
    finally:
        r_client.delete(stream_name, f"{stream_name}:dlq")


def test_rem03_policy_inspector_model_version_matches_actual_loaded_checkpoint() -> None:
    """If active ModelRegistry row points to a missing file and falls back to base, model_version must match base."""
    from app.modules.recommendation.admin_schemas import PolicyInspectRequest
    from app.modules.recommendation.admin_service import inspect_policy_for_admin

    ghost_id = uuid.uuid4()
    ghost_tag = f"gnn_ppo_online_ghost_{uuid.uuid4().hex[:6]}"
    with SessionLocal() as db:
        # Clean up any leftover ghost rows from prior interrupted RED runs
        stale_ghosts = db.scalars(
            select(ModelRegistryModel).where(
                ModelRegistryModel.version_tag.like("gnn_ppo_online_ghost_%")
            )
        ).all()
        for sg in stale_ghosts:
            db.delete(sg)
        db.flush()

        prev_active_ids = list(
            db.scalars(
                select(ModelRegistryModel.id).where(ModelRegistryModel.is_active.is_(True))
            ).all()
        )
        for mid in prev_active_ids:
            m_obj = db.get(ModelRegistryModel, mid)
            if m_obj is not None:
                m_obj.is_active = False
        db.flush()

        ghost = ModelRegistryModel(
            id=ghost_id,
            version_tag=ghost_tag,
            checkpoint_path="rl/artifacts/candidates/nonexistent_ghost_9999.zip",
            checkpoint_sha256="f" * 64,
            kl_divergence=0.005,
            gate_verdict="PASSED",
            is_active=True,
            eval_metrics_json={},
            activated_at=datetime.now(UTC),
        )
        try:
            db.add(ghost)
            db.commit()

            admin_user = db.scalar(select(UserModel).where(UserModel.username == "admin_demo"))
            assert admin_user is not None
            res = inspect_policy_for_admin(
                db,
                PolicyInspectRequest(domain_slug="frontend", simulated_time_offset_days=0.0),
                default_user_id=admin_user.id,
            )
            assert res["model_version"] != ghost_tag, (
                "Policy Inspector lied about model_version when active checkpoint fell back to base!"
            )
            assert res["model_version"] == "gnn_ppo_v2_base"
        finally:
            db.rollback()
            g_del = db.get(ModelRegistryModel, ghost_id)
            if g_del is not None:
                db.delete(g_del)
                db.flush()
            if prev_active_ids:
                prev_obj = db.get(ModelRegistryModel, prev_active_ids[0])
                if prev_obj is not None:
                    prev_obj.is_active = True
            else:
                base_obj = db.scalars(
                    select(ModelRegistryModel).where(
                        ModelRegistryModel.version_tag == "gnn_ppo_v2_base"
                    )
                ).first()
                if base_obj is not None:
                    base_obj.is_active = True
            db.commit()


def test_rem03_internal_cohort_and_outbox_aggregation_across_microservices(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cohort analytics and Admin outbox health/relay must delegate via internal microservice APIs."""
    from app.modules.content import expert_service
    from app.modules.events import internal_client
    from app.modules.recommendation import admin_service

    monkeypatch.setenv("ASSESSMENT_SERVICE_URL", "http://assessment-grader-service:8003")
    monkeypatch.setenv("CONTENT_SERVICE_URL", "http://content-kg-service:8002")

    monkeypatch.setattr(
        expert_service,
        "fetch_cohort_analytics_data_internal",
        lambda slugs: {
            "competencies": [
                {
                    "user_id": str(uuid.uuid4()),
                    "concept_slug": slugs[0],
                    "depth_level_norm": 0.75,
                    "stability_s": 3.0,
                    "last_practiced_at": (datetime.now(UTC) - timedelta(days=5)).isoformat(),
                }
            ],
            "sessions": [
                {
                    "concept_slug": slugs[0],
                    "current_depth_tier": 3,
                    "status": "ceiling_reached",
                }
            ],
        },
    )

    with SessionLocal() as db:
        cohort = expert_service.get_expert_cohort_analytics(db, "frontend")
        assert cohort["total_active_learners"] == 1
        assert cohort["total_needs_review_nodes"] == 1
        first_node = cohort["concepts"][0]
        assert first_node["deep_count"] == 1
        assert first_node["bottleneck_tier"] == 3

        monkeypatch.setattr(
            admin_service,
            "fetch_all_outbox_pending_internal",
            lambda: (5, {"CompetencyUpdatedEvent": 3, "DomainGraphUpdatedEvent": 2}),
        )
        health = admin_service.get_system_health_status(db)
        assert health["outbox_pending_count"] == 5
        assert health["outbox_pending_by_event_type"]["CompetencyUpdatedEvent"] == 3
        assert health["outbox_pending_by_event_type"]["DomainGraphUpdatedEvent"] == 2

        monkeypatch.setattr(admin_service, "trigger_remote_outbox_relays_internal", lambda: 4)
        relay_res = admin_service.trigger_manual_outbox_relay(db)
        assert relay_res["status"] == "ok"
        assert relay_res["relayed"] == 4

        # Verify Expert question update bumps Redis KG epoch for cross-worker _BUNDLE_CACHE invalidation
        epoch_before = internal_client._get_current_kg_epoch()
        internal_client.bump_kg_cache_epoch(["frontend"])
        epoch_after = internal_client._get_current_kg_epoch()
        assert epoch_after > epoch_before


def test_rem02_gateway_blocks_dot_segment_traversal_and_handles_upstream_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """API Gateway must block dot-segment path traversal and return 502/504 JSON with security headers on upstream errors."""
    from services import api_gateway

    seen_paths: list[str] = []

    def _mock_upstream(req: httpx.Request) -> httpx.Response:
        seen_paths.append(req.url.path)
        if req.url.path == "/api/v1/auth/me":
            raise httpx.ConnectError("upstream down", request=req)
        return httpx.Response(status_code=200, content=b'{"ok":true}')

    stateless_client = api_gateway.build_gateway_http_client(
        transport=httpx.MockTransport(_mock_upstream)
    )
    monkeypatch.setattr(api_gateway, "_GATEWAY_CLIENT", stateless_client)

    with TestClient(api_gateway.app) as gw_client:
        # Attempt dot-segment traversal via encoded %2e%2e to escape /api/v2/domains into /health or /internal
        for malicious in (
            "/api/v2/domains/%2e%2e/%2e%2e/health",
            "/api/v2/domains/%2e%2e/internal",
            "/api/v2/domains/%2e%2e/internal/domains/frontend/bundle",
            "/api/v2/internal",
        ):
            r_mal = gw_client.get(malicious)
            assert r_mal.status_code in (400, 403, 404), (
                f"Malicious path {malicious} bypassed gateway with status {r_mal.status_code}"
            )
        assert "/health" not in seen_paths, f"Traversal reached upstream /health: {seen_paths}"

        # Upstream connection error must return clean 502 JSONResponse with security headers (not unhandled 500)
        r_err = gw_client.get("/api/v1/auth/me")
        assert r_err.status_code == 502
        assert r_err.headers.get("x-content-type-options") == "nosniff"
        assert r_err.json()["detail"]["error_code"] == "UPSTREAM_UNAVAILABLE"


def test_rem03_kg_service_skips_cross_schema_mvp_query_in_microservice_mode(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """In Microservice mode, kg_service must not query user_concept_mastery or trigger db.rollback()."""
    from app.modules.content import kg_service
    from app.modules.contracts.dtos import UserCompetencySnapshotDTO

    monkeypatch.setenv("ASSESSMENT_SERVICE_URL", "http://assessment-grader-service:8003")

    class _DummyCompPort:
        def get_user_competency_snapshot(self, uid: uuid.UUID) -> UserCompetencySnapshotDTO:
            return UserCompetencySnapshotDTO(user_id=uid, state_version=1)

    with SessionLocal() as db:
        rollback_called = False
        orig_rollback = db.rollback

        def _spy_rollback() -> None:
            nonlocal rollback_called
            rollback_called = True
            orig_rollback()

        monkeypatch.setattr(db, "rollback", _spy_rollback)
        orig_execute = db.execute

        def _forbid_mvp_join(stmt: Any, *args: Any, **kwargs: Any) -> Any:
            if "user_concept_mastery" in str(stmt):
                raise AssertionError("Cross-schema user_concept_mastery SQL executed in microservice mode!")
            return orig_execute(stmt, *args, **kwargs)

        monkeypatch.setattr(db, "execute", _forbid_mvp_join)
        roadmap = kg_service.get_domain_roadmap_for_user(
            db, uuid.uuid4(), "frontend", competency_port=_DummyCompPort()
        )
        assert roadmap.domain_slug == "frontend"
        assert rollback_called is False


def test_rem03_playbook_complete_invalidates_redis_cache_after_commit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """complete_concept_playbook must invalidate Redis competency cache strictly AFTER transaction commit."""
    from app.db.uow import SqlAlchemyUnitOfWork
    from app.modules.assessment import service_v2
    from app.modules.assessment.schemas_v2 import PlaybookCompleteRequest

    events: list[str] = []
    orig_exit = SqlAlchemyUnitOfWork.atomic_user_mutation

    from collections.abc import Iterator
    from contextlib import contextmanager

    @contextmanager
    def _tracked_mutation(self: SqlAlchemyUnitOfWork, user_id: uuid.UUID) -> Iterator[None]:
        with orig_exit(self, user_id):
            yield
        events.append("committed")

    monkeypatch.setattr(SqlAlchemyUnitOfWork, "atomic_user_mutation", _tracked_mutation)
    orig_inv = service_v2._invalidate_user_competency_cache

    def _tracked_inv(uid: uuid.UUID) -> None:
        events.append("invalidated")
        orig_inv(uid)

    monkeypatch.setattr(service_v2, "_invalidate_user_competency_cache", _tracked_inv)

    with TestClient(app), SessionLocal() as db:
        user = db.scalar(select(UserModel).where(UserModel.username == "learner_new"))
        assert user is not None
        service_v2.complete_concept_playbook(
            db,
            user,
            "frontend",
            "fe-dom-events",
            PlaybookCompleteRequest(submission_id=uuid.uuid4()),
        )
    assert events == ["committed", "invalidated"], (
        f"Expected cache invalidation AFTER DB commit, got order: {events}"
    )


def test_rem02_gateway_blocks_multi_encoded_traversal_and_encoded_route_bypass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """API Gateway must reject triple-encoded dot segments, encoded route prefixes, and case-varied /Internal without forwarding upstream."""
    from services import api_gateway

    seen_paths: list[str] = []

    def _mock_upstream(req: httpx.Request) -> httpx.Response:
        seen_paths.append(str(req.url))
        return httpx.Response(status_code=200, content=b'{"ok":true}')

    stateless_client = api_gateway.build_gateway_http_client(
        transport=httpx.MockTransport(_mock_upstream)
    )
    monkeypatch.setattr(api_gateway, "_GATEWAY_CLIENT", stateless_client)

    with TestClient(api_gateway.app) as gw_client:
        for attack_path, expected_codes in (
            ("/api/v2/domains/%25252e%25252e/%25252e%25252e/health", (400,)),
            ("/api/v2/domains/%25252e%25252e/%252569nternal/domains/frontend/bundle", (400, 403)),
            ("/api/v2/domains/frontend/%2570lacement/start", (400,)),
            ("/api/v2/Internal/domains/frontend/bundle", (403,)),
            ("/api/v2/domains/frontend/%2e%2e/internal/outbox/pending-count", (400, 403)),
        ):
            resp = gw_client.get(attack_path)
            assert resp.status_code in expected_codes, (
                f"Attack {attack_path} returned {resp.status_code} (expected {expected_codes}): {resp.text}"
            )
        assert seen_paths == [], f"Gateway leaked encoded attack paths to upstream: {seen_paths}"


def test_rem03_soft_deleted_questions_block_new_session_but_preserve_inflight_microservice_submit(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Soft-deleting questions must return 404 on new session start (never serving inactive) while letting in-flight microservice sessions finish their current step."""
    from app.modules.assessment import service_v2
    from app.modules.assessment.schemas_v2 import (
        AssessmentStartRequest,
        AssessmentSubmitRequest,
        PlaybookCompleteRequest,
    )
    from app.modules.content.router_v2 import (
        get_concept_bundle_internal,
        get_domain_bundle_internal,
    )
    from app.modules.contracts.adapters import CachedHttpContentCatalogAdapter

    with TestClient(app), SessionLocal() as db:
        uname = f"rem03_inflight_{uuid.uuid4().hex[:8]}"
        user = UserModel(
            id=uuid.uuid4(),
            username=uname,
            display_name="Inflight Learner",
            password_hash="x",
            role="learner",
            state_version=1,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        service_v2.complete_concept_playbook(
            db,
            user,
            "devops",
            "os-basics",
            PlaybookCompleteRequest(submission_id=uuid.uuid4()),
        )

        # Start an active depth_probe session on os-basics -> gets active Tier 1 question Q1
        start_res = service_v2.start_depth_or_review_session(
            db,
            user,
            AssessmentStartRequest(
                domain_slug="devops",
                concept_slug="os-basics",
                session_mode="depth_probe",
            ),
        )
        q1_id = start_res.step_item.question_id

        all_os_qs = list(
            db.scalars(
                select(DepthQuestionModel).where(DepthQuestionModel.concept_slug == "os-basics")
            ).all()
        )
        orig_states = {q.id: q.is_active for q in all_os_qs}

        try:
            # 1. Expert soft-deletes Q1 mid-session while keeping higher tiers active
            q1_row = db.get(DepthQuestionModel, q1_id)
            assert q1_row is not None
            q1_row.is_active = False
            db.commit()

            # Simulate Microservice CachedHttpContentCatalogAdapter backed by content-kg-service internal bundle
            monkeypatch.setattr(
                "app.modules.contracts.adapters.fetch_concept_bundle_internal",
                lambda c_slug: get_concept_bundle_internal(c_slug, db, domain_slug=None),
            )
            monkeypatch.setattr(
                "app.modules.contracts.adapters.fetch_domain_bundle_internal",
                lambda d_slug: get_domain_bundle_internal(d_slug, db),
            )
            ms_catalog = CachedHttpContentCatalogAdapter()

            sub_res = service_v2.submit_depth_or_review_step(
                db,
                user,
                start_res.session_id,
                AssessmentSubmitRequest(
                    submission_id=uuid.uuid4(),
                    question_id=q1_id,
                    selected_option=q1_row.correct_option_key or "A",
                ),
                catalog_port=ms_catalog,
            )
            assert sub_res.step_passed is True

            # 2. Now soft-delete ALL questions for os-basics -> new session start MUST raise 404 NO_QUESTIONS (never serve inactive!)
            for q in all_os_qs:
                q.is_active = False
            db.commit()

            with pytest.raises(Exception) as exc_info:
                service_v2.start_depth_or_review_session(
                    db,
                    user,
                    AssessmentStartRequest(
                        domain_slug="devops",
                        concept_slug="os-basics",
                        session_mode="depth_probe",
                    ),
                )
            assert getattr(exc_info.value, "status_code", None) == 404
        finally:
            for q_id, was_active in orig_states.items():
                q_obj = db.get(DepthQuestionModel, q_id)
                if q_obj is not None:
                    q_obj.is_active = was_active
            db.commit()


def test_rem03_domain_events_stream_xautoclaims_orphaned_pel_messages() -> None:
    """consume_domain_events_stream_once must XAUTOCLAIM orphaned PEL messages from crashed worker PIDs."""
    from app.modules.events import outbox as outbox_mod

    stream_name = f"plumora:rem03_dom_pel_{uuid.uuid4().hex[:8]}"
    cg_name = "test_dom_pel_cg"
    ev_id = uuid.uuid4()
    r_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        r_client.xgroup_create(stream_name, cg_name, id="0", mkstream=True)
        r_client.xadd(
            stream_name,
            {
                "event_type": "DomainGraphUpdatedEvent",
                "event_id": str(ev_id),
                "payload": json.dumps({"domain_slug": "frontend", "graph_version": 2}),
            },
        )
        # Claim message as dead worker "dead-pod-99999" without ACKing -> stranded in PEL!
        claimed = r_client.xreadgroup(
            groupname=cg_name,
            consumername="dead-pod-99999",
            streams={stream_name: ">"},
            count=1,
        )
        assert len(claimed) == 1
        assert int(r_client.xpending(stream_name, cg_name)["pending"]) == 1

        with SessionLocal() as db:
            stats = outbox_mod.consume_domain_events_stream_once(
                db,
                consumer_group=cg_name,
                consumer_name="live-pod-10001",
                stream_name=stream_name,
                min_idle_ms=0,
            )
        assert stats["acked"] == 1, f"Orphaned domain event left stuck in PEL: {stats}"
        assert int(r_client.xpending(stream_name, cg_name)["pending"]) == 0
    finally:
        r_client.delete(stream_name)


def test_rem03_activate_candidate_handles_concurrent_active_row_flip_and_auth_avoids_users_sql_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """activate_candidate_model must deactivate all active rows atomically under advisory lock, and extract_current_user must check to_regclass('users') without SQL rollback."""
    from fastapi import Request

    from app.modules.auth import security as auth_sec
    from app.modules.auth.security import create_access_token
    from app.modules.recommendation import admin_service
    from app.modules.recommendation.service_v2 import publish_active_model_pointer

    # 1. Verify extract_current_user uses to_regclass('users') on PostgreSQL when users table is absent in schema
    monkeypatch.setattr(auth_sec, "_USERS_TABLE_ACCESSIBLE_CACHE", {})
    with SessionLocal() as db:
        rollback_triggered = False
        orig_rollback = db.rollback

        def _spy_rb() -> None:
            nonlocal rollback_triggered
            rollback_triggered = True
            orig_rollback()

        orig_exec = db.execute

        def _mock_isolated_schema(stmt: Any, *args: Any, **kwargs: Any) -> Any:
            s_txt = str(stmt)
            if "to_regclass('users')" in s_txt:
                class _FalseScalar:
                    def scalar(self) -> bool:
                        return False
                return _FalseScalar()
            if "FROM users" in s_txt:
                raise AssertionError("extract_current_user queried missing users table instead of checking to_regclass!")
            return orig_exec(stmt, *args, **kwargs)

        monkeypatch.setattr(db, "rollback", _spy_rb)
        monkeypatch.setattr(db, "execute", _mock_isolated_schema)
        monkeypatch.setattr(db, "get", lambda *_a, **_kw: (_ for _ in ()).throw(AssertionError("db.get(UserModel) should not be called when to_regclass('users') is false!")))

        tok = create_access_token(uuid.uuid4(), "isolated_worker_user", role="learner")
        scope = {
            "type": "http",
            "headers": [(b"authorization", f"Bearer {tok}".encode("latin-1"))],
            "query_string": b"",
        }
        user_out = auth_sec.extract_current_user(Request(scope), db)
        assert user_out is not None and user_out.username == "isolated_worker_user"
        assert rollback_triggered is False

    # 2. Verify concurrent multi-thread activate_candidate_model & rollback_active_model serialize cleanly without 500 UniqueViolation
    from concurrent.futures import ThreadPoolExecutor

    cand_dir = REPO_ROOT / "rl" / "artifacts" / "candidates"
    cand_dir.mkdir(parents=True, exist_ok=True)
    base_bytes = (REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip").read_bytes()
    import hashlib

    base_sha = hashlib.sha256(base_bytes).hexdigest()
    c1_file = cand_dir / f"test_conc_c1_{uuid.uuid4().hex[:6]}.zip"
    c2_file = cand_dir / f"test_conc_c2_{uuid.uuid4().hex[:6]}.zip"
    c1_file.write_bytes(base_bytes)
    c2_file.write_bytes(base_bytes)
    c1_id = uuid.uuid4()
    c2_id = uuid.uuid4()

    try:
        with SessionLocal() as db:
            admin_service._ensure_prod_model_seeded(db)
            for cid, cfile, tag in (
                (c1_id, c1_file, f"cand_conc_1_{c1_id.hex[:6]}"),
                (c2_id, c2_file, f"cand_conc_2_{c2_id.hex[:6]}"),
            ):
                db.add(
                    ModelRegistryModel(
                        id=cid,
                        version_tag=tag,
                        checkpoint_path=str(cfile.relative_to(REPO_ROOT)),
                        checkpoint_sha256=base_sha,
                        kl_divergence=0.004,
                        gate_verdict="PASSED",
                        is_active=False,
                        eval_metrics_json={},
                    )
                )
            db.commit()

        def _worker_activate(target_id: uuid.UUID) -> str:
            with SessionLocal() as wdb:
                res = admin_service.activate_candidate_model(wdb, target_id, reason="Concurrent test")
                return str(res["active_model_id"])

        with ThreadPoolExecutor(max_workers=4) as pool:
            futs = [
                pool.submit(_worker_activate, c1_id),
                pool.submit(_worker_activate, c2_id),
                pool.submit(_worker_activate, c1_id),
                pool.submit(_worker_activate, c2_id),
            ]
            results = [f.result() for f in futs]
        assert len(results) == 4

        with SessionLocal() as db:
            active_rows = list(
                db.scalars(
                    select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True))
                ).all()
            )
            assert len(active_rows) == 1
            rb_res = admin_service.rollback_active_model(db, reason="Restore after concurrent test")
            assert rb_res["active_model_id"]
    finally:
        c1_file.unlink(missing_ok=True)
        c2_file.unlink(missing_ok=True)
        with SessionLocal() as db:
            for cid in (c1_id, c2_id):
                row = db.get(ModelRegistryModel, cid)
                if row is not None:
                    db.delete(row)
            db.flush()
            base_row = db.scalars(
                select(ModelRegistryModel).where(
                    ModelRegistryModel.version_tag == "gnn_ppo_v2_base"
                )
            ).first()
            if base_row is not None:
                for m in db.scalars(
                    select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True))
                ).all():
                    if m.id != base_row.id:
                        m.is_active = False
                db.flush()
                base_row.is_active = True
                publish_active_model_pointer(
                    str(base_row.checkpoint_path), str(base_row.checkpoint_sha256)
                )
            db.commit()




