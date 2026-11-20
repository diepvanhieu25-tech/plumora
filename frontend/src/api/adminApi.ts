import type { OnlineRlStatusResponse, SystemHealthResponse } from '../types'
import { requestJson } from './httpClient'

export async function apiAdminGetOnlineRlStatus(): Promise<OnlineRlStatusResponse> {
  return requestJson('/api/v2/admin/online-rl/status', {}, 'Không thể tải trạng thái Online RL')
}

export async function apiAdminRunMicroBatch(
  batchSize: number = 128,
  klTargetMax: number = 0.02,
): Promise<Record<string, unknown>> {
  return requestJson(
    '/api/v2/admin/online-rl/micro-batch',
    {
      method: 'POST',
      body: JSON.stringify({ batch_size: batchSize, kl_target_max: klTargetMax }),
    },
    'Không thể chạy lô Online RL',
  )
}

export async function apiAdminActivateModel(modelId: string): Promise<Record<string, unknown>> {
  return requestJson(
    `/api/v2/admin/models/${modelId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify({ reason: 'Admin verified via Safety Gate UI' }),
    },
    'Không thể kích hoạt mô hình',
  )
}

export async function apiAdminRollbackModel(): Promise<Record<string, unknown>> {
  return requestJson(
    '/api/v2/admin/models/rollback',
    {
      method: 'POST',
      body: JSON.stringify({ reason: '1-Click Rollback from Admin UI' }),
    },
    'Không thể rollback mô hình',
  )
}

export async function apiAdminGetSystemHealth(): Promise<SystemHealthResponse> {
  return requestJson('/api/v2/admin/system-health', {}, 'Không thể tải sức khỏe cụm dịch vụ')
}
