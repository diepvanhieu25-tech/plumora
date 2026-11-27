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
TIMESTEPS_PER_SEED: int = 60_000
VAL_EPISODES_PHASE3: int = 200


def _heuristic_b1_tier_action(obs: dict[str, np.ndarray]) -> tuple[int, int]:
    """B1: Prioritize Needs Review, then lowest-tier eligible incomplete node respecting INV-SEQ-01."""
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
    """B2: Valid-Random over PolicyGuardrailStrategy valid action mask (D-08 / RL_PLAN)."""
    feats = obs["node_features"]
    needs_rev = [i for i in range(feats.shape[0]) if feats[i, NodeFeatureIdx.NEEDS_REVIEW] > 0.5]
    if needs_rev:
        v = int(rng.choice(needs_rev))
        return (v, int(LearningMode.SPACED_REVIEW))
    mask = PolicyGuardrailStrategy.compute_valid_action_mask(feats)
    mask[:, LearningMode.SPACED_REVIEW] = False
    valid_pairs = np.argwhere(mask)
    if len(valid_pairs) == 0:
        return (0, int(LearningMode.LEARN_NEW))
    chosen = valid_pairs[int(rng.integers(0, len(valid_pairs)))]
    return (int(chosen[0]), int(chosen[1]))


def _heuristic_b3_greedy_action(obs: dict[str, np.ndarray]) -> tuple[int, int]:
    """B3: Prioritize Spaced Review, then complete active node to >=0.75 respecting INV-SEQ-01 & INV-SEQ-02."""
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
        depth = float(feats[best, NodeFeatureIdx.DEPTH_NORM])
        code_sc = float(feats[best, NodeFeatureIdx.CODE_SCORE])
        if depth >= 0.50:
            if code_sc < 1.0:
                return (best, int(LearningMode.CODE_PRACTICE))
            return (best, int(LearningMode.DEEP_PROBE))
        return (best, int(LearningMode.LEARN_NEW))
    return (0, int(LearningMode.SPACED_REVIEW))


