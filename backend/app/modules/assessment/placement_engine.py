"""Adaptive Placement Engine: <= 6 DAG-stepping diagnostic questions with 0.75 cap."""

from __future__ import annotations

from dataclasses import dataclass

MAX_PLACEMENT_QUESTIONS: int = 6
PLACEMENT_DEPTH_CAP: float = 0.75
PLACEMENT_PASS_CONFIDENCE: float = 0.60
PLACEMENT_FAIL_CONFIDENCE: float = 0.30


@dataclass(frozen=True)
class PlacementNodeInit:
    """Initialized competency from Adaptive Placement."""

    concept_slug: str
    depth_level_norm: float
    confidence: float
    stability_s: float


def compute_placement_init_depth(node_tier: int, passed: bool) -> PlacementNodeInit | None:
    """Helper placeholder returning cap-compliant placement depth."""
    raise NotImplementedError  # Unused; use build_placement_node_init


def build_placement_node_init(
    concept_slug: str,
    node_tier: int,
    passed: bool,
) -> PlacementNodeInit:
    """Compute initialized depth capped at 0.75 (Deep Understanding) with confidence=0.60 on pass."""
    if not passed:
        return PlacementNodeInit(
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            confidence=PLACEMENT_FAIL_CONFIDENCE,
            stability_s=3.0,
        )
    # Tier 1 -> 0.50 (Applied), Tier 2 -> 0.75, Tier 3+ -> capped at 0.75
    raw_depth = 0.50 if node_tier <= 1 else 0.75
    capped = min(PLACEMENT_DEPTH_CAP, raw_depth)
    return PlacementNodeInit(
        concept_slug=concept_slug,
        depth_level_norm=capped,
        confidence=PLACEMENT_PASS_CONFIDENCE,
        stability_s=3.0,
    )
