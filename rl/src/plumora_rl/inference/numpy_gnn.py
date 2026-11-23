"""Zero-Torch Pure-NumPy 3-Layer Directed GNN Predictor & KL-Regularized Actor-Head Updater."""

from __future__ import annotations

import hashlib
import io
import math
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import cast

import numpy as np


def _gelu(x: np.ndarray) -> np.ndarray:
    """Exact Gaussian Error Linear Unit (matching PyTorch F.gelu default approximate='none')."""
    erf_vec = np.vectorize(math.erf, otypes=[np.float64])
    x64 = x.astype(np.float64, copy=False)
    out = 0.5 * x64 * (1.0 + erf_vec(x64 / math.sqrt(2.0)))
    return cast(np.ndarray, out.astype(np.float32))


def _gelu_grad(x: np.ndarray) -> np.ndarray:
    """Exact derivative of GELU matching PyTorch autograd."""
    erf_vec = np.vectorize(math.erf, otypes=[np.float64])
    x64 = x.astype(np.float64, copy=False)
    cdf = 0.5 * (1.0 + erf_vec(x64 / math.sqrt(2.0)))
    pdf = np.exp(-0.5 * (x64**2)) / math.sqrt(2.0 * math.pi)
    return cast(np.ndarray, (cdf + x64 * pdf).astype(np.float32))


def _layer_norm(
    x: np.ndarray,
    weight: np.ndarray,
    bias: np.ndarray,
    eps: float = 1e-5,
) -> np.ndarray:
    mean = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    normed = (x - mean) / np.sqrt(var + eps)
    return cast(np.ndarray, (normed * weight + bias).astype(np.float32))


def _softmax(flat_logits: np.ndarray) -> np.ndarray:
    shifted = flat_logits.astype(np.float64) - float(np.max(flat_logits))
    exps = np.exp(shifted)
    return cast(np.ndarray, (exps / np.sum(exps)).astype(np.float32))


@dataclass(frozen=True)
class ActorTransition:
    """Single validated transition for KL-regularized micro-batch PPO actor update."""

    node_features: np.ndarray  # (N, 8)
    adj_in: np.ndarray  # (N, N) row-degree normalized
    adj_out: np.ndarray  # (N, N) row-degree normalized
    action_idx: int
    reward: float


@dataclass(frozen=True)
class MicroBatchUpdateResult:
    """Output of KL-regularized analytical actor-head PPO update."""

    updated_weights: dict[str, np.ndarray]
    mean_kl_divergence: float
    transitions_used: int
    epochs_run: int


