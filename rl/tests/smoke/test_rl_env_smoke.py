"""Environment smoke tests for plumora-rl package and 12-concept DAG (ENV-01)."""

from __future__ import annotations

import gymnasium as gym
import numpy as np
import stable_baselines3 as sb3
import torch

from plumora_rl.config import ACT_DIM, CONCEPTS_DAG, OBS_DIM
from plumora_rl.simulator import StudentSimulatorEnv


def test_rl_dependencies_and_dag_contract_smoke() -> None:
    """Verify Gymnasium, Stable-Baselines3, PyTorch CPU, and 12-node acyclic DAG."""
    assert gym.__version__ is not None
    assert sb3.__version__ is not None
    assert torch.__version__ is not None
    assert len(CONCEPTS_DAG) == ACT_DIM == 12

    env = StudentSimulatorEnv()
    assert env.observation_space.shape == (OBS_DIM,)
    assert env.observation_space.dtype == np.float32
    assert isinstance(env.action_space, gym.spaces.Discrete)
    assert int(env.action_space.n) == 12

    for node in CONCEPTS_DAG:
        for prereq_id in node.prerequisites:
            assert 0 <= prereq_id < node.action_id
            assert CONCEPTS_DAG[prereq_id].tier <= node.tier
