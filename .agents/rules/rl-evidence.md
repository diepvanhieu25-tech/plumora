---
trigger: model_decision
description: "Use for simulator, DQN training, recommendation inference, evaluation, or claims about personalized learning efficacy."
---
# RL evidence

- Read `docs/research/RL_PLAN.md` and approved RL contracts before changes.
- Distinguish simulator assumptions, learned policy outputs, baselines and measured educational outcomes.
- Keep training/tuning/evaluation separated; compare policies with equivalent observations and budgets.
- Record source/config/dependency versions, seeds, checkpoint hashes and evaluation artifacts. Serving must load the evaluated checkpoint or disclose a separately approved fallback.
- No heuristic relabeled as DQN; no fabricated learning gains, plots or training evidence.
- Prerequisites, invalid actions, rewards and terminal states need approved semantics and tests.
