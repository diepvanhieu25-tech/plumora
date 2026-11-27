import type {
  AdminRlAnalyticsResponse,
  ManualOutboxRelayResponse,
  MicroBatchTrainResponse,
  ModelSwitchResponse,
  OnlineRlBufferSummaryResponse,
  OnlineRlStatusResponse,
  PolicyInspectRequestPayload,
  PolicyInspectResponse,
  StreamsDlqResponse,
  SystemHealthResponse,
} from '../types/admin'
import { requestJson } from './httpClient'

export async function apiAdminGetOnlineRlStatus(): Promise<OnlineRlStatusResponse> {
  return requestJson<OnlineRlStatusResponse>(
    '/api/v2/admin/online-rl/status',
    {},
    'Không thể tải trạng thái Online RL',
  )
}

export async function apiAdminGetBufferSummary(
  recentLimit: number = 20,
): Promise<OnlineRlBufferSummaryResponse> {
  return requestJson<OnlineRlBufferSummaryResponse>(
    `/api/v2/admin/online-rl/buffer-summary?recent_limit=${recentLimit}`,
    {},
    'Không thể tải thống kê Kho Kinh nghiệm (Experience Buffer)',
  )
}

export async function apiAdminInspectPolicy(
  payload: PolicyInspectRequestPayload,
): Promise<PolicyInspectResponse> {
  return requestJson<PolicyInspectResponse>(
    '/api/v2/admin/online-rl/policy-inspect',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    'Không thể kiểm tra phân phối chính sách mô hình',
  )
}

export async function apiAdminRunMicroBatch(
  batchSize: number = 128,
  klTargetMax: number = 0.02,
): Promise<MicroBatchTrainResponse> {
  return requestJson<MicroBatchTrainResponse>(
    '/api/v2/admin/online-rl/micro-batch',
    {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, kl_target_max: klTargetMax }),
    },
    'Không thể chạy lô tinh chỉnh Online RL',
  )
}

export async function apiAdminActivateModel(
  modelId: string,
  reason: string = 'Admin verified via Safety Gate',
): Promise<ModelSwitchResponse> {
  return requestJson<ModelSwitchResponse>(
    `/api/v2/admin/models/${encodeURIComponent(modelId)}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
    'Không thể kích hoạt mô hình',
  )
}

export async function apiAdminRollbackModel(
  reason: string = 'Rollback from Admin Console',
): Promise<ModelSwitchResponse> {
  return requestJson<ModelSwitchResponse>(
    '/api/v2/admin/models/rollback',
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
    'Không thể khôi phục phiên bản trước',
  )
}

export async function apiAdminTriggerOutboxRelay(): Promise<ManualOutboxRelayResponse> {
  return requestJson<ManualOutboxRelayResponse>(
    '/api/v2/admin/outbox/relay',
    { method: 'POST' },
    'Không thể kích hoạt đồng bộ hàng đợi Outbox',
  )
}

export async function apiAdminGetStreamsDlq(limit: number = 50): Promise<StreamsDlqResponse> {
  return requestJson<StreamsDlqResponse>(
    `/api/v2/admin/streams/dlq?limit=${limit}`,
    {},
    'Không thể tải hàng đợi lỗi Dead-Letter Queue',
  )
}

export async function apiAdminGetSystemHealth(): Promise<SystemHealthResponse> {
  return requestJson<SystemHealthResponse>(
    '/api/v2/admin/system-health',
    {},
    'Không thể tải sức khỏe cụm dịch vụ',
  )
}


export async function apiAdminGetRlAnalytics(params?: {
  domainSlug?: string
  userId?: string
  limit?: number
}): Promise<AdminRlAnalyticsResponse> {
  const qs = new URLSearchParams()
  if (params?.domainSlug) qs.set('domain_slug', params.domainSlug)
  if (params?.userId) qs.set('user_id', params.userId)
  if (params?.limit) qs.set('limit', String(params.limit))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return requestJson<AdminRlAnalyticsResponse>(
    `/api/v2/admin/rl-analytics${suffix}`,
    {},
    'Không thể tải dữ liệu giám sát RL Production',
  )
}