class NumpyGnnPredictor:
    """Pure-NumPy 3-Layer Directed GNN Actor-Critic predictor (<5ms CPU, zero Torch)."""

    def __init__(self, sha256: str, weights: dict[str, np.ndarray]) -> None:
        self.sha256 = sha256
        self.w: dict[str, np.ndarray] = {
            k: v.astype(np.float32, copy=False) for k, v in weights.items()
        }

    @classmethod
    def from_checkpoint_zip(
        cls,
        ckpt_path: Path,
        *,
        expected_sha256: str | None = None,
    ) -> NumpyGnnPredictor:
        """Load and optionally SHA-256 verify a GNN-PPO checkpoint zip."""
        raw_bytes = ckpt_path.read_bytes()
        actual_sha = hashlib.sha256(raw_bytes).hexdigest()
        if expected_sha256 is not None and actual_sha != expected_sha256.strip():
            raise ValueError(
                f"Checkpoint SHA-256 mismatch: expected {expected_sha256}, got {actual_sha}"
            )
        with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
            npz_bytes = zf.read("weights.npz")
        npz = np.load(io.BytesIO(npz_bytes))
        weights = {k: npz[k].astype(np.float32).copy() for k in npz.files}
        return cls(sha256=actual_sha, weights=weights)

    def _linear(self, x: np.ndarray, prefix: str, has_bias: bool = True) -> np.ndarray:
        out = x @ self.w[f"{prefix}__weight"].T
        if has_bias:
            out = out + self.w[f"{prefix}__bias"]
        return cast(np.ndarray, out.astype(np.float32))

    def forward_with_cache(
        self,
        node_features: np.ndarray,
        adj_in: np.ndarray,
        adj_out: np.ndarray,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Run 3-layer Directed GNN forward pass returning (logits, actor_in, a1_pre, a1, g)."""
        x_f32 = node_features.astype(np.float32, copy=False)
        a_in = adj_in.astype(np.float32, copy=False)
        a_out = adj_out.astype(np.float32, copy=False)

        h = _gelu(self._linear(x_f32, "input_proj"))
        for idx in range(3):
            p = f"layers__{idx}"
            msg = (
                self._linear(h, f"{p}__w_self", has_bias=True)
                + self._linear(a_in @ h, f"{p}__w_prereq", has_bias=False)
                + self._linear(a_out @ h, f"{p}__w_dep", has_bias=False)
            )
            h = _layer_norm(
                h + _gelu(msg),
                self.w[f"{p}__norm__weight"],
                self.w[f"{p}__norm__bias"],
            )

        g = h.mean(axis=0, keepdims=True)  # (1, H)
        g_exp = np.repeat(g, h.shape[0], axis=0)  # (N, H)
        actor_in = np.concatenate([h, g_exp], axis=-1).astype(np.float32)  # (N, 2H)
        a1_pre = self._linear(actor_in, "actor_head__0")
        a1 = _gelu(a1_pre)
        logits = self._linear(a1, "actor_head__2")
        return logits, actor_in, a1_pre, a1, g.squeeze(0)

    def predict_logits(
        self,
        node_features: np.ndarray,
        adj_in: np.ndarray,
        adj_out: np.ndarray,
    ) -> np.ndarray:
        """Compute (N, 4) action logits matching PyTorch GnnActorCritic within 1e-5."""
        logits, _, _, _, _ = self.forward_with_cache(node_features, adj_in, adj_out)
        return logits

    def predict_value(
        self,
        node_features: np.ndarray,
        adj_in: np.ndarray,
        adj_out: np.ndarray,
    ) -> float:
        """Compute scalar critic value V(G) if critic_head weights are present."""
        _, _, _, _, g = self.forward_with_cache(node_features, adj_in, adj_out)
        if "critic_head__0__weight" not in self.w:
            return 0.0
        c1 = _gelu(self._linear(g[None, :], "critic_head__0"))
        val = self._linear(c1, "critic_head__2")
        return float(val.reshape(-1)[0])

    def predict_action_probs(
        self,
        node_features: np.ndarray,
        adj_in: np.ndarray,
        adj_out: np.ndarray,
    ) -> np.ndarray:
        """Return (N, 4) softmax action probability distribution."""
        logits = self.predict_logits(node_features, adj_in, adj_out)
        return _softmax(logits.reshape(-1)).reshape(logits.shape)

    @staticmethod
    def compute_kl_divergence(p_logits: np.ndarray, q_logits: np.ndarray) -> float:
        """Compute D_KL(pi_prod || pi_cand) = sum(p * log(p / q))."""
        p_prob = _softmax(p_logits.reshape(-1))
        q_prob = _softmax(q_logits.reshape(-1))
        kl = float(np.sum(p_prob * np.log((p_prob + 1e-8) / (q_prob + 1e-8))))
        return max(0.0, kl)

    def micro_batch_ppo_update(
        self,
        transitions: list[ActorTransition],
        *,
        epochs: int = 4,
        lr: float = 0.005,
        clip_eps: float = 0.2,
        beta_kl: float = 0.5,
        max_param_step: float = 0.02,
    ) -> MicroBatchUpdateResult:
        """Analytical PPO-Clip actor-head update with explicit KL penalty beta_KL * D_KL(pi_prod || pi_cand).

        Maximizes:
            J(theta) = E[ min(r_t A_t, clip(r_t, 1-eps, 1+eps) A_t) - beta_kl * D_KL(pi_prod || pi_cand) ]
        where d/d(z_cand) [ -beta_kl * D_KL(pi_prod || pi_cand) ] = beta_kl * (pi_prod - pi_cand).
        """
        cand_weights: dict[str, np.ndarray] = {
            k: v.astype(np.float32).copy() for k, v in self.w.items()
        }
        if not transitions:
            return MicroBatchUpdateResult(
                updated_weights=cand_weights,
                mean_kl_divergence=0.0,
                transitions_used=0,
                epochs_run=0,
            )

        rewards = np.array([t.reward for t in transitions], dtype=np.float32)
        advs = (rewards - float(np.mean(rewards))) / (float(np.std(rewards)) + 1e-6)
        advs = np.clip(advs, -2.0, 2.0)

        cached_prod: list[tuple[ActorTransition, np.ndarray, float]] = []
        for tr, adv in zip(transitions, advs, strict=True):
            prod_logits = self.predict_logits(tr.node_features, tr.adj_in, tr.adj_out).reshape(-1)
            prod_probs = _softmax(prod_logits)
            cached_prod.append((tr, prod_probs, float(adv)))

        cand_predictor = NumpyGnnPredictor("candidate", cand_weights)
        for _ in range(epochs):
            g_w2 = np.zeros_like(cand_weights["actor_head__2__weight"])
            g_b2 = np.zeros_like(cand_weights["actor_head__2__bias"])
            g_w0 = np.zeros_like(cand_weights["actor_head__0__weight"])
            g_b0 = np.zeros_like(cand_weights["actor_head__0__bias"])

            for tr, prod_probs, adv in cached_prod:
                logits, actor_in, a1_pre, a1, _ = cand_predictor.forward_with_cache(
                    tr.node_features, tr.adj_in, tr.adj_out
                )
                cand_probs = _softmax(logits.reshape(-1))
                old_p = float(prod_probs[tr.action_idx])
                new_p = float(cand_probs[tr.action_idx])
                ratio = new_p / (old_p + 1e-8)

                # Explicit KL penalty gradient: d/dz [ -beta_kl * KL(prod || cand) ] = beta_kl * (prod - cand)
                d_flat = beta_kl * (prod_probs - cand_probs)

                clipped = (adv >= 0.0 and ratio > 1.0 + clip_eps) or (
                    adv < 0.0 and ratio < 1.0 - clip_eps
                )
                if not clipped:
                    one_hot = np.zeros_like(cand_probs)
                    one_hot[tr.action_idx] = 1.0
                    d_flat = d_flat + (ratio * adv) * (one_hot - cand_probs)

                d_logits = d_flat.reshape(logits.shape).astype(np.float32)
                g_w2 += d_logits.T @ a1
                g_b2 += d_logits.sum(axis=0)
                d_a1 = d_logits @ cand_weights["actor_head__2__weight"]
                d_a1_pre = d_a1 * _gelu_grad(a1_pre)
                g_w0 += d_a1_pre.T @ actor_in
                g_b0 += d_a1_pre.sum(axis=0)

            scale = lr / max(1, len(cached_prod))
            cand_weights["actor_head__2__weight"] += np.clip(
                scale * g_w2, -max_param_step, max_param_step
            )
            cand_weights["actor_head__2__bias"] += np.clip(
                scale * g_b2, -max_param_step, max_param_step
            )
            cand_weights["actor_head__0__weight"] += np.clip(
                scale * g_w0, -max_param_step, max_param_step
            )
            cand_weights["actor_head__0__bias"] += np.clip(
                scale * g_b0, -max_param_step, max_param_step
            )

        kl_vals: list[float] = []
        for tr, prod_probs, _ in cached_prod:
            cand_logits = cand_predictor.predict_logits(
                tr.node_features, tr.adj_in, tr.adj_out
            ).reshape(-1)
            cand_probs = _softmax(cand_logits)
            kl = float(np.sum(prod_probs * np.log((prod_probs + 1e-8) / (cand_probs + 1e-8))))
            kl_vals.append(max(0.0, kl))

        return MicroBatchUpdateResult(
            updated_weights=cand_weights,
            mean_kl_divergence=round(float(np.mean(kl_vals)), 6) if kl_vals else 0.0,
            transitions_used=len(cached_prod),
            epochs_run=epochs,
        )
