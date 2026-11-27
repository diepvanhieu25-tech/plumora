"""FastAPI router for /api/v2/admin/* (SCR-18..SCR-20, PL3-ROLE-01, INV-ONLINE-RL-01)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.db.models import DbSession, UserModel
from app.modules.auth.rbac import require_roles
from app.modules.recommendation.admin_schemas import (
    MicroBatchTrainRequest,
    ModelActionRequest,
    OnlineRlStatusResponse,
    PolicyInspectRequest,
)
from app.modules.recommendation.admin_service import (
    activate_candidate_model,
    get_admin_rl_analytics,
    get_online_rl_buffer_summary,
    get_online_rl_status,
    get_streams_dlq_entries,
    get_system_health_status,
    inspect_policy_for_admin,
    rollback_active_model,
    run_micro_batch_online_rl,
    trigger_manual_outbox_relay,
)

AdminUser = Annotated[UserModel, Depends(require_roles("admin"))]
router = APIRouter(prefix="/api/v2/admin", tags=["admin_v2"])


@router.get("/rl-analytics")
def get_admin_rl_analytics_route(
    _user: AdminUser,
    db: DbSession,
    domain_slug: Annotated[str | None, Query()] = None,
    user_id: Annotated[uuid.UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
) -> dict[str, Any]:
    """Get live production RL recommendation analytics & recent decisions (admin only)."""
    return get_admin_rl_analytics(db, domain_slug=domain_slug, user_id=user_id, limit=limit)


@router.get("/online-rl/status", response_model=OnlineRlStatusResponse)
def get_admin_online_rl_status(_user: AdminUser, db: DbSession) -> OnlineRlStatusResponse:
    """Get Online RL buffer & model registry status (admin only)."""
    return get_online_rl_status(db)


@router.get("/online-rl/buffer-summary")
def get_admin_online_rl_buffer_summary(
    _user: AdminUser,
    db: DbSession,
    recent_limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    """Get Experience Buffer distribution (domains, modes, rewards) and latest transitions."""
    return get_online_rl_buffer_summary(db, recent_limit=recent_limit)


@router.post("/online-rl/policy-inspect")
def post_admin_policy_inspect(
    user: AdminUser,
    payload: PolicyInspectRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Inspect N x 8 features, raw & guarded action probabilities, with Admin What-If clock."""
    return inspect_policy_for_admin(db, payload, default_user_id=user.id)


@router.post("/online-rl/micro-batch")
def post_admin_micro_batch(
    _user: AdminUser,
    payload: MicroBatchTrainRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Run Safe Micro-batch Online RL & Safety Evaluation Gate (admin only)."""
    return run_micro_batch_online_rl(db, payload)


@router.post("/models/{model_id}/activate")
def post_admin_activate_model(
    model_id: uuid.UUID,
    _user: AdminUser,
    payload: ModelActionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Activate a PASSED candidate model (422 if BLOCKED)."""
    return activate_candidate_model(db, model_id, reason=payload.reason)


@router.post("/models/rollback")
def post_admin_rollback_model(
    _user: AdminUser,
    payload: ModelActionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Execute 1-Click Rollback (< 2000ms) to previous PASSED checkpoint."""
    return rollback_active_model(db, reason=payload.reason)


@router.post("/outbox/relay")
def post_admin_outbox_relay(_user: AdminUser, db: DbSession) -> dict[str, Any]:
    """Trigger immediate outbox relay and Redis Streams consumption."""
    return trigger_manual_outbox_relay(db)


@router.get("/streams/dlq")
def get_admin_streams_dlq(
    _user: AdminUser,
    limit: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    """Inspect Redis Streams Dead-Letter Queue entries."""
    return get_streams_dlq_entries(limit=limit)


@router.get("/system-health")
def get_admin_system_health(_user: AdminUser, db: DbSession) -> dict[str, Any]:
    """Get 4 Microservices, 4-Schema isolation, Outbox & Redis Streams health (admin only)."""
    return get_system_health_status(db)
