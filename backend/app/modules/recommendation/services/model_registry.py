"""Model Registry lifecycle: seeding, status, SHA-256 verification, activation & 1-Click Rollback."""

from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, text, update
from sqlalchemy.orm import Session

from app.core.config import REPO_ROOT, settings
from app.core.observability import emit_audit_event
from app.db.models import (
    ModelRegistryModel,
)
from app.modules.recommendation.admin_schemas import (
    ModelRegistryItemOut,
    OnlineRlStatusResponse,
)
from app.modules.recommendation.repository import RecommendationRepository
from app.modules.recommendation.service_v2 import (
    invalidate_active_model_cache,
    publish_active_model_pointer,
)

logger = logging.getLogger(__name__)

_CFG_CKPT_PATH = Path(settings.rl_checkpoint_path)
BASE_CKPT_PATH = (
    _CFG_CKPT_PATH
    if _CFG_CKPT_PATH.exists()
    else REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
)
WORKER_HEARTBEAT_KEY = "plumora:worker:rec_ai_cg"
COMPETENCY_STREAM_NAME = "plumora:competency_events"
DOMAIN_STREAM_NAME = "plumora:stream:domain_events"


def _ensure_prod_model_seeded(db: Session) -> ModelRegistryModel | None:
    sha = (
        hashlib.sha256(BASE_CKPT_PATH.read_bytes()).hexdigest()
        if BASE_CKPT_PATH.exists()
        else "0" * 64
    )
    base_row = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.version_tag == "gnn_ppo_v2_base")
    ).first()
    if base_row is not None:
        if BASE_CKPT_PATH.exists() and base_row.checkpoint_sha256 != sha:
            base_row.checkpoint_sha256 = sha
            db.commit()
            if base_row.is_active:
                publish_active_model_pointer(str(base_row.checkpoint_path), sha)
        return base_row

    any_active = db.scalars(
        select(ModelRegistryModel.id).where(ModelRegistryModel.is_active.is_(True)).limit(1)
    ).first()
    prod = ModelRegistryModel(
        id=uuid.uuid4(),
        version_tag="gnn_ppo_v2_base",
        checkpoint_path="rl/artifacts/gnn_ppo_v2_base.zip",
        checkpoint_sha256=sha,
        kl_divergence=0.0,
        gate_verdict="PASSED",
        is_active=any_active is None,
        eval_metrics_json={
            "invalid_action_rate_unmasked": 0.0,
            "masked_violation_rate": 0.0,
            "mean_reward_ratio_vs_prod": 1.0,
            "block_reasons": [],
        },
        activated_at=datetime.now(UTC),
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return prod


def _serialize_model(m: ModelRegistryModel) -> ModelRegistryItemOut:
    return ModelRegistryItemOut(
        model_id=m.id,
        version_tag=m.version_tag,
        checkpoint_sha256=m.checkpoint_sha256,
        kl_divergence=m.kl_divergence,
        gate_verdict=m.gate_verdict,
        is_active=m.is_active,
        created_at=m.created_at.isoformat(),
        activated_at=m.activated_at.isoformat() if m.activated_at else None,
        eval_metrics=dict(m.eval_metrics_json or {}),
    )


def get_online_rl_status(db: Session, *, limit: int = 50) -> OnlineRlStatusResponse:
    """Return Experience Buffer count and bounded Model Registry status with full eval_metrics."""
    _ensure_prod_model_seeded(db)
    repo = RecommendationRepository(db)
    buf_count = repo.count_experience_buffer()
    models = repo.list_models(limit=limit)
    active = repo.get_active_model()
    report_path = REPO_ROOT / "rl" / "artifacts" / "evaluation_phase3_report.json"
    benchmark_report: dict[str, Any] | None = None
    if report_path.exists():
        try:
            benchmark_report = json.loads(report_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            benchmark_report = None

    return OnlineRlStatusResponse(
        buffer_count=buf_count,
        kl_target_max=0.02,
        active_model=_serialize_model(active) if active else None,
        models=[_serialize_model(m) for m in models],
        benchmark_report=benchmark_report,
    )



def _verify_checkpoint_artifact(checkpoint_path_str: str, expected_sha256: str) -> Path:
    """Verify checkpoint file exists on disk, SHA-256 matches registry, and weights.npz is readable."""
    raw_p = Path(checkpoint_path_str)
    resolved = raw_p if raw_p.is_absolute() else (REPO_ROOT / raw_p)
    if not resolved.exists() or not resolved.is_file():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": f"Checkpoint file not found on disk: {checkpoint_path_str}",
            },
        )
    actual_sha = hashlib.sha256(resolved.read_bytes()).hexdigest()
    if actual_sha != expected_sha256:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": "Checkpoint SHA-256 mismatch against model_registry record.",
            },
        )
    try:
        with zipfile.ZipFile(resolved, "r") as zf:
            if "weights.npz" not in zf.namelist():
                raise ValueError("Missing weights.npz")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "MODEL_ARTIFACT_INVALID",
                "message": f"Checkpoint archive invalid: {exc}",
            },
        ) from exc
    return resolved


MODEL_REGISTRY_ADVISORY_LOCK_ID = 7_586_672_001


