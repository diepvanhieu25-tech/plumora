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

from plumora_rl.domain import (
    NODE_FEAT_DIM,
    NUM_MODES,
    LearningMode,
    NodeFeatureIdx,
    PolicyGuardrailStrategy,
)
from plumora_rl.multidomain_sim import (
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
    """Domain-size-agnostic Directed GNN Actor-Critic for (concept, learning_mode) selection."""

    def __init__(
        self,
        node_feat_dim: int = NODE_FEAT_DIM,
        hidden_dim: int = 64,
        num_modes: int = NUM_MODES,
        num_layers: int = 3,
    ) -> None:
        super().__init__()
        self.node_feat_dim = node_feat_dim
        self.hidden_dim = hidden_dim
        self.num_modes = num_modes
        self.num_layers = num_layers

        self.input_proj = nn.Linear(node_feat_dim, hidden_dim)
        self.layers = nn.ModuleList([DirectedGnnLayer(hidden_dim) for _ in range(num_layers)])
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
        """Forward pass for unbatched (N, 8) -> ((N, 4), ()) or batched (B, N, 8) -> ((B, N, 4), (B,))."""
        h = F.gelu(self.input_proj(node_features))
        for layer in self.layers:
            h = layer(h, adj_in, adj_out)
        if h.dim() == 2:
            g = h.mean(dim=0)  # (hidden_dim,)
            g_expanded = g.unsqueeze(0).expand(h.shape[0], -1)
            actor_in = torch.cat([h, g_expanded], dim=-1)  # (N, 2*hidden_dim)
            logits = self.actor_head(actor_in)  # (N, 4)
            value = self.critic_head(g).squeeze(-1)  # ()
            return logits, value

        g_b = h.mean(dim=1, keepdim=True)  # (B, 1, hidden_dim)
        g_b_exp = g_b.expand(-1, h.shape[1], -1)
        actor_in_b = torch.cat([h, g_b_exp], dim=-1)  # (B, N, 2*hidden_dim)
        logits_b = self.actor_head(actor_in_b)  # (B, N, 4)
        value_b = self.critic_head(g_b.squeeze(1)).squeeze(-1)  # (B,)
        return logits_b, value_b


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


def load_gnn_actor_critic_from_zip(ckpt_path: Path) -> GnnActorCritic:
    """Load GnnActorCritic from either weights.npz (canonical Zero-Torch format) or model_state_dict.pt."""
    with zipfile.ZipFile(ckpt_path, "r") as zf:
        names = set(zf.namelist())
        meta = json.loads(zf.read("metadata.json").decode("utf-8")) if "metadata.json" in names else {}
        num_layers = int(meta.get("num_layers", 3))
        hidden_dim = int(meta.get("hidden_dim", 64))
        model = GnnActorCritic(
            node_feat_dim=int(meta.get("node_feat_dim", NODE_FEAT_DIM)),
            hidden_dim=hidden_dim,
            num_modes=int(meta.get("num_modes", NUM_MODES)),
            num_layers=num_layers,
        )
        if "weights.npz" in names:
            npz = np.load(io.BytesIO(zf.read("weights.npz")))
            state_dict = {
                k.replace("__", "."): torch.from_numpy(npz[k].astype(np.float32))
                for k in npz.files
            }
            model.load_state_dict(state_dict)
        elif "model_state_dict.pt" in names:
            pt_state = torch.load(io.BytesIO(zf.read("model_state_dict.pt")), weights_only=True)
            model.load_state_dict(pt_state)
        else:
            raise ValueError(f"Checkpoint {ckpt_path} missing weights.npz and model_state_dict.pt")
    return model


def _build_valid_mask(obs: dict[str, np.ndarray]) -> torch.Tensor:
    """Build non-redundant eligible mask for rollout exploration via shared PolicyGuardrailStrategy."""
    feats = obs["node_features"]
    mask = PolicyGuardrailStrategy.compute_valid_action_mask(feats)
    needs_rev = feats[:, NodeFeatureIdx.NEEDS_REVIEW] > 0.5
    if bool(np.any(needs_rev)):
        # Focus review strictly on decayed nodes when retention < 0.60
        non_rev = ~needs_rev
        mask[non_rev, :] = False
        mask[needs_rev, : LearningMode.SPACED_REVIEW] = False
        mask[needs_rev, LearningMode.SPACED_REVIEW] = True
    elif np.any(mask[:, : LearningMode.SPACED_REVIEW]):
        # Disallow premature SPACED_REVIEW when no node needs review
        mask[:, LearningMode.SPACED_REVIEW] = False
    if not np.any(mask):
        mask[:, 1] = True
    return torch.from_numpy(mask)


def train_gnn_ppo_on_seed(
    seed: int,
    total_episodes: int = 180,
    *,
    total_timesteps: int | None = None,
    num_layers: int = 3,
    rollout_steps: int = 512,
    minibatch_size: int = 128,
    lr: float = 5.0e-4,
    lr_end: float = 1.0e-4,
    gamma: float = 0.995,
    gae_lambda: float = 0.95,
    clip_eps: float = 0.2,
) -> tuple[GnnActorCritic, list[float]]:
    """Train GnnActorCritic with 512-step Rollout Buffers, truncation-bootstrapped GAE & annealed NLL."""
    torch.manual_seed(seed)
    np.random.seed(seed)
    rng = np.random.default_rng(seed)

    model = GnnActorCritic(
        node_feat_dim=NODE_FEAT_DIM,
        hidden_dim=64,
        num_modes=NUM_MODES,
        num_layers=num_layers,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    env = MultiDomainStudentSimulatorEnv(domain_slug=None, seed=seed, max_steps=60)

    episode_rewards: list[float] = []
    env_steps_used = 0
    ep = 0
    budget_steps = total_timesteps if total_timesteps is not None else total_episodes * 45

    while (total_timesteps is not None and env_steps_used < total_timesteps) or (
        total_timesteps is None and ep < total_episodes
    ):
        progress = min(1.0, float(env_steps_used) / float(max(1, budget_steps)))
        cur_lr = lr + (lr_end - lr) * progress
        for pg in optimizer.param_groups:
            pg["lr"] = cur_lr
        # Anneal auxiliary validity NLL loss (D-33): strong early DAG grounding -> gentle safety regularizer
        validity_coef = 0.90 - 0.65 * progress

        domain_buffers: dict[str, dict[str, list[Any]]] = {
            d: {"x": [], "in": [], "out": [], "mask": [], "act": [], "logp": [], "adv": [], "ret": []}
            for d in TRAIN_DOMAINS
        }
        collected_in_rollout = 0

        while collected_in_rollout < rollout_steps:
            if (total_timesteps is not None and env_steps_used >= total_timesteps) or (
                total_timesteps is None and ep >= total_episodes
            ):
                break

            domain_slug = TRAIN_DOMAINS[ep % len(TRAIN_DOMAINS)]
            obs, _ = env.reset(seed=seed + ep, options={"domain_slug": domain_slug})
            ep += 1
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
            traj_terminated: list[bool] = []
            last_next_obs: dict[str, np.ndarray] = obs

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
                env_steps_used += 1
                collected_in_rollout += 1
                budget_cut = total_timesteps is not None and env_steps_used >= total_timesteps
                done = terminated or truncated or budget_cut
                ep_reward += reward

                traj_x.append(x_t)
                traj_in.append(in_t)
                traj_out.append(out_t)
                traj_mask.append(valid_mask)
                traj_act.append(act_idx)
                traj_logp.append(logp)
                traj_val.append(float(val.item()))
                traj_rew.append(float(reward))
                traj_terminated.append(bool(terminated))
                last_next_obs = next_obs
                obs = next_obs

            episode_rewards.append(ep_reward)

            # Compute GAE with time-limit truncation bootstrap V(s_T) when not terminated (D-33)
            T = len(traj_rew)
            if T == 0:
                continue
            bootstrap_val = 0.0
            if not traj_terminated[-1]:
                with torch.no_grad():
                    _, v_boot = model(
                        torch.from_numpy(last_next_obs["node_features"]),
                        torch.from_numpy(last_next_obs["adj_in"]),
                        torch.from_numpy(last_next_obs["adj_out"]),
                    )
                    bootstrap_val = float(v_boot.item())

            advantages = np.zeros(T, dtype=np.float32)
            gae = 0.0
            next_val = bootstrap_val
            for t in reversed(range(T)):
                non_terminal = 0.0 if traj_terminated[t] else 1.0
                delta = traj_rew[t] + gamma * next_val * non_terminal - traj_val[t]
                gae = delta + gamma * gae_lambda * non_terminal * gae
                advantages[t] = gae
                next_val = traj_val[t]
            returns = advantages + np.array(traj_val, dtype=np.float32)

            dbuf = domain_buffers[domain_slug]
            dbuf["x"].extend(traj_x)
            dbuf["in"].extend(traj_in)
            dbuf["out"].extend(traj_out)
            dbuf["mask"].extend(traj_mask)
            dbuf["act"].extend(traj_act)
            dbuf["logp"].extend(traj_logp)
            dbuf["adv"].extend(advantages.tolist())
            dbuf["ret"].extend(returns.tolist())

        # Normalize advantages globally across the entire 512-step multi-domain rollout buffer
        all_adv_list: list[float] = []
        for d in TRAIN_DOMAINS:
            all_adv_list.extend(domain_buffers[d]["adv"])
        if not all_adv_list:
            break
        adv_arr = np.array(all_adv_list, dtype=np.float32)
        adv_mean = float(adv_arr.mean())
        adv_std = float(adv_arr.std()) + 1e-8

        stacked_domains: list[tuple[torch.Tensor, ...]] = []
        for d in TRAIN_DOMAINS:
            dbuf = domain_buffers[d]
            if not dbuf["x"]:
                continue
            d_adv = (np.array(dbuf["adv"], dtype=np.float32) - adv_mean) / adv_std
            stacked_domains.append(
                (
                    torch.stack(dbuf["x"], dim=0),
                    torch.stack(dbuf["in"], dim=0),
                    torch.stack(dbuf["out"], dim=0),
                    torch.stack(dbuf["mask"], dim=0),
                    torch.tensor(dbuf["act"], dtype=torch.long),
                    torch.tensor(dbuf["logp"], dtype=torch.float32),
                    torch.tensor(d_adv, dtype=torch.float32),
                    torch.tensor(dbuf["ret"], dtype=torch.float32),
                )
            )

        for _ in range(4):
            domain_order = rng.permutation(len(stacked_domains))
            for d_idx in domain_order:
                bx, b_in, b_out, b_mask, b_act, b_old_logp, b_adv, b_ret = stacked_domains[int(d_idx)]
                n_samples = int(bx.shape[0])
                perm = torch.from_numpy(rng.permutation(n_samples)).long()
                for start in range(0, n_samples, minibatch_size):
                    mb_idx = perm[start : start + minibatch_size]
                    mb_len = int(mb_idx.shape[0])
                    if mb_len < 2:
                        continue
                    logits_b, val_b = model(bx[mb_idx], b_in[mb_idx], b_out[mb_idx])
                    flat_logits_b = logits_b.reshape(mb_len, -1)
                    masked_logits_b = flat_logits_b.masked_fill(~b_mask[mb_idx], -1e9)
                    dist_b = Categorical(logits=masked_logits_b)
                    new_logp_b = dist_b.log_prob(b_act[mb_idx])  # type: ignore[no-untyped-call]
                    entropy_b = dist_b.entropy()  # type: ignore[no-untyped-call]
                    ratio_b = torch.exp(new_logp_b - b_old_logp[mb_idx])
                    surr1 = ratio_b * b_adv[mb_idx]
                    surr2 = torch.clamp(ratio_b, 1.0 - clip_eps, 1.0 + clip_eps) * b_adv[mb_idx]
                    policy_loss = -torch.min(surr1, surr2).mean()
                    value_loss = F.mse_loss(val_b, b_ret[mb_idx])

                    probs_unmasked = F.softmax(flat_logits_b, dim=-1)
                    valid_prob_mass = (probs_unmasked * b_mask[mb_idx].float()).sum(dim=-1)
                    validity_nll_loss = -torch.log(valid_prob_mass.clamp(min=1e-6)).mean()

                    total_loss = (
                        policy_loss
                        + 0.5 * value_loss
                        - 0.015 * entropy_b.mean()
                        + validity_coef * validity_nll_loss
                    )
                    optimizer.zero_grad()
                    total_loss.backward()
                    torch.nn.utils.clip_grad_norm_(model.parameters(), 0.5)
                    optimizer.step()

    return model, episode_rewards
