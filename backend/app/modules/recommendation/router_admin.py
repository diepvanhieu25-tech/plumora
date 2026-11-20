"""FastAPI router for /api/v2/admin/* (SCR-18..SCR-20, PL3-ROLE-01, INV-ONLINE-RL-01)."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends

from app.db.models import DbSession, UserModel
from app.modules.auth.rbac import require_roles
from app.modules.recommendation.admin_schemas import (
    MicroBatchTrainRequest,
    ModelActionRequest,
    OnlineRlStatusResponse,
)
from app.modules.recommendation.admin_service import (
    activate_candidate_model,
    get_online_rl_status,
    get_system_health_status,
    rollback_active_model,
    run_micro_batch_online_rl,
)

AdminUser = Annotated[UserModel, Depends(require_roles("admin"))]
router = APIRouter(prefix="/api/v2/admin", tags=["admin_v2"])


@router.get("/online-rl/status", response_model=OnlineRlStatusResponse)
def get_admin_online_rl_status(_user: AdminUser, db: DbSession) -> OnlineRlStatusResponse:
    """Get Online RL buffer & model registry status (admin only)."""
    return get_online_rl_status(db)


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
    _payload: ModelActionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Activate a PASSED candidate model (422 if BLOCKED)."""
    return activate_candidate_model(db, model_id)


@router.post("/models/rollback")
def post_admin_rollback_model(
    _user: AdminUser,
    _payload: ModelActionRequest,
    db: DbSession,
) -> dict[str, Any]:
    """Execute 1-Click Rollback (< 2000ms) to previous PASSED checkpoint."""
    return rollback_active_model(db)


@router.get("/system-health")
def get_admin_system_health(_user: AdminUser, db: DbSession) -> dict[str, Any]:
    """Get 4 Microservices, 4-Schema isolation, Outbox & Redis Streams health (admin only)."""
    return get_system_health_status(db)
