"""Multi-Domain Student Simulator with 8-dim Node Features, 4 Modes, Ebbinghaus & Zero-shot Graph."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

import gymnasium as gym
import numpy as np
from gymnasium import spaces

MAX_NODES_PAD: int = 16
NODE_FEAT_DIM: int = 8
NUM_MODES: int = 4  # 0=Learn_New, 1=Deep_Probe, 2=Code_Practice, 3=Spaced_Review
COGNITIVE_COSTS: tuple[float, float, float, float] = (0.15, 0.30, 0.35, 0.10)


@dataclass(frozen=True)
class DomainNodeSpec:
    """Single node inside a domain DAG."""

    node_idx: int
    slug: str
    tier: int
    prerequisites: tuple[int, ...]
    is_shared: bool = False


@dataclass(frozen=True)
class DomainGraphSpec:
    """Immutable domain DAG specification."""

    slug: str
    nodes: tuple[DomainNodeSpec, ...]


DOMAIN_GRAPHS: dict[str, DomainGraphSpec] = {
    "backend": DomainGraphSpec(
        slug="backend",
        nodes=(
            DomainNodeSpec(0, "net-internet", 1, (), True),
            DomainNodeSpec(1, "os-basics", 1, (), True),
            DomainNodeSpec(2, "web-http", 2, (0,), True),
            DomainNodeSpec(3, "db-relational", 2, (1,), False),
            DomainNodeSpec(4, "db-transactions", 2, (3,), False),
            DomainNodeSpec(5, "db-nosql", 2, (3,), False),
            DomainNodeSpec(6, "api-rest", 3, (2,), True),
            DomainNodeSpec(7, "api-validation", 3, (6,), False),
            DomainNodeSpec(8, "api-data", 3, (4, 6), False),
            DomainNodeSpec(9, "cache-redis", 3, (5, 6), True),
            DomainNodeSpec(10, "sec-authn", 4, (6, 9), True),
            DomainNodeSpec(11, "sec-api", 4, (7, 8, 10), True),
        ),
    ),
    "frontend": DomainGraphSpec(
        slug="frontend",
        nodes=(
            DomainNodeSpec(0, "net-internet", 1, (), True),
            DomainNodeSpec(1, "fe-dom-events", 1, (), False),
            DomainNodeSpec(2, "web-http", 2, (0,), True),
            DomainNodeSpec(3, "fe-js-async", 2, (1,), False),
            DomainNodeSpec(4, "fe-component-state", 2, (1,), False),
            DomainNodeSpec(5, "api-rest", 3, (2,), True),
            DomainNodeSpec(6, "fe-data-fetching", 3, (3, 4, 5), False),
            DomainNodeSpec(7, "sec-authn", 4, (5,), True),
            DomainNodeSpec(8, "fe-xss-csrf", 4, (4, 7), False),
            DomainNodeSpec(9, "fe-perf-caching", 4, (6,), False),
        ),
    ),
    "devops": DomainGraphSpec(
        slug="devops",
        nodes=(
            DomainNodeSpec(0, "os-basics", 1, (), True),
            DomainNodeSpec(1, "net-internet", 1, (), True),
            DomainNodeSpec(2, "web-http", 2, (1,), True),
            DomainNodeSpec(3, "docker-containers", 2, (0, 1), False),
            DomainNodeSpec(4, "reverse-proxy-caching", 3, (2, 3), False),
            DomainNodeSpec(5, "cache-redis", 3, (3, 2), True),
            DomainNodeSpec(6, "ci-cd-pipelines", 3, (3,), False),
            DomainNodeSpec(7, "k8s-orchestration", 4, (4, 6, 5), False),
            DomainNodeSpec(8, "sec-api", 4, (4, 7), True),
        ),
    ),
    "heldout_data_eng_graph": DomainGraphSpec(
        slug="heldout_data_eng_graph",
        nodes=(
            DomainNodeSpec(0, "os-basics", 1, (), True),
            DomainNodeSpec(1, "db-relational", 1, (), True),
            DomainNodeSpec(2, "db-transactions", 2, (1,), True),
            DomainNodeSpec(3, "db-nosql", 2, (1,), True),
            DomainNodeSpec(4, "de-batch-etl", 2, (1, 0), False),
            DomainNodeSpec(5, "de-columnar-storage", 3, (4, 3), False),
            DomainNodeSpec(6, "de-data-warehouse", 3, (2, 4), False),
            DomainNodeSpec(7, "de-stream-kafka", 3, (0, 3), False),
            DomainNodeSpec(8, "de-spark-distributed", 4, (5, 6, 7), False),
            DomainNodeSpec(9, "de-data-quality-lineage", 4, (6, 8), False),
        ),
    ),
}

TRAIN_DOMAINS: tuple[str, ...] = ("backend", "frontend", "devops")


def build_normalized_adjacencies(graph: DomainGraphSpec) -> tuple[np.ndarray, np.ndarray]:
    """Build degree-normalized incoming (prereq->node) and outgoing (node->dep) matrices."""
    n = len(graph.nodes)
    a_in = np.zeros((n, n), dtype=np.float32)
    a_out = np.zeros((n, n), dtype=np.float32)
    for node in graph.nodes:
        for p in node.prerequisites:
            a_in[node.node_idx, p] = 1.0
            a_out[p, node.node_idx] = 1.0

    def _row_norm(mat: np.ndarray) -> np.ndarray:
        deg = mat.sum(axis=1, keepdims=True)
        safe_deg = np.where(deg > 0.0, deg, 1.0)
        return (mat / safe_deg).astype(np.float32)

    return _row_norm(a_in), _row_norm(a_out)


class MultiDomainStudentSimulatorEnv(gym.Env[Any, Any]):
    """Domain-agnostic Student Simulator with 8-dim node features & Ebbinghaus decay."""

    def __init__(
        self,
        domain_slug: str | None = "backend",
        seed: int | None = None,
        max_steps: int = 60,
    ) -> None:
        super().__init__()
        self.metadata = {"render_modes": []}
        self.fixed_domain_slug = domain_slug
        self.max_steps = max_steps
        self._rng = np.random.default_rng(seed)

        self.observation_space = spaces.Dict(
            {
                "node_features": spaces.Box(
                    low=0.0, high=1.0, shape=(MAX_NODES_PAD, NODE_FEAT_DIM), dtype=np.float32
                ),
                "adj_in": spaces.Box(
                    low=0.0, high=1.0, shape=(MAX_NODES_PAD, MAX_NODES_PAD), dtype=np.float32
                ),
                "adj_out": spaces.Box(
                    low=0.0, high=1.0, shape=(MAX_NODES_PAD, MAX_NODES_PAD), dtype=np.float32
                ),
            }
        )
        self.action_space = spaces.MultiDiscrete([MAX_NODES_PAD, NUM_MODES])

        # Episode state
        self.graph: DomainGraphSpec = DOMAIN_GRAPHS[domain_slug or "backend"]
        self._adj_in, self._adj_out = build_normalized_adjacencies(self.graph)
        self._n_nodes = len(self.graph.nodes)
        self._depth = np.zeros(self._n_nodes, dtype=np.float32)
        self._confidence = np.zeros(self._n_nodes, dtype=np.float32)
        self._stability = np.full(self._n_nodes, 3.0, dtype=np.float32)
        self._dt = np.zeros(self._n_nodes, dtype=np.float32)
        self._code_score = np.zeros(self._n_nodes, dtype=np.float32)
        self._step_count = 0

        # Hidden learner parameters (never leaked into observation)
        self._alpha = 0.55
        self._lambda_forget = 1.0
        self._beta_code = 0.55

    def _compute_retention_vec(self) -> np.ndarray:
        ret = np.ones(self._n_nodes, dtype=np.float32)
        for i in range(self._n_nodes):
            if self._depth[i] >= 0.25:
                s_eff = max(1.5, float(self._stability[i]) / self._lambda_forget)
                ret[i] = float(math.exp(-float(self._dt[i]) / s_eff))
        return ret

    def _compute_eligible_vec(self) -> np.ndarray:
        elig = np.zeros(self._n_nodes, dtype=np.float32)
        for node in self.graph.nodes:
            if all(self._depth[p] >= 0.75 for p in node.prerequisites):
                elig[node.node_idx] = 1.0
        return elig

    def _get_obs(self) -> dict[str, np.ndarray]:
        ret = self._compute_retention_vec()
        elig = self._compute_eligible_vec()
        feats = np.zeros((self._n_nodes, NODE_FEAT_DIM), dtype=np.float32)
        for node in self.graph.nodes:
            i = node.node_idx
            needs_rev = 1.0 if (self._depth[i] >= 0.50 and ret[i] < 0.60) else 0.0
            feats[i, 0] = float(self._depth[i])
            feats[i, 1] = float(self._confidence[i])
            feats[i, 2] = float(ret[i])
            feats[i, 3] = float(elig[i])
            feats[i, 4] = needs_rev
            feats[i, 5] = float(node.tier) / 4.0
            feats[i, 6] = float(self._code_score[i])
            feats[i, 7] = 1.0
        return {
            "node_features": np.clip(feats, 0.0, 1.0),
            "adj_in": self._adj_in,
            "adj_out": self._adj_out,
        }

    def get_action_mask(self) -> np.ndarray:
        """Return boolean mask of shape (N, 4) for Policy Guardrail / Masked PPO."""
        elig = self._compute_eligible_vec()
        mask = np.zeros((self._n_nodes, NUM_MODES), dtype=bool)
        for i in range(self._n_nodes):
            if elig[i] > 0.5:
                mask[i, :] = True
        return mask

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[dict[str, np.ndarray], dict[str, Any]]:
        super().reset(seed=seed)
        if seed is not None:
            self._rng = np.random.default_rng(seed)

        slug = self.fixed_domain_slug
        if options and "domain_slug" in options:
            slug = str(options["domain_slug"])
        if slug is None:
            slug = str(self._rng.choice(TRAIN_DOMAINS))

        self.graph = DOMAIN_GRAPHS[slug]
        self._adj_in, self._adj_out = build_normalized_adjacencies(self.graph)
        self._n_nodes = len(self.graph.nodes)
        self._depth = np.zeros(self._n_nodes, dtype=np.float32)
        self._confidence = np.zeros(self._n_nodes, dtype=np.float32)
        self._stability = np.full(self._n_nodes, 3.0, dtype=np.float32)
        self._dt = np.zeros(self._n_nodes, dtype=np.float32)
        self._code_score = np.zeros(self._n_nodes, dtype=np.float32)
        self._step_count = 0

        self._alpha = float(self._rng.uniform(0.35, 0.75))
        self._lambda_forget = float(self._rng.uniform(0.80, 1.20))
        self._beta_code = float(self._rng.uniform(0.35, 0.80))

        return self._get_obs(), {"domain_slug": slug, "n_nodes": self._n_nodes}

    def step(
        self,
        action: tuple[int, int],
    ) -> tuple[dict[str, np.ndarray], float, bool, bool, dict[str, Any]]:
        v, m = int(action[0]), int(action[1])
        self._step_count += 1

        # Advance time dt = 1.0 day on all previously learned nodes u != v
        for u in range(self._n_nodes):
            if u != v and self._depth[u] >= 0.25:
                self._dt[u] += 1.0

        if v < 0 or v >= self._n_nodes or m < 0 or m >= NUM_MODES:
            truncated = self._step_count >= self.max_steps
            return (
                self._get_obs(),
                -5.0,
                False,
                truncated,
                {"prerequisite_violation": True, "redundant_action": False, "invalid_pad": True},
            )

        elig = self._compute_eligible_vec()
        if elig[v] < 0.5:
            truncated = self._step_count >= self.max_steps
            return (
                self._get_obs(),
                -5.0,
                False,
                truncated,
                {"prerequisite_violation": True, "redundant_action": False, "invalid_pad": False},
            )

        ret_before_vec = self._compute_retention_vec()
        ret_before = float(ret_before_vec[v])

        # Check redundant action
        if (
            (m == 0 and self._depth[v] >= 0.50)
            or (m == 1 and self._depth[v] >= 1.0 and ret_before >= 0.85)
            or (m == 2 and self._code_score[v] >= 1.0 and self._depth[v] >= 1.0)
            or (m == 3 and ret_before >= 0.85)
        ):
            truncated = self._step_count >= self.max_steps
            return (
                self._get_obs(),
                -3.0,
                False,
                truncated,
                {"prerequisite_violation": False, "redundant_action": True, "invalid_pad": False},
            )

        node = self.graph.nodes[v]
        tier_diff = float(node.tier) / 4.0
        prereq_mean = (
            float(np.mean([self._depth[p] for p in node.prerequisites]))
            if node.prerequisites
            else 1.0
        )

        depth_old = float(self._depth[v])
        code_old = float(self._code_score[v])

        if m == 2:
            p_pass = min(0.95, max(0.35, 0.45 + 0.45 * self._beta_code - 0.15 * tier_diff))
        else:
            p_pass = min(
                0.96,
                max(0.40, 0.45 + 0.40 * self._alpha * (1.0 - 0.4 * tier_diff) + 0.12 * prereq_mean),
            )
        passed = bool(self._rng.random() < p_pass)
        score = float(self._rng.uniform(0.75, 1.0)) if passed else float(self._rng.uniform(0.25, 0.60))

        if passed:
            self._dt[v] = 0.0
            if m == 0:  # Learn_New -> up to Applied (0.50)
                self._depth[v] = max(self._depth[v], 0.50)
                self._confidence[v] = max(self._confidence[v], 0.75)
            elif m == 1:  # Deep_Probe -> Deep (0.75) or Mastery (1.00)
                target = 1.00 if self._depth[v] >= 0.75 else 0.75
                self._depth[v] = max(self._depth[v], target)
                self._confidence[v] = max(self._confidence[v], 0.95 if target >= 1.0 else 0.85)
                self._stability[v] = min(60.0, float(self._stability[v]) * (1.0 + 0.8 * score))
            elif m == 2:  # Code_Practice -> elevates code_score and depth >= 0.75 (or 1.00)
                self._code_score[v] = max(self._code_score[v], 1.0)
                target = 1.00 if self._depth[v] >= 0.75 else 0.75
                self._depth[v] = max(self._depth[v], target)
                self._confidence[v] = max(self._confidence[v], 0.95 if target >= 1.0 else 0.85)
                self._stability[v] = min(60.0, float(self._stability[v]) * (1.0 + 0.8 * score))
            elif m == 3:  # Spaced_Review
                self._stability[v] = min(60.0, float(self._stability[v]) * (1.0 + 0.8 * score))
        else:
            if self._depth[v] >= 0.50:
                self._stability[v] = max(1.5, 0.7 * float(self._stability[v]))

        delta_depth = max(0.0, float(self._depth[v]) - depth_old)
        delta_code = max(0.0, float(self._code_score[v]) - code_old)
        delta_ret_rec = (1.0 - ret_before) if (ret_before < 0.60 and passed) else 0.0

        ret_after_vec = self._compute_retention_vec()
        goal_mastered = bool(
            np.all(self._depth >= 0.75) and np.all(ret_after_vec >= 0.60)
        )

        reward = (
            -0.4
            + 5.0 * delta_depth
            + 3.0 * delta_ret_rec
            + 2.5 * delta_code
            - COGNITIVE_COSTS[m]
            + (15.0 if goal_mastered else 0.0)
        )
        terminated = goal_mastered
        truncated = (not terminated) and (self._step_count >= self.max_steps)

        return (
            self._get_obs(),
            float(reward),
            terminated,
            truncated,
            {
                "prerequisite_violation": False,
                "redundant_action": False,
                "invalid_pad": False,
                "passed": passed,
                "goal_mastered": goal_mastered,
            },
        )


class PaddedFlatEnvWrapper(gym.Env[Any, Any]):
    """Padded N_max=16 flat wrapper (128-dim obs, Discrete(64)) for DQN-MLP & PPO-MLP."""

    def __init__(self, inner_env: MultiDomainStudentSimulatorEnv) -> None:
        super().__init__()
        self.inner_env = inner_env
        self.observation_space = spaces.Box(
            low=0.0,
            high=1.0,
            shape=(MAX_NODES_PAD * NODE_FEAT_DIM,),
            dtype=np.float32,
        )
        self.action_space = spaces.Discrete(MAX_NODES_PAD * NUM_MODES)

    def _pad_obs(self, obs: dict[str, np.ndarray]) -> np.ndarray:
        x = obs["node_features"]
        padded = np.zeros((MAX_NODES_PAD, NODE_FEAT_DIM), dtype=np.float32)
        n = min(x.shape[0], MAX_NODES_PAD)
        padded[:n] = x[:n]
        return padded.reshape(-1)

    def reset(
        self,
        *,
        seed: int | None = None,
        options: dict[str, Any] | None = None,
    ) -> tuple[np.ndarray, dict[str, Any]]:
        obs, info = self.inner_env.reset(seed=seed, options=options)
        return self._pad_obs(obs), info

    def step(self, action: int) -> tuple[np.ndarray, float, bool, bool, dict[str, Any]]:
        v = int(action) // NUM_MODES
        m = int(action) % NUM_MODES
        obs, reward, terminated, truncated, info = self.inner_env.step((v, m))
        return self._pad_obs(obs), reward, terminated, truncated, info
