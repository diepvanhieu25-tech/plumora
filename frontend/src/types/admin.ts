export interface ModelRegistryItem {
  model_id: string
  version_tag: string
  checkpoint_sha256: string
  kl_divergence: number
  gate_verdict: 'PASSED' | 'BLOCKED'
  is_active: boolean
  created_at: string
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

export interface SystemHealthResponse {
  mode?: string
  services: Record<string, string>
  schemas_isolated: boolean
  outbox_pending_count: number
  redis_connected: boolean
  redis_stream_lag_ms: number
  consumer_group_active?: boolean
  redis_stream_pending?: number
  graph_cache_hit_rate: number
}
