"""Multi-seed DQN training, validation checkpoint selection, and artifact export (D-04, D-08)."""

from __future__ import annotations

import hashlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from stable_baselines3 import DQN

from plumora_rl.baselines import DQNMaskedQPolicy, DQNUnmaskedPolicy
from plumora_rl.config import (
    ACT_DIM,
    EVAL_EPISODES,
    EVAL_SEED,
    MAX_STEPS,
    OBS_DIM,
    PASS_THRESHOLD,
    TRAIN_SEEDS,
    VAL_EPISODES,
    VAL_SEED,
)
from plumora_rl.evaluate import evaluate_policy, run_full_benchmark
from plumora_rl.simulator import StudentSimulatorEnv

DEFAULT_ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts"

DQN_HYPERPARAMS: dict[str, Any] = {
    "learning_rate": 1e-3,
    "buffer_size": 50_000,
    "learning_starts": 1_000,
    "batch_size": 64,
    "gamma": 0.98,
    "train_freq": 4,
    "gradient_steps": 1,
    "target_update_interval": 500,
    "exploration_fraction": 0.35,
    "exploration_final_eps": 0.02,
    "policy_kwargs": {"net_arch": [128, 128]},
}


def train_single_seed(seed: int, total_timesteps: int = 100_000) -> tuple[DQN, float]:
    """Train a Stable-Baselines3 DQN model on StudentSimulatorEnv for a single seed."""
    env = StudentSimulatorEnv(max_steps=MAX_STEPS, allow_partial_init=True)
    env.reset(seed=seed)
    start_time = time.perf_counter()
    model = DQN(
        "MlpPolicy",
        env,
        seed=seed,
        verbose=0,
        **DQN_HYPERPARAMS,
    )
    model.learn(total_timesteps=total_timesteps)
    duration_sec = round(time.perf_counter() - start_time, 2)
    return model, duration_sec


def train_and_export_artifacts(
    artifacts_dir: Path = DEFAULT_ARTIFACTS_DIR,
    timesteps_per_seed: int = 100_000,
) -> dict[str, Any]:
    """Train across TRAIN_SEEDS, pick best on VAL_SEED, evaluate on EVAL_SEED, and export JSONs."""
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    runs_log: list[dict[str, Any]] = []
    best_model: DQN | None = None
    best_seed: int = TRAIN_SEEDS[0]
    best_val_reward = float("-inf")

    for seed in TRAIN_SEEDS:
        model, duration_sec = train_single_seed(seed=seed, total_timesteps=timesteps_per_seed)
        val_unmasked = evaluate_policy(
            DQNUnmaskedPolicy(model),
            base_seed=VAL_SEED,
            num_episodes=VAL_EPISODES,
        )
        val_masked = evaluate_policy(
            DQNMaskedQPolicy(model),
            base_seed=VAL_SEED,
            num_episodes=VAL_EPISODES,
        )
        val_reward_mean = val_unmasked["episodic_reward"]["mean"]
        val_invalid_mean = val_unmasked["invalid_action_rate"]["mean"]

        runs_log.append(
            {
                "seed": seed,
                "timesteps": timesteps_per_seed,
                "duration_seconds": duration_sec,
                "val_seed": VAL_SEED,
                "val_episodes": VAL_EPISODES,
                "val_unmasked_metrics": val_unmasked,
                "val_masked_metrics": val_masked,
            }
        )

        # Select checkpoint with highest unmasked validation episodic reward
        if val_reward_mean > best_val_reward:
            best_val_reward = val_reward_mean
            best_seed = seed
            best_model = model

        print(
            f"[RL-01] Seed {seed}: duration={duration_sec}s, "
            f"val_reward={val_reward_mean:.2f}, val_invalid_rate={val_invalid_mean:.4f}"
        )

    assert best_model is not None

    checkpoint_path = artifacts_dir / "checkpoint.zip"
    best_model.save(str(checkpoint_path))
    checkpoint_sha256 = hashlib.sha256(checkpoint_path.read_bytes()).hexdigest()

    eval_report = run_full_benchmark(
        model=best_model,
        eval_seed=EVAL_SEED,
        num_episodes=EVAL_EPISODES,
    )
    eval_report["selected_seed"] = best_seed
    eval_report["checkpoint_sha256"] = checkpoint_sha256
    eval_report["generated_at"] = datetime.now(UTC).isoformat()

    training_log = {
        "algorithm": "DQN (Stable-Baselines3)",
        "hyperparameters": DQN_HYPERPARAMS,
        "train_seeds": list(TRAIN_SEEDS),
        "val_seed": VAL_SEED,
        "val_episodes": VAL_EPISODES,
        "selected_seed": best_seed,
        "runs": runs_log,
        "generated_at": datetime.now(UTC).isoformat(),
    }

    manifest = {
        "policy_type": "dqn",
        "policy_version": f"dqn-v1-seed{best_seed}",
        "checkpoint_file": "checkpoint.zip",
        "checkpoint_sha256": checkpoint_sha256,
        "obs_dim": OBS_DIM,
        "act_dim": ACT_DIM,
        "pass_threshold": PASS_THRESHOLD,
        "max_steps": MAX_STEPS,
        "train_seeds": list(TRAIN_SEEDS),
        "selected_seed": best_seed,
        "timesteps_per_seed": timesteps_per_seed,
        "val_seed": VAL_SEED,
        "eval_seed": EVAL_SEED,
        "eval_episodes": EVAL_EPISODES,
        "generated_at": datetime.now(UTC).isoformat(),
    }

    (artifacts_dir / "training_log.json").write_text(
        json.dumps(training_log, indent=2) + "\n", encoding="utf-8"
    )
    (artifacts_dir / "evaluation_report.json").write_text(
        json.dumps(eval_report, indent=2) + "\n", encoding="utf-8"
    )
    (artifacts_dir / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )

    return eval_report


if __name__ == "__main__":
    report = train_and_export_artifacts()
    dqn_u = report["policies"]["DQN_unmasked"]
    b2 = report["policies"]["B2_valid_random"]
    print(
        f"[RL-01] Evaluation complete (seed={report['selected_seed']}): "
        f"DQN_unmasked reward={dqn_u['episodic_reward']['mean']:.2f} "
        f"(vs B2={b2['episodic_reward']['mean']:.2f}), "
        f"DQN_unmasked invalid_action_rate={dqn_u['invalid_action_rate']['mean']:.4f}"
    )