def _summarize_episodes(
    rewards: list[float],
    steps_list: list[int],
    invalid_steps: int,
    prereq_steps: int,
    redundant_steps: int,
    total_steps: int,
    completed: int,
) -> dict[str, Any]:
    arr = np.array(rewards, dtype=np.float64)
    q75, q25 = np.percentile(arr, [75, 25])
    steps_arr = np.array(steps_list, dtype=np.float64)
    sq75, sq25 = np.percentile(steps_arr, [75, 25])
    denom = max(1, total_steps)
    return {
        "episodes": len(rewards),
        "mean_reward": round(float(arr.mean()), 4),
        "std_reward": round(float(arr.std()), 4),
        "median_reward": round(float(np.median(arr)), 4),
        "iqr_reward": round(float(q75 - q25), 4),
        "steps_to_completion": round(float(steps_arr.mean()), 4),
        "std_steps_to_completion": round(float(steps_arr.std()), 4),
        "median_steps_to_completion": round(float(np.median(steps_arr)), 4),
        "iqr_steps_to_completion": round(float(sq75 - sq25), 4),
        "invalid_action_rate": round(invalid_steps / denom, 6),
        "prerequisite_violation_rate": round(prereq_steps / denom, 6),
        "redundant_action_rate": round(redundant_steps / denom, 6),
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
    ep_steps: list[int] = []
    invalid_steps = 0
    prereq_steps = 0
    redundant_steps = 0
    total_steps = 0
    completed = 0

    for ep in range(episodes):
        d_slug = domains[ep % len(domains)]
        obs, _ = env.reset(seed=eval_seed + ep, options={"domain_slug": d_slug})
        done = False
        ep_rew = 0.0
        steps_in_ep = 0
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
                                q_vals = (
                                    sb3_model.q_net(obs_t)
                                    .cpu()
                                    .numpy()
                                    .reshape(-1)[: n_nodes * NUM_MODES]
                                )
                                raw_logits = q_vals.reshape(n_nodes, NUM_MODES)
                            else:
                                dist = sb3_model.policy.get_distribution(obs_t)
                                raw_logits = (
                                    dist.distribution.logits.cpu()
                                    .numpy()
                                    .reshape(-1)[: n_nodes * NUM_MODES]
                                    .reshape(n_nodes, NUM_MODES)
                                )
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
            steps_in_ep += 1
            is_prereq = bool(info.get("prerequisite_violation") or info.get("invalid_pad"))
            is_redundant = bool(info.get("redundant_action"))
            if is_prereq:
                prereq_steps += 1
            if is_redundant:
                redundant_steps += 1
            if is_prereq or is_redundant:
                invalid_steps += 1
            if term:
                completed += 1
            ep_rew += rew
            done = term or trunc

        ep_rewards.append(ep_rew)
        ep_steps.append(steps_in_ep)

    res = _summarize_episodes(
        ep_rewards,
        ep_steps,
        invalid_steps,
        prereq_steps,
        redundant_steps,
        total_steps,
        completed,
    )
    if masked:
        res["masked_violation_rate"] = round(invalid_steps / max(1, total_steps), 6)
    return res


def run_training_and_evaluation(
    episodes: int = EVAL_EPISODES,
    eval_seed: int = EVAL_SEED,
    timesteps_per_seed: int = TIMESTEPS_PER_SEED,
) -> dict[str, Any]:
    """Train GNN-PPO, DQN-MLP, and PPO-MLP with identical timestep budgets across TRAIN_SEEDS & evaluate."""
    best_model: GnnActorCritic | None = None
    best_val_score = -1e9
    best_val_reward = -1e9
    best_seed = TRAIN_SEEDS[0]

    for s in TRAIN_SEEDS:
        candidate, _ = train_gnn_ppo_on_seed(seed=s, total_timesteps=timesteps_per_seed)
        val_masked = evaluate_policy(
            "gnn_ppo",
            TRAIN_DOMAINS,
            VAL_SEED,
            VAL_EPISODES_PHASE3,
            gnn_model=candidate,
            masked=True,
        )
        val_unmasked = evaluate_policy(
            "gnn_ppo",
            TRAIN_DOMAINS,
            VAL_SEED,
            VAL_EPISODES_PHASE3,
            gnn_model=candidate,
            masked=False,
        )
        # Prefer seeds satisfying unmasked invalid_action_rate < 0.05 on validation set (D-08 / RL_PLAN)
        safety_bonus = 1000.0 if val_unmasked["invalid_action_rate"] < 0.05 else 0.0
        val_score = safety_bonus + 0.5 * val_masked["mean_reward"] + 0.5 * val_unmasked["mean_reward"]
        if val_score > best_val_score:
            best_val_score = val_score
            best_val_reward = val_masked["mean_reward"]
            best_model = candidate
            best_seed = s

    assert best_model is not None

    # Train MLP baselines across TRAIN_SEEDS with the exact same environment timestep budget & VAL_SEED selection
    best_dqn_mlp: DQN | None = None
    best_dqn_val = -1e9
    best_ppo_mlp: PPO | None = None
    best_ppo_val = -1e9
    for s in TRAIN_SEEDS:
        flat_env_dqn = PaddedFlatEnvWrapper(
            MultiDomainStudentSimulatorEnv(domain_slug=None, seed=s, max_steps=60)
        )
        cand_dqn = DQN("MlpPolicy", flat_env_dqn, seed=s, verbose=0)
        cand_dqn.learn(total_timesteps=timesteps_per_seed)
        dqn_val_res = evaluate_policy(
            "dqn_mlp",
            TRAIN_DOMAINS,
            VAL_SEED,
            VAL_EPISODES_PHASE3,
            sb3_model=cand_dqn,
            masked=True,
        )
        if dqn_val_res["mean_reward"] > best_dqn_val:
            best_dqn_val = dqn_val_res["mean_reward"]
            best_dqn_mlp = cand_dqn

        flat_env_ppo = PaddedFlatEnvWrapper(
            MultiDomainStudentSimulatorEnv(domain_slug=None, seed=s, max_steps=60)
        )
        cand_ppo = PPO("MlpPolicy", flat_env_ppo, seed=s, verbose=0)
        cand_ppo.learn(total_timesteps=timesteps_per_seed)
        ppo_val_res = evaluate_policy(
            "ppo_mlp",
            TRAIN_DOMAINS,
            VAL_SEED,
            VAL_EPISODES_PHASE3,
            sb3_model=cand_ppo,
            masked=True,
        )
        if ppo_val_res["mean_reward"] > best_ppo_val:
            best_ppo_val = ppo_val_res["mean_reward"]
            best_ppo_mlp = cand_ppo

    dqn_mlp = best_dqn_mlp
    ppo_mlp = best_ppo_mlp

    # Export GNN-PPO checkpoint
    ckpt_path = ARTIFACTS_DIR / "gnn_ppo_v2_base.zip"
    metadata = {
        "model_type": "GnnActorCritic",
        "simulator_version": "4.0.0",
        "selected_seed": best_seed,
        "train_seeds": list(TRAIN_SEEDS),
        "timesteps_per_seed": timesteps_per_seed,
        "val_seed": VAL_SEED,
        "val_episodes": VAL_EPISODES_PHASE3,
        "val_mean_reward": best_val_reward,
        "node_feat_dim": 8,
        "hidden_dim": 64,
        "num_modes": 4,
        "num_layers": 3,
        "step_elapsed_days": 0.25,
        "created_at": datetime.now(UTC).isoformat(),
    }
    sha256 = export_gnn_ppo_checkpoint(best_model, ckpt_path, metadata)

    manifest = {
        "checkpoint_file": "gnn_ppo_v2_base.zip",
        "checkpoint_sha256": sha256,
        "simulator_version": "4.0.0",
        "selected_seed": best_seed,
        "train_seeds": list(TRAIN_SEEDS),
        "timesteps_per_seed": timesteps_per_seed,
        "val_seed": VAL_SEED,
        "val_episodes": VAL_EPISODES_PHASE3,
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
        "dqn_mlp_unmasked": evaluate_policy(
            "dqn_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=dqn_mlp, masked=False
        ),
        "dqn_mlp_masked": evaluate_policy(
            "dqn_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=dqn_mlp, masked=True
        ),
        "ppo_mlp_unmasked": evaluate_policy(
            "ppo_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=ppo_mlp, masked=False
        ),
        "ppo_mlp_masked": evaluate_policy(
            "ppo_mlp", TRAIN_DOMAINS, eval_seed, episodes, sb3_model=ppo_mlp, masked=True
        ),
        "gnn_ppo_unmasked": evaluate_policy(
            "gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=best_model, masked=False
        ),
        "gnn_ppo_masked": evaluate_policy(
            "gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=best_model, masked=True
        ),
    }

    heldout = ("heldout_data_eng_graph",)
    scenario_b = {
        "heuristic_b1": evaluate_policy("heuristic_b1", heldout, eval_seed, episodes),
        "heuristic_b2": evaluate_policy("heuristic_b2", heldout, eval_seed, episodes),
        "heuristic_b3": evaluate_policy("heuristic_b3", heldout, eval_seed, episodes),
        "dqn_mlp_unmasked": evaluate_policy(
            "dqn_mlp", heldout, eval_seed, episodes, sb3_model=dqn_mlp, masked=False
        ),
        "dqn_mlp_masked": evaluate_policy(
            "dqn_mlp", heldout, eval_seed, episodes, sb3_model=dqn_mlp, masked=True
        ),
        "ppo_mlp_unmasked": evaluate_policy(
            "ppo_mlp", heldout, eval_seed, episodes, sb3_model=ppo_mlp, masked=False
        ),
        "ppo_mlp_masked": evaluate_policy(
            "ppo_mlp", heldout, eval_seed, episodes, sb3_model=ppo_mlp, masked=True
        ),
        "gnn_ppo_unmasked": evaluate_policy(
            "gnn_ppo", heldout, eval_seed, episodes, gnn_model=best_model, masked=False
        ),
        "gnn_ppo_masked": evaluate_policy(
            "gnn_ppo", heldout, eval_seed, episodes, gnn_model=best_model, masked=True
        ),
    }

    # Ablation Study (D-33): Encoder Depth (3-Layer GNN vs 1-Layer GNN vs MLP) & Sample Budget (15k vs 30k vs 60k)
    ablation_1layer, _ = train_gnn_ppo_on_seed(
        seed=best_seed, total_timesteps=timesteps_per_seed, num_layers=1
    )
    b15 = max(2048, timesteps_per_seed // 4)
    b30 = max(4096, timesteps_per_seed // 2)
    ablation_15k, _ = train_gnn_ppo_on_seed(seed=best_seed, total_timesteps=b15, num_layers=3)
    ablation_30k, _ = train_gnn_ppo_on_seed(seed=best_seed, total_timesteps=b30, num_layers=3)

    ablation_study = {
        "selected_seed": best_seed,
        "encoder_depth_zero_shot": {
            "mlp_ppo_masked": scenario_b["ppo_mlp_masked"],
            "mlp_ppo_unmasked": scenario_b["ppo_mlp_unmasked"],
            "gnn_1layer_masked": evaluate_policy(
                "gnn_ppo", heldout, eval_seed, episodes, gnn_model=ablation_1layer, masked=True
            ),
            "gnn_1layer_unmasked": evaluate_policy(
                "gnn_ppo", heldout, eval_seed, episodes, gnn_model=ablation_1layer, masked=False
            ),
            "gnn_3layer_masked": scenario_b["gnn_ppo_masked"],
            "gnn_3layer_unmasked": scenario_b["gnn_ppo_unmasked"],
        },
        "sample_budget_curve_known_domains": {
            f"steps_{b15}": evaluate_policy(
                "gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=ablation_15k, masked=True
            ),
            f"steps_{b30}": evaluate_policy(
                "gnn_ppo", TRAIN_DOMAINS, eval_seed, episodes, gnn_model=ablation_30k, masked=True
            ),
            f"steps_{timesteps_per_seed}": scenario_a["gnn_ppo_masked"],
        },
    }

    report = {
        "simulator_version": "4.0.0",
        "step_elapsed_days": 0.25,
        "eval_seed": eval_seed,
        "episodes": episodes,
        "timesteps_per_seed": timesteps_per_seed,
        "checkpoint_sha256": sha256,
        "selected_seed": best_seed,
        "scenario_a_known_domains": scenario_a,
        "scenario_b_zero_shot_transfer": scenario_b,
        "ablation_study": ablation_study,
    }
    (ARTIFACTS_DIR / "evaluation_phase3_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8"
    )
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Train & evaluate Phase 3 GNN-PPO.")
    parser.add_argument("--eval-seed", type=int, default=EVAL_SEED)
    parser.add_argument("--episodes", type=int, default=EVAL_EPISODES)
    parser.add_argument("--timesteps-per-seed", type=int, default=TIMESTEPS_PER_SEED)
    args = parser.parse_args(argv)
    report = run_training_and_evaluation(
        episodes=args.episodes,
        eval_seed=args.eval_seed,
        timesteps_per_seed=args.timesteps_per_seed,
    )
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
