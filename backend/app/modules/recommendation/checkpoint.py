"""DQN Checkpoint cryptographic SHA-256 verification and NumPy MLP weight loader."""

from __future__ import annotations

import hashlib
import io
import json
import logging
import pickle
import zipfile
from collections import OrderedDict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


def resolve_repo_path(raw_path: str) -> Path:
    """Resolve an artifact path directly or relative to the repository root."""
    candidate = Path(raw_path)
    if candidate.exists():
        return candidate
    repo_root = Path(__file__).resolve().parents[4]
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
                        return lambda storage, offset, size, stride, req_grad, hooks: (
                            storage.reshape(size)
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
