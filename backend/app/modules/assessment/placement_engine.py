"""Adaptive Placement Engine: DAG Navigator with Strict Branch Ceiling & Transitive Promotion."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from app.modules.contracts.dtos import ConceptNodeDTO

MAX_PLACEMENT_QUESTIONS: int = 6
PLACEMENT_DEPTH_CAP: float = 0.75
PLACEMENT_PASS_CONFIDENCE: float = 0.60
PLACEMENT_FAIL_CONFIDENCE: float = 0.30
INITIAL_STABILITY_DAYS: float = 3.0


@dataclass(frozen=True)
class PlacementNodeInit:
    """Initialized competency produced by Adaptive Placement (capped at 0.75)."""

    concept_slug: str
    depth_level_norm: float
    confidence: float
    stability_s: float


def build_placement_node_init(
    concept_slug: str,
    node_tier: int,
    passed: bool,
) -> PlacementNodeInit:
    """Compute initialized depth capped at 0.75 (Deep Understanding) with confidence=0.60 on pass.

    Passing Tier 1 or higher yields depth_level_norm=0.75 (Deep Understanding, confidence=0.60)
    so that Tier 2 dependent nodes are genuinely unlocked per INV-DAG-01 while never granting 1.00 Mastery.
    """
    _ = node_tier
    if not passed:
        return PlacementNodeInit(
            concept_slug=concept_slug,
            depth_level_norm=0.0,
            confidence=PLACEMENT_FAIL_CONFIDENCE,
            stability_s=INITIAL_STABILITY_DAYS,
        )
    return PlacementNodeInit(
        concept_slug=concept_slug,
        depth_level_norm=PLACEMENT_DEPTH_CAP,
        confidence=PLACEMENT_PASS_CONFIDENCE,
        stability_s=INITIAL_STABILITY_DAYS,
    )


class PlacementDagNavigator:
    """Stateful DAG navigator enforcing Strict Branch Ceiling and Transitive Prerequisite Promotion."""

    def __init__(self, nodes: Sequence[ConceptNodeDTO]) -> None:
        self._nodes = list(nodes)
        self._by_slug: dict[str, ConceptNodeDTO] = {n.concept_slug: n for n in self._nodes}

    def initial_roots(self) -> list[str]:
        roots = [n.concept_slug for n in self._nodes if not n.prerequisites]
        if roots:
            return roots
        return [self._nodes[0].concept_slug] if self._nodes else []

    def ancestors_of(self, concept_slug: str) -> list[str]:
        """Return all transitive prerequisite ancestors of concept_slug."""
        ancestors: list[str] = []
        visited: set[str] = set()
        stack = list(self._by_slug[concept_slug].prerequisites) if concept_slug in self._by_slug else []
        while stack:
            curr = stack.pop()
            if curr in visited or curr not in self._by_slug:
                continue
            visited.add(curr)
            ancestors.append(curr)
            stack.extend(self._by_slug[curr].prerequisites)
        return ancestors

    def evaluate_step(
        self,
        *,
        concept_slug: str,
        passed: bool,
        queue: list[str],
        visited: list[str],
        passed_slugs: set[str],
        failed_slugs: set[str],
    ) -> tuple[list[PlacementNodeInit], list[str]]:
        """Return (node_inits_to_apply, updated_queue) enforcing Branch Ceiling & Transitive Promotion."""
        node = self._by_slug.get(concept_slug)
        tier = node.tier if node is not None else 1
        primary = build_placement_node_init(concept_slug, tier, passed)
        inits: list[PlacementNodeInit] = [primary]
        new_queue = list(queue)

        if not passed:
            failed_slugs.add(concept_slug)
            # Strict Branch Ceiling: prune any queued descendants of the failed node
            blocked: set[str] = {concept_slug}
            changed = True
            while changed:
                changed = False
                for cand in self._nodes:
                    if cand.concept_slug not in blocked and any(p in blocked for p in cand.prerequisites):
                        blocked.add(cand.concept_slug)
                        changed = True
            new_queue = [s for s in new_queue if s not in blocked]
            return inits, new_queue

        passed_slugs.add(concept_slug)
        # Transitive Prerequisite Promotion: passing a Tier k+1 node confirms its prerequisites at 0.75
        for anc_slug in self.ancestors_of(concept_slug):
            if anc_slug not in failed_slugs and anc_slug not in passed_slugs:
                passed_slugs.add(anc_slug)
                anc_node = self._by_slug[anc_slug]
                inits.append(build_placement_node_init(anc_slug, anc_node.tier, passed=True))

        # Enqueue direct children whose prerequisites have not failed
        for cand in self._nodes:
            if (
                concept_slug in cand.prerequisites
                and cand.concept_slug not in visited
                and cand.concept_slug not in new_queue
                and not any(p in failed_slugs for p in cand.prerequisites)
            ):
                new_queue.append(cand.concept_slug)

        return inits, new_queue
