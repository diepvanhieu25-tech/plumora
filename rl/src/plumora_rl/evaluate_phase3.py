"""Phase 3 4-Way RL Training & Evaluation CLI (Heuristics vs DQN-MLP vs PPO-MLP vs GNN-PPO)."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import torch
from stable_baselines3 import DQN, PPO

from plumora_rl.config import EVAL_EPISODES, EVAL_SEED, TRAIN_SEEDS, VAL_SEED
from plumora_rl.domain import (
    NUM_MODES,
    LearningMode,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.gnn_ppo import (
    GnnActorCritic,
    export_gnn_ppo_checkpoint,
    train_gnn_ppo_on_seed,
)
from plumora_rl.multidomain_sim import (
    TRAIN_DOMAINS,
    MultiDomainStudentSimulatorEnv,
    PaddedFlatEnvWrapper,
)

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"


def _heuristic_b1_tier_action(obs: dict[str, np.ndarray]) -> tuple[int, int]:
    """B1: Prioritize Needs Review, then lowest-tier eligible incomplete node."""
    feats = obs["node_features"]
    n = feats.shape[0]
    for i in range(n):
        if feats[i, NodeFeatureIdx.NEEDS_REVIEW] > 0.5:
            return (i, int(LearningMode.SPACED_REVIEW))
    eligible = [
        i
        for i in range(n)
        if feats[i, NodeFeatureIdx.IS_ELIGIBLE] > 0.5 and feats[i, NodeFeatureIdx.DEPTH_NORM] < 0.75
    ]
    if eligible:
        best = min(
            eligible,
            key=lambda idx: (
                feats[idx, NodeFeatureIdx.TIER_DIFFICULTY],
                feats[idx, NodeFeatureIdx.DEPTH_NORM],
            ),
        )
        mode = (
            int(LearningMode.DEEP_PROBE)
            if feats[best, NodeFeatureIdx.DEPTH_NORM] >= 0.50
            else int(LearningMode.LEARN_NEW)
        )
        return (best, mode)
    return (0, int(LearningMode.DEEP_PROBE))


def _heuristic_b2_random_action(
    obs: dict[str, np.ndarray],
    rng: np.random.Generator,
) -> tuple[int, int]:
    """B2: Random eligible node and mode (with Spaced_Review if needed)."""
    feats = obs["node_features"]
    n = feats.shape[0]
    eligible = [i for i in range(n) if feats[i, NodeFeatureIdx.IS_ELIGIBLE] > 0.5]
    if not eligible:
        return (0, int(LearningMode.LEARN_NEW))
    v = int(rng.choice(eligible))
    if feats[v, NodeFeatureIdx.NEEDS_REVIEW] > 0.5:
        return (v, int(LearningMode.SPACED_REVIEW))
    m = int(rng.integers(0, 3))
    return (v, m)


def _heuristic_b3_greedy_action(obs: dict[str, np.ndarray]) -> tuple[int, int]:
    """B3: Prioritize Spaced Review, then complete active node to >=0.75 via Deep/Code."""
    feats = obs["node_features"]
    n = feats.shape[0]
    for i in range(n):
        if feats[i, NodeFeatureIdx.NEEDS_REVIEW] > 0.5:
            return (i, int(LearningMode.SPACED_REVIEW))
    eligible_incomplete = [
        i
        for i in range(n)
        if feats[i, NodeFeatureIdx.IS_ELIGIBLE] > 0.5 and feats[i, NodeFeatureIdx.DEPTH_NORM] < 0.75
    ]
    if eligible_incomplete:
        best = max(
            eligible_incomplete,
            key=lambda idx: (
                feats[idx, NodeFeatureIdx.DEPTH_NORM],
                -feats[idx, NodeFeatureIdx.TIER_DIFFICULTY],
            ),
        )
        if feats[best, NodeFeatureIdx.DEPTH_NORM] >= 0.50:
            return (best, int(LearningMode.CODE_PRACTICE))
        return (best, int(LearningMode.LEARN_NEW))
    return (0, int(LearningMode.SPACED_REVIEW))


def _summarize_episodes(
    rewards: list[float], invalid_steps: int, total_steps: int, completed: int
) -> dict[str, Any]:
    arr = np.array(rewards, dtype=np.float64)
    q75, q25 = np.percentile(arr, [75, 25])
    return {
        "episodes": len(rewards),
        "mean_reward": round(float(arr.mean()), 4),
        "std_reward": round(float(arr.std()), 4),
        "median_reward": round(float(np.median(arr)), 4),
        "iqr_reward": round(float(q75 - q25), 4),
        "invalid_action_rate": round(invalid_steps / max(1, total_steps), 6),
        "masked_violation_rate": 0.0,
        "completion_rate": round(completed / max(1, len(rewards)), 4),
    }


def apply_policy_guardrail(
    env: MultiDomainStudentSimulatorEnv,
    obs: dict[str, np.ndarray],
    raw_logits: np.ndarray,
) -> tuple[int, int]:
    """Shared Policy Guardrail used identically across DQN-MLP, PPO-MLP, and GNN-PPO masked branches."""
    _ = env
    decision = PolicyGuardrailStrategy.select_action(raw_logits, obs["node_features"])
    return (decision.node_idx, int(decision.mode))


def evaluate_policy(
    policy_name: str,
    domains: tuple[str, ...],
    eval_seed: int,
    episodes: int,
    *,
    gnn_model: GnnActorCritic | None = None,
    sb3_model: Any = None,
    masked: bool = False,
) -> dict[str, Any]:
    """Evaluate a policy deterministically across given domains for `episodes` episodes."""
    env = MultiDomainStudentSimulatorEnv(domain_slug=None, seed=eval_seed, max_steps=60)
    rng = np.random.default_rng(eval_seed)
    ep_rewards: list[float] = []
    invalid_steps = 0
    total_steps = 0
    completed = 0

    for ep in range(episodes):
        d_slug = domains[ep % len(domains)]
        obs, _ = env.reset(seed=eval_seed + ep, options={"domain_slug": d_slug})
        done = False
        ep_rew = 0.0
        n_nodes = obs["node_features"].shape[0]

        while not done:
            if policy_name == "heuristic_b1":
                action = _heuristic_b1_tier_action(obs)
            elif policy_name == "heuristic_b2":
                action = _heuristic_b2_random_action(obs, rng)
            elif policy_name == "heuristic_b3":
                action = _heuristic_b3_greedy_action(obs)
            elif policy_name in ("dqn_mlp", "ppo_mlp"):
                padded = np.zeros((16, 8), dtype=np.float32)
                padded[:n_nodes] = obs["node_features"]
                flat_obs = padded.reshape(-1)
                if masked:
                    if hasattr(sb3_model, "policy"):
                        obs_t, _ = sb3_model.policy.obs_to_tensor(flat_obs)
                        with torch.no_grad():
                            if policy_name == "dqn_mlp":
                                q_vals = sb3_model.q_net(obs_t).cpu().numpy().reshape(-1)[: n_nodes * NUM_MODES]
                                raw_logits = q_vals.reshape(n_nodes, NUM_MODES)
                            else:
                                dist = sb3_model.policy.get_distribution(obs_t)
                                raw_logits = dist.distribution.logits.cpu().numpy().reshape(-1)[: n_nodes * NUM_MODES].reshape(n_nodes, NUM_MODES)
                        action = apply_policy_guardrail(env, obs, raw_logits)
                    else:
                        act_raw, _ = sb3_model.predict(flat_obs, deterministic=True)
                        act_int = int(act_raw)
                        action = (act_int // NUM_MODES, act_int % NUM_MODES)
                else:
                    act_raw, _ = sb3_model.predict(flat_obs, deterministic=True)
                    act_int = int(act_raw)
                    action = (act_int // NUM_MODES, act_int % NUM_MODES)
            else:
                assert gnn_model is not None
                with torch.no_grad():
                    logits, _ = gnn_model(
                        torch.from_numpy(obs["node_features"]),
                        torch.from_numpy(obs["adj_in"]),
                        torch.from_numpy(obs["adj_out"]),
                    )
                    if masked:
                        action = apply_policy_guardrail(env, obs, logits.cpu().numpy())
                    else:
                        act_idx = int(torch.argmax(logits.reshape(-1)).item())
                        action = (act_idx // NUM_MODES, act_idx % NUM_MODES)

            obs, rew, term, trunc, info = env.step(action)
            total_steps += 1
            if info.get("prerequisite_violation") or info.get("invalid_pad"):
                invalid_steps += 1
            if term:
                completed += 1
            ep_rew += rew
            done = term or trunc

        ep_rewards.append(ep_rew)

    res = _summarize_episodes(ep_rewards, invalid_steps, total_steps, completed)
    if masked:
        res["masked_violation_rate"] = round(invalid_steps / max(1, total_steps), 6)
    return res


def run_training_and_evaluation(episodes: int = EVAL_EPISODES, eval_seed: int = EVAL_SEED) -> dict[str, Any]:
    """Train GNN-PPO across TRAIN_SEEDS, select best on VAL_SEED, train MLP baselines, and evaluate."""
    best_model: GnnActorCritic | None = None
    best_val_reward = -1e9
    best_seed = TRAIN_SEEDS[0]

    for s in TRAIN_SEEDS:
        candidate, _ = train_gnn_ppo_on_seed(seed=s, total_episodes=150)
        val_res = evaluate_policy(
            "gnn_ppo",
            TRAIN_DOMAINS,
            VAL_SEED,
            60,
            gnn_model=candidate,
            masked=True,
        )
        if val_res["mean_reward"] > best_val_reward:
            best_val_reward = val_res["mean_reward"]
            best_model = candidate
            best_seed = s

    assert best_model is not None

    # Train MLP baselines across TRAIN_SEEDS with equivalent seed selection budget on VAL_SEED
    best_dqn_mlp: DQN | None = None
    best_dqn_val = -1e9
    best_ppo_mlp: PPO | None = None
    best_ppo_val = -1e9
    for s in TRAIN_SEEDS:
        flat_env = PaddedFlatEnvWrapper(MultiDomainStudentSimulatorEnv(domain_slug=None, seed=s, max_steps=60))
        cand_dqn = DQN("MlpPolicy", flat_env, seed=s, verbose=0)
        cand_dqn.learn(total_timesteps=6000)
        dqn_val_res = evaluate_policy("dqn_mlp", TRAIN_DOMAINS, VAL_SEED, 60, sb3_model=cand_dqn, masked=True)
        if dqn_val_res["mean_reward"] > best_dqn_val:
            best_dqn_val = dqn_val_res["mean_reward"]
            best_dqn_mlp = cand_dqn

        cand_ppo = PPO("MlpPolicy", flat_env, seed=s, verbose=0)
        cand_ppo.learn(total_timesteps=6000)
        ppo_val_res = evaluate_policy("ppo_mlp", TRAIN_DOMAINS, VAL_SEED, 60, sb3_model=cand_ppo, masked=True)
        if ppo_val_res["mean_reward"] > best_ppo_val:
            best_ppo_val = ppo_val_res["mean_reward"]
            best_ppo_mlp = cand_ppo

    dqn_mlp = best_dqn_mlp
    ppo_mlp = best_ppo_mlp

    # Export GNN-PPO checkpoint
    ckpt_path = ARTIFACTS_DIR / "gnn_ppo_v2_base.zip"
    metadata = {
        "model_type": "GnnActorCritic",
        "selected_seed": best_seed,
        "train_seeds": list(TRAIN_SEEDS),
        "val_seed": VAL_SEED,
        "val_mean_reward": best_val_reward,
        "node_feat_dim": 8,
        "hidden_dim": 64,
        "num_modes": 4,
        "created_at": datetime.now(UTC).isoformat(),
    }
    sha256 = export_gnn_ppo_checkpoint(best_model, ckpt_path, metadata)

    manifest = {
        "checkpoint_file": "gnn_ppo_v2_base.zip",
        "checkpoint_sha256": sha256,
        "selected_seed": best_seed,
        "train_seeds": list(TRAIN_SEEDS),
        "val_seed": VAL_SEED,
        "eval_seed": eval_seed,
        "eval_episodes": episodes,
        "created_at": metadata["created_at"],
    }
    (ARTIFACTS_DIR / "manifest_phase3.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )

    scenario_a = {
        "heuristic_b1": evaluate_policy("heuristic_b1", TRAIN_DOMAINS, eval_seed, episodes),
        "heuristic_b2": evaluate_policy("heuristic_b2", TRAIN_DOMAINS, eval_seed, episodes),
        "heuristic_b3": evaluate_policy("heuristic_b3", TRAIN_DOMAINS, eval_seed, episodes),
        "dqn_mlp_unmasked": evaluate_policy("dqn_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=dqn_mlp, masked=False),
        "dqn_mlp_masked": evaluate_policy("dqn_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=dqn_mlp, masked=True),
        "ppo_mlp_unmasked": evaluate_policy("ppo_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=ppo_mlp, masked=False),
        "ppo_mlp_masked": evaluate_policy("ppo_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=ppo_mlp, masked=True),
        "gnn_ppo_unmasked": evaluate_policy("gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=best_model, masked=False),
        "gnn_ppo_masked": evaluate_policy("gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=best_model, masked=True),
    }

    heldout = ("heldout_data_eng_graph",)
    scenario_b = {
        "heuristic_b1": evaluate_policy("heuristic_b1", heldout, eval_seed, episodes),
        "heuristic_b2": evaluate_policy("heuristic_b2", heldout, eval_seed, episodes),
        "heuristic_b3": evaluate_policy("heuristic_b3", heldout, eval_seed, episodes),
        "dqn_mlp_unmasked": evaluate_policy("dqn_mlp", heldout, eval_seed, episodes, sb3_model=dqn_mlp, masked=False),
        "dqn_mlp_masked": evaluate_policy("dqn_mlp", heldout, eval_seed, episodes, sb3_model=dqn_mlp, masked=True),
        "ppo_mlp_unmasked": evaluate_policy("ppo_mlp", heldout, eval_seed, episodes, sb3_model=ppo_mlp, masked=False),
        "ppo_mlp_masked": evaluate_policy("ppo_mlp", heldout, eval_seed, episodes, sb3_model=ppo_mlp, masked=True),
        "gnn_ppo_unmasked": evaluate_policy("gnn_ppo", heldout, eval_seed, episodes, gnn_model=best_model, masked=False),
        "gnn_ppo_masked": evaluate_policy("gnn_ppo", heldout, eval_seed, episodes, gnn_model=best_model, masked=True),
    }

    report = {
        "eval_seed": eval_seed,
        "episodes": episodes,
        "checkpoint_sha256": sha256,
        "selected_seed": best_seed,
        "scenario_a_known_domains": scenario_a,
        "scenario_b_zero_shot_transfer": scenario_b,
    }
    (ARTIFACTS_DIR / "evaluation_phase3_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train & evaluate Phase 3 GNN-PPO.")
    parser.add_argument("--eval-seed", type=int, default=EVAL_SEED)
    parser.add_argument("--episodes", type=int, default=EVAL_EPISODES)
    args = parser.parse_args(argv)
    report = run_training_and_evaluation(episodes=args.episodes, eval_seed=args.eval_seed)
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
