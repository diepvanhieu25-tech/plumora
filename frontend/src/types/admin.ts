export interface ModelEvalMetrics {
  eval_episodes?: number
  domains_evaluated?: string[]
  candidate_mean_reward?: number
  active_mean_reward?: number
  reward_delta?: number
  invalid_action_rate_unmasked?: number
  masked_violation_rate?: number
  mean_reward_ratio_vs_prod?: number
  eval_source?: string
  block_reasons?: string[]
  previous_active_model_id?: string
  last_activation_reason?: string
  last_rollback_reason?: string
}

export interface ModelRegistryItem {
  model_id: string
  version_tag: string
  checkpoint_sha256: string
  kl_divergence: number
  gate_verdict: 'PASSED' | 'BLOCKED'
  is_active: boolean
  created_at: string
  activated_at?: string | null
  eval_metrics?: ModelEvalMetrics
}

export interface BenchmarkPolicyMetrics {
  episodes: number
  mean_reward: number
  std_reward: number
  invalid_action_rate: number
  masked_violation_rate: number
  completion_rate: number
}

export interface BenchmarkReportData {
  eval_seed: number
  episodes: number
  checkpoint_sha256: string
  selected_seed: number
  scenario_a_known_domains: Record<string, BenchmarkPolicyMetrics>
  scenario_b_zero_shot_transfer: Record<string, BenchmarkPolicyMetrics>
}

export interface OnlineRlStatusResponse {
  buffer_count: number
  kl_target_max: number
  active_model: ModelRegistryItem | null
  models: ModelRegistryItem[]
  benchmark_report?: BenchmarkReportData | null
}

export interface MicroBatchTrainResponse {
  candidate_model_id: string
  version_tag: string
  checkpoint_sha256: string
  kl_divergence: number
  safety_eval: {
    gate_verdict: 'PASSED' | 'BLOCKED'
    invalid_action_rate_unmasked: number
    masked_violation_rate: number
    mean_reward_ratio_vs_prod: number
    block_reasons?: string[]
  }
}

export interface ModelSwitchResponse {
  active_model_id: string
  previous_model_id: string | null
  active_checkpoint_sha256: string
  switched_at: string
  switch_latency_ms: number
  reason?: string
}

export interface BufferTransitionItem {
  id: string
  event_id: string
  user_id: string
  domain_slug: string
  concept_slug: string
  action_mode: string
  reward: number
  depth_before: number | null
  depth_after: number | null
  created_at: string
}

export interface OnlineRlBufferSummaryResponse {
  total_transitions: number
  by_domain: Record<string, number>
  by_mode: Record<string, number>
  reward_stats: {
    mean: number
    min: number
    max: number
  }
  recent_transitions: BufferTransitionItem[]
}

export interface PolicyInspectRequestPayload {
  domain_slug: string
  user_id?: string | null
  simulated_time_offset_days: number
  checkpoint_model_id?: string | null
}

export interface PolicyInspectNodeRow {
  node_idx: number
  concept_slug: string
  title: string
  tier: number
  has_code_challenge: boolean
  features: number[]
  valid_modes: Record<string, boolean>
  raw_probs: Record<string, number>
  guarded_probs: Record<string, number>
}

export interface PolicyInspectResponse {
  domain_slug: string
  user_id: string
  simulated_time_offset_days: number
  model_version: string
  checkpoint_sha256: string
  selected_action: {
    concept_slug: string
    node_idx: number
    learning_mode: string
    policy_source: string
    guardrail_applied: boolean
  }
  nodes: PolicyInspectNodeRow[]
}

export interface ManualOutboxRelayResponse {
  status: string
  relayed: number
  consumed: number
  acked: number
  reclaimed: number
  dlq: number
  transient_errors: number
}

export interface StreamDlqEntry {
  stream: string
  msg_id: string
  fields: Record<string, string>
}

export interface StreamsDlqResponse {
  redis_connected: boolean
  dlq_count: number
  entries: StreamDlqEntry[]
}

export interface SystemHealthResponse {
  mode?: string
  db_dialect?: string
  services: Record<string, string>
  postgres_connected?: boolean
  rl_checkpoint_verified?: boolean
  schemas_isolated: boolean
  outbox_pending_count: number
  outbox_pending_by_event_type?: Record<string, number>
  stream_lengths_by_event_type?: Record<string, number>
  dlq_count?: number
  redis_connected: boolean
  redis_stream_lag_ms: number
  redis_stream_pending_age_ms?: number | null
  outbox_commit_to_consume_last_ms?: number | null
  outbox_commit_to_consume_p95_ms?: number | null
  outbox_commit_to_consume_samples?: number
  consumer_group_active?: boolean
  redis_stream_pending?: number
  graph_cache_hit_rate: number
}
