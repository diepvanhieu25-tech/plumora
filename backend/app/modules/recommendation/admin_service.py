"""Backward-compatible facade re-exporting app.modules.recommendation.services submodules."""

from app.modules.recommendation.services.model_registry import (
    BASE_CKPT_PATH,
    _acquire_model_registry_lock,
    _ensure_prod_model_seeded,
    _serialize_model,
    _verify_checkpoint_artifact,
    activate_candidate_model,
    get_online_rl_status,
    rollback_active_model,
)
from app.modules.recommendation.services.online_rl import (
    _build_transition_tensors,
    _derive_candidate_checkpoint,
    _extract_feature_matrix,
    run_micro_batch_online_rl,
)
from app.modules.recommendation.services.online_rl_eval import (
    _evaluate_candidate_against_active,
    _load_ckpt_weights,
    _load_domain_topology_for_rl,
    _rollout_policy_eval_on_topologies,
)
from app.modules.recommendation.services.online_rl_inspect import (
    get_online_rl_buffer_summary,
    inspect_policy_for_admin,
)
from app.modules.recommendation.services.system_health import (
    COMPETENCY_STREAM_NAME,
    DOMAIN_STREAM_NAME,
    WORKER_HEARTBEAT_KEY,
    _probe_http_health,
    get_admin_rl_analytics,
    get_streams_dlq_entries,
    get_system_health_status,
    trigger_manual_outbox_relay,
)

__all__ = [
    "BASE_CKPT_PATH",
    "COMPETENCY_STREAM_NAME",
    "DOMAIN_STREAM_NAME",
    "WORKER_HEARTBEAT_KEY",
    "_acquire_model_registry_lock",
    "_build_transition_tensors",
    "_derive_candidate_checkpoint",
    "_ensure_prod_model_seeded",
    "_evaluate_candidate_against_active",
    "_extract_feature_matrix",
    "_load_ckpt_weights",
    "_load_domain_topology_for_rl",
    "_probe_http_health",
    "_rollout_policy_eval_on_topologies",
    "_serialize_model",
    "_verify_checkpoint_artifact",
    "activate_candidate_model",
    "get_admin_rl_analytics",
    "get_online_rl_buffer_summary",
    "get_online_rl_status",
    "get_streams_dlq_entries",
    "get_system_health_status",
    "inspect_policy_for_admin",
    "rollback_active_model",
    "run_micro_batch_online_rl",
    "trigger_manual_outbox_relay",
]
