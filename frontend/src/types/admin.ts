export interface ModelRegistryItem {
  model_id: string
  version_tag: string
  checkpoint_sha256: string
  kl_divergence: number
  gate_verdict: 'PASSED' | 'BLOCKED'
  is_active: boolean
  created_at: string
}

export interface OnlineRlStatusResponse {
  buffer_count: number
  kl_target_max: number
  active_model: ModelRegistryItem | null
  models: ModelRegistryItem[]
}

export interface SystemHealthResponse {
  services: Record<string, string>
  schemas_isolated: boolean
  outbox_pending_count: number
  redis_connected: boolean
  redis_stream_lag_ms: number
  graph_cache_hit_rate: number
}
