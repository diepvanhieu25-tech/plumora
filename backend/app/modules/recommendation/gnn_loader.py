"""Verified GNN-PPO Checkpoint Loader & Pure-NumPy 3-Layer GNN Inference (PL3-GUARD-01)."""

from __future__ import annotations

import hashlib
import io
import json
import math
import zipfile
from pathlib import Path
from typing import cast

import numpy as np

from app.config import REPO_ROOT, settings

DEFAULT_GNN_CKPT_PATH = REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
DEFAULT_GNN_MANIFEST_PATH = REPO_ROOT / "rl" / "artifacts" / "manifest_phase3.json"


def _gelu(x: np.ndarray) -> np.ndarray:
    return cast(np.ndarray, 0.5 * x * (1.0 + np.tanh(math.sqrt(2.0 / math.pi) * (x + 0.044715 * (x**3)))))


def _layer_norm(x: np.ndarray, weight: np.ndarray, bias: np.ndarray, eps: float = 1e-5) -> np.ndarray:
    mean = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    normed = (x - mean) / np.sqrt(var + eps)
    return cast(np.ndarray, normed * weight + bias)


class VerifiedGnnPpoCheckpoint:
    """In-memory verified GNN-PPO weights for <5ms CPU inference."""

    def __init__(self, sha256: str, weights: dict[str, np.ndarray]) -> None:
        self.sha256 = sha256
        self.w = weights

    def _linear(self, x: np.ndarray, prefix: str, has_bias: bool = True) -> np.ndarray:
        out = x @ self.w[f"{prefix}__weight"].T
        if has_bias:
            out = out + self.w[f"{prefix}__bias"]
        return cast(np.ndarray, out)

    def predict_logits(
        self,
        node_features: np.ndarray,
        adj_in: np.ndarray,
        adj_out: np.ndarray,
    ) -> np.ndarray:
        """Compute (N, 4) action logits matching PyTorch GnnActorCritic exactly."""
        h = _gelu(self._linear(node_features.astype(np.float32), "input_proj"))
        for idx in range(3):
            p = f"layers__{idx}"
            msg = (
                self._linear(h, f"{p}__w_self", has_bias=True)
                + self._linear(adj_in @ h, f"{p}__w_prereq", has_bias=False)
                + self._linear(adj_out @ h, f"{p}__w_dep", has_bias=False)
            )
            h = _layer_norm(
                h + _gelu(msg),
                self.w[f"{p}__norm__weight"],
                self.w[f"{p}__norm__bias"],
            )

        g = h.mean(axis=0, keepdims=True)
        g_exp = np.repeat(g, h.shape[0], axis=0)
        actor_in = np.concatenate([h, g_exp], axis=-1)
        a1 = _gelu(self._linear(actor_in, "actor_head__0"))
        logits = self._linear(a1, "actor_head__2")
        return logits


_CKPT_CACHE: dict[tuple[str, str], tuple[str, VerifiedGnnPpoCheckpoint]] = {}


def _resolve_path(raw: str | Path) -> Path:
    p = Path(raw)
    if p.exists():
        return p
    candidate = REPO_ROOT / p
    if candidate.exists():
        return candidate
    return p


def load_verified_gnn_checkpoint(
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
    expected_sha256_override: str | None = None,
) -> VerifiedGnnPpoCheckpoint | None:
    """Load and SHA-256 verify a GNN-PPO checkpoint; return None on missing/corrupt."""
    ckpt_path = (
        _resolve_path(checkpoint_path_override)
        if checkpoint_path_override
        else _resolve_path(settings.rl_checkpoint_path)
    )
    if not checkpoint_path_override and not ckpt_path.exists() and DEFAULT_GNN_CKPT_PATH.exists():
        ckpt_path = DEFAULT_GNN_CKPT_PATH

    if not ckpt_path.exists():
        return None

    try:
        if expected_sha256_override:
            expected_sha = expected_sha256_override.strip()
            cache_id = expected_sha
        else:
            manifest_path = (
                _resolve_path(manifest_path_override)
                if manifest_path_override
                else _resolve_path(settings.rl_manifest_path)
            )
            if (
                not manifest_path_override
                and not manifest_path.exists()
                and DEFAULT_GNN_MANIFEST_PATH.exists()
            ):
                manifest_path = DEFAULT_GNN_MANIFEST_PATH
            if not manifest_path.exists():
                return None
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            expected_sha = str(manifest.get("checkpoint_sha256", ""))
            cache_id = str(manifest_path)

        if not expected_sha:
            return None
        actual_sha = hashlib.sha256(ckpt_path.read_bytes()).hexdigest()
        if actual_sha != expected_sha:
            return None

        cache_key = (str(ckpt_path), cache_id)
        cached = _CKPT_CACHE.get(cache_key)
        if cached is not None and cached[0] == actual_sha:
            return cached[1]

        with zipfile.ZipFile(ckpt_path, "r") as zf:
            npz_bytes = zf.read("weights.npz")
        npz = np.load(io.BytesIO(npz_bytes))
        weights = {k: npz[k] for k in npz.files}
        verified = VerifiedGnnPpoCheckpoint(actual_sha, weights)
        _CKPT_CACHE[cache_key] = (actual_sha, verified)
        return verified
    except (OSError, ValueError, KeyError, zipfile.BadZipFile):
        return None