def _acquire_model_registry_lock(db: Session) -> None:
    """Serialize multi-worker model activation and rollback mutations via PostgreSQL advisory lock."""
    bind = db.get_bind()
    if bind is not None and bind.dialect.name == "postgresql":
        db.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": MODEL_REGISTRY_ADVISORY_LOCK_ID},
        )


def activate_candidate_model(
    db: Session,
    model_id: uuid.UUID,
    *,
    reason: str = "Admin activation",
) -> dict[str, Any]:
    """Activate a PASSED candidate model, verify SHA-256, and sync Redis active pointer."""
    t0 = time.monotonic()
    _ensure_prod_model_seeded(db)
    _acquire_model_registry_lock(db)
    cand = db.get(ModelRegistryModel, model_id)
    if cand is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error_code": "MODEL_NOT_FOUND", "message": "Candidate model not found."},
        )
    if cand.gate_verdict != "PASSED":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "error_code": "SAFETY_GATE_NOT_PASSED",
                "message": "Cannot activate a model whose Safety Evaluation Gate verdict is not PASSED.",
            },
        )
    _verify_checkpoint_artifact(cand.checkpoint_path, cand.checkpoint_sha256)

    prev = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)).with_for_update()
    ).first()
    prev_id = str(prev.id) if (prev and prev.id != cand.id) else None
    db.execute(
        update(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True), ModelRegistryModel.id != cand.id)
        .values(is_active=False)
    )
    db.flush()

    cand.is_active = True
    cand.activated_at = datetime.now(UTC)
    cand.eval_metrics_json = {
        **dict(cand.eval_metrics_json or {}),
        **({"previous_active_model_id": prev_id} if prev_id else {}),
        "last_activation_reason": reason,
    }
    db.commit()
    publish_active_model_pointer(str(cand.checkpoint_path), str(cand.checkpoint_sha256))
    emit_audit_event(
        action="admin.model_activate",
        actor_id="admin",
        role="admin",
        resource=f"model_registry:{cand.id}",
        outcome="success",
        details={"previous_model_id": prev_id, "reason": reason},
    )

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(cand.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": cand.checkpoint_sha256,
        "switched_at": cand.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
        "reason": reason,
    }


def rollback_active_model(
    db: Session,
    *,
    reason: str = "1-Click Rollback",
) -> dict[str, Any]:
    """1-Click Rollback (< 2000ms) to the actual previously active PASSED checkpoint."""
    t0 = time.monotonic()
    _ensure_prod_model_seeded(db)
    _acquire_model_registry_lock(db)
    curr = db.scalars(
        select(ModelRegistryModel).where(ModelRegistryModel.is_active.is_(True)).with_for_update()
    ).first()

    target: ModelRegistryModel | None = None
    if curr is not None and isinstance(curr.eval_metrics_json, dict):
        prev_ptr = curr.eval_metrics_json.get("previous_active_model_id")
        if prev_ptr:
            try:
                candidate_prev = db.get(ModelRegistryModel, uuid.UUID(str(prev_ptr)))
                if (
                    candidate_prev is not None
                    and candidate_prev.gate_verdict == "PASSED"
                    and candidate_prev.id != curr.id
                ):
                    try:
                        _verify_checkpoint_artifact(
                            candidate_prev.checkpoint_path,
                            candidate_prev.checkpoint_sha256,
                        )
                        target = candidate_prev
                    except HTTPException:
                        target = None
            except ValueError:
                target = None

    if target is None:
        stmt = (
            select(ModelRegistryModel)
            .where(ModelRegistryModel.gate_verdict == "PASSED")
            .order_by(
                ModelRegistryModel.activated_at.is_(None),
                ModelRegistryModel.activated_at.desc(),
                ModelRegistryModel.created_at.asc(),
            )
        )
        for m in db.scalars(stmt).all():
            if curr is None or m.id != curr.id:
                try:
                    _verify_checkpoint_artifact(m.checkpoint_path, m.checkpoint_sha256)
                    target = m
                    break
                except HTTPException:
                    continue

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "NO_ROLLBACK_TARGET",
                "message": "No previously active safe rollback target found.",
            },
        )

    prev_id = str(curr.id) if curr else None
    db.execute(
        update(ModelRegistryModel)
        .where(ModelRegistryModel.is_active.is_(True), ModelRegistryModel.id != target.id)
        .values(is_active=False)
    )
    db.flush()
    target.is_active = True
    target.activated_at = datetime.now(UTC)
    target.eval_metrics_json = {
        **dict(target.eval_metrics_json or {}),
        "last_rollback_reason": reason,
    }
    db.commit()
    invalidate_active_model_cache()
    publish_active_model_pointer(str(target.checkpoint_path), str(target.checkpoint_sha256))
    emit_audit_event(
        action="admin.model_rollback",
        actor_id="admin",
        role="admin",
        resource=f"model_registry:{target.id}",
        outcome="success",
        details={"previous_model_id": prev_id, "reason": reason},
    )

    latency_ms = max(1, int((time.monotonic() - t0) * 1000))
    return {
        "active_model_id": str(target.id),
        "previous_model_id": prev_id,
        "active_checkpoint_sha256": target.checkpoint_sha256,
        "switched_at": target.activated_at.isoformat(),
        "switch_latency_ms": latency_ms,
        "reason": reason,
    }


