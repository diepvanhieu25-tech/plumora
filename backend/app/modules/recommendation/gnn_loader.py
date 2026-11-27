"""Verified GNN-PPO Checkpoint Loader & LRU Provider delegating to plumora_rl.inference (PL3-GUARD-01)."""

from __future__ import annotations

import hashlib
import json
import threading
import zipfile
from collections import OrderedDict
from pathlib import Path

from plumora_rl.inference import NumpyGnnPredictor

from app.core.config import REPO_ROOT, settings

DEFAULT_GNN_CKPT_PATH = REPO_ROOT / "rl" / "artifacts" / "gnn_ppo_v2_base.zip"
DEFAULT_GNN_MANIFEST_PATH = REPO_ROOT / "rl" / "artifacts" / "manifest_phase3.json"

# Backwards-compatible alias for existing callers/tests
VerifiedGnnPpoCheckpoint = NumpyGnnPredictor


def _resolve_path(raw: str | Path) -> Path:
    p = Path(raw)
    if p.exists():
        return p
    candidate = REPO_ROOT / p
    if candidate.exists():
        return candidate
    return p


class LRUCheckpointProvider:
    """Thread-safe bounded LRU cache for SHA-256 verified NumpyGnnPredictor checkpoints."""

    def __init__(self, max_cached_models: int = 4) -> None:
        self._max_cached_models = max(1, max_cached_models)
        self._lock = threading.Lock()
        self._cache: OrderedDict[tuple[str, str], tuple[str, NumpyGnnPredictor]] = OrderedDict()

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def load(
        self,
        checkpoint_path_override: str | None = None,
        manifest_path_override: str | None = None,
        expected_sha256_override: str | None = None,
    ) -> NumpyGnnPredictor | None:
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
            with self._lock:
                cached = self._cache.get(cache_key)
                if cached is not None and cached[0] == actual_sha:
                    self._cache.move_to_end(cache_key)
                    return cached[1]

            verified = NumpyGnnPredictor.from_checkpoint_zip(
                ckpt_path, expected_sha256=expected_sha
            )
            with self._lock:
                self._cache[cache_key] = (actual_sha, verified)
                self._cache.move_to_end(cache_key)
                while len(self._cache) > self._max_cached_models:
                    self._cache.popitem(last=False)
            return verified
        except (OSError, ValueError, KeyError, zipfile.BadZipFile):
            return None


_DEFAULT_PROVIDER = LRUCheckpointProvider(max_cached_models=4)


def get_checkpoint_provider() -> LRUCheckpointProvider:
    """Return the shared bounded LRU checkpoint provider."""
    return _DEFAULT_PROVIDER


def load_verified_gnn_checkpoint(
    checkpoint_path_override: str | None = None,
    manifest_path_override: str | None = None,
    expected_sha256_override: str | None = None,
) -> NumpyGnnPredictor | None:
    """Load and SHA-256 verify a GNN-PPO checkpoint via bounded LRUCheckpointProvider."""
    return _DEFAULT_PROVIDER.load(
        checkpoint_path_override=checkpoint_path_override,
        manifest_path_override=manifest_path_override,
        expected_sha256_override=expected_sha256_override,
    )
