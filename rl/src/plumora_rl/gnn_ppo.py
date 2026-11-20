"""3-Layer Directed Adjacency GNN Actor-Critic (GNN-PPO) in pure PyTorch Tensors."""

from __future__ import annotations

import hashlib
import io
import json
import zipfile
from pathlib import Path
from typing import Any, cast

import numpy as np
import torch
import torch.nn.functional as F
from torch import nn
from torch.distributions import Categorical

from plumora_rl.multidomain_sim import (
    NODE_FEAT_DIM,
    NUM_MODES,
    TRAIN_DOMAINS,
    MultiDomainStudentSimulatorEnv,
)


class DirectedGnnLayer(nn.Module):
    """Single directed message-passing layer over (A_in, A_out) with residual + LayerNorm."""

    def __init__(self, hidden_dim: int) -> None:
        super().__init__()
        self.w_self = nn.Linear(hidden_dim, hidden_dim, bias=True)
        self.w_prereq = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.w_dep = nn.Linear(hidden_dim, hidden_dim, bias=False)
        self.norm = nn.LayerNorm(hidden_dim)

    def forward(
        self,
        h: torch.Tensor,
        adj_in: torch.Tensor,
        adj_out: torch.Tensor,
    ) -> torch.Tensor:
        msg = self.w_self(h) + self.w_prereq(torch.matmul(adj_in, h)) + self.w_dep(
            torch.matmul(adj_out, h)
        )
        return cast(torch.Tensor, self.norm(h + F.gelu(msg)))


