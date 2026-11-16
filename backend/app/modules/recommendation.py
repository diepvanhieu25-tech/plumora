"""DQN Checkpoint verification, Q-network inference, Guardrail, and Fallback (D-07, D-10)."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import pickle
import uuid
import zipfile
from collections import OrderedDict
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import ConceptModel, DbSession, RecommendationLogModel
from app.db.redis_store import PASS_THRESHOLD, get_learner_state_24d
from app.modules.auth import extract_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1", tags=["recommendation"])


def resolve_repo_path(raw_path: str) -> Path:
    """Resolve an artifact path directly or relative to the repository root."""
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / raw_path


@dataclass(frozen=True)
class VerifiedDqnCheckpoint:
    """Verified Stable-Baselines3 DQN MLP weights and SHA-256 metadata."""

    sha256: str
    policy_version: str
    w0: np.ndarray
    b0: np.ndarray
    w2: np.ndarray
    b2: np.ndarray
    w4: np.ndarray
    b4: np.ndarray

    def compute_q_values(self, obs_24d: list[float]) -> np.ndarray:
        """Execute forward pass of QNetwork ([24 -> 128 -> ReLU -> 128 -> ReLU -> 12])."""
        x = np.asarray(obs_24d, dtype=np.float32)
        h0 = np.maximum(0.0, x @ self.w0.T + self.b0)
        h1 = np.maximum(0.0, h0 @ self.w2.T + self.b2)
        q_vals: np.ndarray = h1 @ self.w4.T + self.b4
        return q_vals


def load_verified_dqn_checkpoint(
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
) -> VerifiedDqnCheckpoint | None:
    """Verify SHA-256 of checkpoint.zip against manifest.json and load MLP Q-network weights."""
    ckpt_path = resolve_repo_path(checkpoint_path_override or settings.rl_checkpoint_path)
    manifest_path = resolve_repo_path(manifest_path_override or settings.rl_manifest_path)

    if not ckpt_path.exists() or not manifest_path.exists():
        return None

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        expected_sha = str(manifest.get("checkpoint_sha256", ""))
        ckpt_bytes = ckpt_path.read_bytes()
        actual_sha = hashlib.sha256(ckpt_bytes).hexdigest()
        if not expected_sha or actual_sha != expected_sha:
            logger.warning(
                "RL Checkpoint SHA-256 mismatch! expected=%s actual=%s",
                expected_sha,
                actual_sha,
            )
            return None

        with zipfile.ZipFile(io.BytesIO(ckpt_bytes), "r") as outer_zf:
            policy_bytes = outer_zf.read("policy.pth")

        with zipfile.ZipFile(io.BytesIO(policy_bytes), "r") as inner_zf:

            class SafeTorchUnpickler(pickle.Unpickler):
                """Restricted unpickler allowing only float32 tensor reconstruction."""

                def persistent_load(self, pid: Any) -> np.ndarray:
                    _, _, key, _, _ = pid
                    raw = inner_zf.read(f"archive/data/{key}")
                    return np.frombuffer(raw, dtype=np.float32).copy()

                def find_class(self, module: str, name: str) -> Any:
                    if module == "torch._utils" and name == "_rebuild_tensor_v2":
                        return (
                            lambda storage, offset, size, stride, req_grad, hooks: storage.reshape(
                                size
                            )
                        )
                    if module == "torch" and name == "FloatStorage":
                        return "FloatStorage"
                    if module == "collections" and name == "OrderedDict":
                        return OrderedDict
                    raise pickle.UnpicklingError(f"Disallowed class {module}.{name}")

            state_dict = SafeTorchUnpickler(io.BytesIO(inner_zf.read("archive/data.pkl"))).load()

        return VerifiedDqnCheckpoint(
            sha256=actual_sha,
            policy_version=str(manifest.get("policy_version", "dqn-v1")),
            w0=np.asarray(state_dict["q_net.q_net.0.weight"], dtype=np.float32),
            b0=np.asarray(state_dict["q_net.q_net.0.bias"], dtype=np.float32),
            w2=np.asarray(state_dict["q_net.q_net.2.weight"], dtype=np.float32),
            b2=np.asarray(state_dict["q_net.q_net.2.bias"], dtype=np.float32),
            w4=np.asarray(state_dict["q_net.q_net.4.weight"], dtype=np.float32),
            b4=np.asarray(state_dict["q_net.q_net.4.bias"], dtype=np.float32),
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load or verify RL checkpoint: %s", exc)
        return None


def compute_recommendation(
    db: Session,
    user_id: uuid.UUID,
    *,
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
    redis_url_override: str | None = None,
) -> dict[str, Any]:
    """Compute next recommended concept using verified DQN checkpoint or transparent fallback."""
    state_24d = get_learner_state_24d(
        db,
        user_id,
        redis_url_override=redis_url_override,
    )
    concepts = db.scalars(select(ConceptModel).order_by(ConceptModel.action_id)).all()
    concept_by_id = {c.action_id: c for c in concepts}

    # Check if all 12 concepts are mastered (>= 0.75)
    if all(m >= PASS_THRESHOLD for m in state_24d.mastery):
        log_entry = RecommendationLogModel(
            id=uuid.uuid4(),
            user_id=user_id,
            state_version=state_24d.state_version,
            recommended_action_id=None,
            policy_source="completed",
            state_source=state_24d.state_source,
            guardrail_applied=False,
            checkpoint_sha256=None,
            created_at=datetime.now(UTC),
        )
        db.add(log_entry)
        db.commit()
        return {
            "status": "completed",
            "recommended_concept": None,
            "policy_source": "completed",
            "state_source": state_24d.state_source,
            "guardrail_applied": False,
            "degraded": state_24d.state_source == "postgres_fallback",
            "checkpoint_sha256": None,
            "state_version": state_24d.state_version,
            "observation_24d": state_24d.observation_24d,
            "q_values": None,
        }

    eligible_indices = [i for i, flag in enumerate(state_24d.is_eligible) if flag > 0.5]
    if not eligible_indices:
        eligible_indices = [0]

    ckpt = load_verified_dqn_checkpoint(
        checkpoint_path_override=checkpoint_path_override,
        manifest_path_override=manifest_path_override,
    )

    raw_action_id: int | None = None
    q_values_list: list[float] | None = None

    if ckpt is not None:
        q_vals = ckpt.compute_q_values(state_24d.observation_24d)
        q_values_list = [round(float(x), 4) for x in q_vals]
        raw_action_id = int(np.argmax(q_vals))
        if raw_action_id in eligible_indices:
            selected_action_id = raw_action_id
            policy_source = "dqn"
            guardrail_applied = False
        else:
            masked_q = np.full_like(q_vals, -1e9)
            masked_q[eligible_indices] = q_vals[eligible_indices]
            selected_action_id = int(np.argmax(masked_q))
            policy_source = "dqn_masked_q"
            guardrail_applied = True
        ckpt_sha: str | None = ckpt.sha256
        degraded = state_24d.state_source == "postgres_fallback"
    else:
        # Transparent Fallback Rule: first eligible concept in topological order (B1)
        selected_action_id = int(eligible_indices[0])
        policy_source = "fallback_rule"
        guardrail_applied = False
        ckpt_sha = None
        degraded = True

    rec_concept = concept_by_id[selected_action_id]
    log_entry = RecommendationLogModel(
        id=uuid.uuid4(),
        user_id=user_id,
        state_version=state_24d.state_version,
        recommended_action_id=selected_action_id,
        policy_source=policy_source,
        state_source=state_24d.state_source,
        guardrail_applied=guardrail_applied,
        checkpoint_sha256=ckpt_sha,
        created_at=datetime.now(UTC),
    )
    db.add(log_entry)
    db.commit()

    return {
        "status": "active",
        "recommended_concept": {
            "action_id": rec_concept.action_id,
            "slug": rec_concept.slug,
            "title": rec_concept.title,
            "tier": rec_concept.tier,
            "mastery_score": state_24d.mastery[selected_action_id],
        },
        "raw_action_id": raw_action_id,
        "policy_source": policy_source,
        "state_source": state_24d.state_source,
        "guardrail_applied": guardrail_applied,
        "degraded": degraded,
        "checkpoint_sha256": ckpt_sha,
        "state_version": state_24d.state_version,
        "observation_24d": state_24d.observation_24d,
        "q_values": q_values_list,
    }


@router.post("/recommendations")
def post_recommendation(
    request: Request,
    db: DbSession,
) -> JSONResponse:
    """Compute and log personalized learning recommendation for current_user (PL-REC-01, PL-REC-02)."""
    user = extract_current_user(request, db)
    if user is None:
        return JSONResponse(
            status_code=401,
            content={
                "error_code": "AUTH_REQUIRED",
                "message": "Vui lòng đăng nhập để nhận gợi ý lộ trình học tập từ AI.",
                "details": {},
            },
        )

    result = compute_recommendation(db, user.id)
    return JSONResponse(status_code=200, content=result)
