"""Authoritative RL Training & Evaluation Seed Configuration."""

from __future__ import annotations

TRAIN_SEEDS: tuple[int, ...] = (101, 202, 303)
VAL_SEED: int = 999
VAL_EPISODES: int = 200
EVAL_SEED: int = 2026
EVAL_EPISODES: int = 500