class GnnActorCritic(nn.Module):
    """Domain-size-agnostic 3-Layer GNN Actor-Critic for (concept, learning_mode) selection."""

    def __init__(
        self,
        node_feat_dim: int = NODE_FEAT_DIM,
        hidden_dim: int = 64,
        num_modes: int = NUM_MODES,
    ) -> None:
        super().__init__()
        self.node_feat_dim = node_feat_dim
        self.hidden_dim = hidden_dim
        self.num_modes = num_modes

        self.input_proj = nn.Linear(node_feat_dim, hidden_dim)
        self.layers = nn.ModuleList([DirectedGnnLayer(hidden_dim) for _ in range(3)])
        self.actor_head = nn.Sequential(
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, num_modes),
        )
        self.critic_head = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim),
            nn.GELU(),
            nn.Linear(hidden_dim, 1),
        )

    def forward(
        self,
        node_features: torch.Tensor,
        adj_in: torch.Tensor,
        adj_out: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Forward pass for an arbitrary-size graph (N, 8) -> logits (N, 4), value ()."""
        h = F.gelu(self.input_proj(node_features))
        for layer in self.layers:
            h = layer(h, adj_in, adj_out)
        g = h.mean(dim=0)  # (hidden_dim,)
        g_expanded = g.unsqueeze(0).expand(h.shape[0], -1)
        actor_in = torch.cat([h, g_expanded], dim=-1)  # (N, 2*hidden_dim)
        logits = self.actor_head(actor_in)  # (N, 4)
        value = self.critic_head(g).squeeze(-1)  # ()
        return logits, value


def export_gnn_ppo_checkpoint(
    model: GnnActorCritic,
    output_path: Path,
    metadata: dict[str, Any],
) -> str:
    """Export GNN-PPO checkpoint zip with PyTorch state_dict + NumPy weights.npz; return SHA-256."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pt_buf = io.BytesIO()
    torch.save(model.state_dict(), pt_buf)

    np_weights: dict[str, np.ndarray] = {
        name.replace(".", "__"): param.detach().cpu().numpy().astype(np.float32)
        for name, param in model.named_parameters()
    }
    npz_buf = io.BytesIO()
    np.savez(npz_buf, **np_weights)  # type: ignore[arg-type]

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("model_state_dict.pt", pt_buf.getvalue())
        zf.writestr("weights.npz", npz_buf.getvalue())
        zf.writestr("metadata.json", json.dumps(metadata, indent=2))

    return hashlib.sha256(output_path.read_bytes()).hexdigest()


def _build_valid_mask(obs: dict[str, np.ndarray]) -> torch.Tensor:
    """Build non-redundant eligible mask for rollout exploration."""
    feats = obs["node_features"]
    n = feats.shape[0]
    mask = np.zeros((n, NUM_MODES), dtype=bool)
    for i in range(n):
        if feats[i, 3] > 0.5:  # is_eligible
            if feats[i, 0] < 0.50:
                mask[i, 0] = True
            if feats[i, 0] < 1.0 or feats[i, 2] < 0.85:
                mask[i, 1] = True
            if feats[i, 6] < 1.0 or feats[i, 0] < 1.0:
                mask[i, 2] = True
            if feats[i, 2] < 0.85 and feats[i, 0] >= 0.50:
                mask[i, 3] = True
    if not np.any(mask):
        mask[:, 1] = True
    return torch.from_numpy(mask)


def train_gnn_ppo_on_seed(
    seed: int,
    total_episodes: int = 180,
    lr: float = 2.5e-3,
    gamma: float = 0.99,
    gae_lambda: float = 0.95,
    clip_eps: float = 0.2,
) -> tuple[GnnActorCritic, list[float]]:
    """Train GnnActorCritic with PPO-Clip + structural auxiliary loss across backend, frontend, devops."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    model = GnnActorCritic(node_feat_dim=NODE_FEAT_DIM, hidden_dim=64, num_modes=NUM_MODES)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    env = MultiDomainStudentSimulatorEnv(domain_slug=None, seed=seed, max_steps=60)

    episode_rewards: list[float] = []

    for ep in range(total_episodes):
        domain_slug = TRAIN_DOMAINS[ep % len(TRAIN_DOMAINS)]
        obs, _ = env.reset(seed=seed + ep, options={"domain_slug": domain_slug})
        done = False
        ep_reward = 0.0

        traj_x: list[torch.Tensor] = []
        traj_in: list[torch.Tensor] = []
        traj_out: list[torch.Tensor] = []
        traj_mask: list[torch.Tensor] = []
        traj_act: list[int] = []
        traj_logp: list[float] = []
        traj_val: list[float] = []
        traj_rew: list[float] = []
        traj_done: list[float] = []

        while not done:
            x_t = torch.from_numpy(obs["node_features"])
            in_t = torch.from_numpy(obs["adj_in"])
            out_t = torch.from_numpy(obs["adj_out"])
            valid_mask = _build_valid_mask(obs).reshape(-1)

            with torch.no_grad():
                logits, val = model(x_t, in_t, out_t)
                masked_logits = logits.reshape(-1).masked_fill(~valid_mask, -1e9)
                dist = Categorical(logits=masked_logits)
                act_idx = int(dist.sample().item())  # type: ignore[no-untyped-call]
                logp = float(dist.log_prob(torch.tensor(act_idx)).item())  # type: ignore[no-untyped-call]

            v_idx = act_idx // NUM_MODES
            m_idx = act_idx % NUM_MODES
            next_obs, reward, terminated, truncated, _ = env.step((v_idx, m_idx))
            done = terminated or truncated
            ep_reward += reward

            traj_x.append(x_t)
            traj_in.append(in_t)
            traj_out.append(out_t)
            traj_mask.append(valid_mask)
            traj_act.append(act_idx)
            traj_logp.append(logp)
            traj_val.append(float(val.item()))
            traj_rew.append(float(reward))
            traj_done.append(1.0 if done else 0.0)

            obs = next_obs

        episode_rewards.append(ep_reward)

        # Compute GAE returns & advantages
        T = len(traj_rew)
        advantages = np.zeros(T, dtype=np.float32)
        gae = 0.0
        next_val = 0.0
        for t in reversed(range(T)):
            mask = 1.0 - traj_done[t]
            delta = traj_rew[t] + gamma * next_val * mask - traj_val[t]
            gae = delta + gamma * gae_lambda * mask * gae
            advantages[t] = gae
            next_val = traj_val[t]
        returns = advantages + np.array(traj_val, dtype=np.float32)
        adv_norm = (advantages - advantages.mean()) / (advantages.std() + 1e-8)

        # 3 PPO epochs over episode (with unmasked penalty on invalid logits so unmasked also stays <5% invalid)
        for _ in range(3):
            total_loss = torch.tensor(0.0)
            for t in range(T):
                logits, val = model(traj_x[t], traj_in[t], traj_out[t])
                flat_logits = logits.reshape(-1)
                masked_logits = flat_logits.masked_fill(~traj_mask[t], -1e9)
                dist = Categorical(logits=masked_logits)
                act_t = torch.tensor(traj_act[t])
                new_logp = dist.log_prob(act_t)  # type: ignore[no-untyped-call]
                entropy = dist.entropy()  # type: ignore[no-untyped-call]
                ratio = torch.exp(new_logp - traj_logp[t])
                adv_t = torch.tensor(float(adv_norm[t]))
                surr1 = ratio * adv_t
                surr2 = torch.clamp(ratio, 1.0 - clip_eps, 1.0 + clip_eps) * adv_t
                policy_loss = -torch.min(surr1, surr2)
                value_loss = F.mse_loss(val, torch.tensor(float(returns[t])))
                # Auxiliary DAG eligibility loss so unmasked inference avoids locked/redundant nodes
                probs_unmasked = F.softmax(flat_logits, dim=-1)
                invalid_mass = probs_unmasked[~traj_mask[t]].sum()
                total_loss = (
                    total_loss
                    + (policy_loss + 0.5 * value_loss - 0.02 * entropy + 3.0 * invalid_mass) / T
                )

            optimizer.zero_grad()
            total_loss.backward()  # type: ignore[no-untyped-call]
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
            optimizer.step()

    return model, episode_rewards
