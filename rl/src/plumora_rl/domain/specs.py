"""Zero-Torch shared RL domain specifications (feature indices, modes, DTOs)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum

import numpy as np

NODE_FEAT_DIM: int = 8
NUM_MODES: int = 4
PASS_DEPTH_THRESHOLD: float = 0.75


class NodeFeatureIdx(IntEnum):
    """Canonical 8-dimensional node feature column indices."""

    DEPTH_NORM = 0
    CONFIDENCE = 1
    RETENTION = 2
    IS_ELIGIBLE = 3
    NEEDS_REVIEW = 4
    TIER_DIFFICULTY = 5
    CODE_SCORE = 6
    IS_GOAL_PATH = 7


class LearningMode(IntEnum):
    """Factored RL action learning modes."""

    LEARN_NEW = 0
    DEEP_PROBE = 1
    CODE_PRACTICE = 2
    SPACED_REVIEW = 3


MODE_NAMES: tuple[str, str, str, str] = (
    "Learn_New",
    "Deep_Probe",
    "Code_Practice",
    "Spaced_Review",
)

MODE_NAME_TO_ENUM: dict[str, LearningMode] = {
    "Learn_New": LearningMode.LEARN_NEW,
    "Deep_Probe": LearningMode.DEEP_PROBE,
    "Code_Practice": LearningMode.CODE_PRACTICE,
    "Spaced_Review": LearningMode.SPACED_REVIEW,
}

COGNITIVE_COSTS: tuple[float, float, float, float] = (0.15, 0.30, 0.35, 0.10)


@dataclass(frozen=True)
class NodeCompetencyInput:
    """Domain-agnostic competency state of a single concept node."""

    concept_slug: str
    node_idx: int
    tier: int
    prerequisites: tuple[str, ...] = ()
    depth_level_norm: float = 0.0
    confidence: float = 0.0
    stability_s: float = 3.0
    last_practiced_at: datetime | None = None
    retention_override: float | None = None
    code_practice_score: float = 0.0
    has_code_challenge: bool = True
    is_shared: bool = False


@dataclass(frozen=True)
class GraphEdgeInput:
    """Directed prerequisite edge (prereq_slug -> concept_slug)."""

    prereq_slug: str
    concept_slug: str


@dataclass(frozen=True)
class GraphObservation:
    """Immutable tensor + metadata observation for arbitrary-size Knowledge Graphs."""

    node_order: tuple[str, ...]
    node_features: np.ndarray  # shape (N, 8), float32 in [0, 1]
    adj_in: np.ndarray  # shape (N, N), float32 row-degree normalized (prereq -> node)
    adj_out: np.ndarray  # shape (N, N), float32 row-degree normalized (node -> dep)
    has_code_challenge: np.ndarray  # shape (N,), bool

    @property
    def num_nodes(self) -> int:
        return int(self.node_features.shape[0])

    def to_dict(self) -> dict[str, np.ndarray]:
        """Convert to Gym-compatible observation dict."""
        return {
            "node_features": self.node_features,
            "adj_in": self.adj_in,
            "adj_out": self.adj_out,
        }
