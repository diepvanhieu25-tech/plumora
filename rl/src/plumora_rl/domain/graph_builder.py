"""Single Source of Truth for building (N, 8) node features & row-degree normalized adjacencies."""

from __future__ import annotations

from collections import deque
from collections.abc import Sequence
from datetime import datetime

import numpy as np

from plumora_rl.domain.ebbinghaus import EbbinghausMemoryModel
from plumora_rl.domain.specs import (
    NODE_FEAT_DIM,
    PASS_DEPTH_THRESHOLD,
    GraphEdgeInput,
    GraphObservation,
    NodeCompetencyInput,
    NodeFeatureIdx,
)


def normalize_adjacency_rows(mat: np.ndarray) -> np.ndarray:
    """Row-degree normalize adjacency matrix: D^-1 A (float32)."""
    mat_f32 = mat.astype(np.float32, copy=False)
    deg = mat_f32.sum(axis=1, keepdims=True)
    safe_deg = np.where(deg > 0.0, deg, 1.0)
    return (mat_f32 / safe_deg).astype(np.float32)


def compute_goal_path_mask(
    n_nodes: int,
    prereqs_by_idx: Sequence[Sequence[int]],
    depths: np.ndarray,
    tiers: Sequence[int],
) -> np.ndarray:
    """Compute reverse-BFS `is_goal_path` mask from unmastered leaf / highest-tier nodes.

    A node lies on the goal path if it is an unmastered target (leaf node or Tier-4 node
    with depth < 0.75) OR an ancestor of any such unmastered target.
    If all targets are already mastered (depth >= 0.75), mark any remaining node with
    depth < 1.0 (and its ancestors), or all nodes if everything is 1.0.
    """
    if n_nodes == 0:
        return np.zeros(0, dtype=np.float32)

    out_degree = [0] * n_nodes
    for idx in range(n_nodes):
        for p in prereqs_by_idx[idx]:
            if 0 <= p < n_nodes:
                out_degree[p] += 1

    max_tier = max(tiers) if tiers else 4
    seeds = [
        i
        for i in range(n_nodes)
        if float(depths[i]) < PASS_DEPTH_THRESHOLD and (out_degree[i] == 0 or tiers[i] >= max_tier)
    ]
    if not seeds:
        seeds = [i for i in range(n_nodes) if float(depths[i]) < PASS_DEPTH_THRESHOLD]
    if not seeds:
        seeds = [i for i in range(n_nodes) if float(depths[i]) < 1.0]
    if not seeds:
        return np.ones(n_nodes, dtype=np.float32)

    visited = np.zeros(n_nodes, dtype=np.float32)
    queue: deque[int] = deque(seeds)
    for s in seeds:
        visited[s] = 1.0

    while queue:
        curr = queue.popleft()
        for p in prereqs_by_idx[curr]:
            if 0 <= p < n_nodes and visited[p] < 0.5:
                visited[p] = 1.0
                queue.append(p)

    return visited


class GraphObservationBuilder:
    """Builds canonical GraphObservation (node_features, adj_in, adj_out, has_code_challenge)."""

    @staticmethod
    def build_normalized_adjacencies_from_indices(
        n_nodes: int,
        prereqs_by_idx: Sequence[Sequence[int]],
    ) -> tuple[np.ndarray, np.ndarray]:
        """Build row-degree normalized (adj_in, adj_out) from integer prerequisite lists."""
        a_in = np.zeros((n_nodes, n_nodes), dtype=np.float32)
        a_out = np.zeros((n_nodes, n_nodes), dtype=np.float32)
        for idx, prereqs in enumerate(prereqs_by_idx):
            for p in prereqs:
                if 0 <= p < n_nodes:
                    a_in[idx, p] = 1.0
                    a_out[p, idx] = 1.0
        return normalize_adjacency_rows(a_in), normalize_adjacency_rows(a_out)

    @staticmethod
    def build(
        nodes: Sequence[NodeCompetencyInput],
        *,
        extra_edges: Sequence[GraphEdgeInput] = (),
        now: datetime | None = None,
        simulated_time_offset_days: float = 0.0,
    ) -> GraphObservation:
        """Build a canonical GraphObservation from domain-agnostic node inputs."""
        ordered = sorted(nodes, key=lambda item: item.node_idx)
        n_nodes = len(ordered)
        node_order = tuple(n.concept_slug for n in ordered)
        slug_to_idx = {slug: i for i, slug in enumerate(node_order)}

        prereqs_by_idx: list[list[int]] = [[] for _ in range(n_nodes)]
        for i, n in enumerate(ordered):
            for p_slug in n.prerequisites:
                p_idx = slug_to_idx.get(p_slug)
                if p_idx is not None and p_idx not in prereqs_by_idx[i]:
                    prereqs_by_idx[i].append(p_idx)
        for edge in extra_edges:
            p_idx = slug_to_idx.get(edge.prereq_slug)
            c_idx = slug_to_idx.get(edge.concept_slug)
            if p_idx is not None and c_idx is not None and p_idx not in prereqs_by_idx[c_idx]:
                prereqs_by_idx[c_idx].append(p_idx)

        adj_in, adj_out = GraphObservationBuilder.build_normalized_adjacencies_from_indices(
            n_nodes, prereqs_by_idx
        )

        depths = np.array([float(n.depth_level_norm) for n in ordered], dtype=np.float32)
        tiers = [int(n.tier) for n in ordered]
        goal_path = compute_goal_path_mask(n_nodes, prereqs_by_idx, depths, tiers)

        feats = np.zeros((n_nodes, NODE_FEAT_DIM), dtype=np.float32)
        has_code = np.zeros(n_nodes, dtype=bool)

        for i, n in enumerate(ordered):
            depth = float(n.depth_level_norm)
            if n.retention_override is not None:
                ret = max(1e-6, min(1.0, float(n.retention_override)))
            elif (
                depth >= EbbinghausMemoryModel.MIN_DEPTH_FOR_RETENTION
                and n.last_practiced_at is not None
            ):
                elapsed = EbbinghausMemoryModel.compute_elapsed_days(
                    n.last_practiced_at,
                    simulated_time_offset_days=simulated_time_offset_days,
                    now=now,
                )
                ret = EbbinghausMemoryModel.compute_retention(elapsed, n.stability_s)
            else:
                ret = 1.0

            eligible = all(float(depths[p]) >= PASS_DEPTH_THRESHOLD for p in prereqs_by_idx[i])
            needs_rev = EbbinghausMemoryModel.is_review_needed(depth, ret)

            feats[i, NodeFeatureIdx.DEPTH_NORM] = depth
            feats[i, NodeFeatureIdx.CONFIDENCE] = float(n.confidence)
            feats[i, NodeFeatureIdx.RETENTION] = ret
            feats[i, NodeFeatureIdx.IS_ELIGIBLE] = 1.0 if eligible else 0.0
            feats[i, NodeFeatureIdx.NEEDS_REVIEW] = 1.0 if needs_rev else 0.0
            feats[i, NodeFeatureIdx.TIER_DIFFICULTY] = float(n.tier) / 4.0
            feats[i, NodeFeatureIdx.CODE_SCORE] = float(n.code_practice_score)
            feats[i, NodeFeatureIdx.IS_GOAL_PATH] = float(goal_path[i])
            has_code[i] = bool(n.has_code_challenge)

        return GraphObservation(
            node_order=node_order,
            node_features=np.clip(feats, 0.0, 1.0),
            adj_in=adj_in,
            adj_out=adj_out,
            has_code_challenge=has_code,
        )
