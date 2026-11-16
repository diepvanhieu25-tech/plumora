"""Recommendation module public interface and backward compatibility layer."""

from __future__ import annotations

from app.modules.recommendation.checkpoint import (
    VerifiedDqnCheckpoint,
    load_verified_dqn_checkpoint,
    resolve_repo_path,
)
from app.modules.recommendation.router import router
from app.modules.recommendation.service import compute_recommendation
from app.modules.recommendation.strategies import (
    DagTierFallbackStrategy,
    DqnDirectStrategy,
    DqnMaskedQStrategy,
    RecommendationStrategy,
)

__all__ = [
    "DagTierFallbackStrategy",
    "DqnDirectStrategy",
    "DqnMaskedQStrategy",
    "RecommendationStrategy",
    "VerifiedDqnCheckpoint",
    "compute_recommendation",
    "load_verified_dqn_checkpoint",
    "resolve_repo_path",
    "router",
]
