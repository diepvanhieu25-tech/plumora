"""Recommendation (GNN-PPO + Policy Guardrail) & Admin Safe Online RL domain package."""

from app.modules.recommendation.router_admin import router as admin_router
from app.modules.recommendation.service_v2 import recommend_gnn_ppo_v2

__all__ = ["admin_router", "recommend_gnn_ppo_v2"]
