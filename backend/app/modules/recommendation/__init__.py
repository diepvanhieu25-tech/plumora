"""Recommendation (GNN-PPO + Policy Guardrail) & Admin Safe Online RL domain package."""

from __future__ import annotations

from importlib import import_module
from typing import Any

_EXPORTS: dict[str, tuple[str, str]] = {
    "admin_router": ("app.modules.recommendation.router_admin", "router"),
    "recommend_gnn_ppo_v2": ("app.modules.recommendation.service_v2", "recommend_gnn_ppo_v2"),
}


def __getattr__(name: str) -> Any:
    if name in _EXPORTS:
        mod_path, attr = _EXPORTS[name]
        return getattr(import_module(mod_path), attr)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = list(_EXPORTS.keys())
