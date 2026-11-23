import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react'
import {
  apiAdminGetStreamsDlq,
  apiAdminGetSystemHealth,
  apiAdminTriggerOutboxRelay,
} from '../api'
import type {
  ManualOutboxRelayResponse,
  StreamsDlqResponse,
  SystemHealthResponse,
} from '../types/admin'

const SERVICE_META: Array<{
  key: string
  order: string
  label: string
  port: string
  schema: string
  role: string
}> = [
  {
    key: 'auth',
    order: '1',
    label: 'user-auth-service',
    port: '8001',
    schema: 'auth_svc',
    role: 'Xác thực Argon2id, HttpOnly Session & RBAC',
  },
  {
    key: 'content_kg',
    order: '2',
    label: 'content-kg-service',
    port: '8002',
    schema: 'content_svc',
    role: 'Đồ thị Kiến thức Đa lĩnh vực, Câu hỏi 5 tầng & Rubric',
  },
  {
    key: 'assessment_grader',
    order: '3',
    label: 'assessment-grader-service',
    port: '8003',
    schema: 'assess_svc',
    role: '5-Depth State Machine, Code Sandbox Worker & Ebbinghaus',
  },
  {
    key: 'recommendation_ai',
    order: '4',
    label: 'recommendation-ai-service',
    port: '8004',
    schema: 'rec_ai_svc',
    role: 'Suy luận GNN-PPO, Policy Guardrail & Safe Online RL',
  },
]

function isServiceHealthy(status: string | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === 'healthy' || s === 'ok' || s === 'up' || s === 'in_process' || s === 'monolith_embedded'
}

export function AdminSystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Actionable Ops Controls: Manual Outbox Relay & DLQ Inspector
  const [relaying, setRelaying] = useState(false)
  const [relayStats, setRelayStats] = useState<ManualOutboxRelayResponse | null>(null)
  const [loadingDlq, setLoadingDlq] = useState(false)
  const [dlqData, setDlqData] = useState<StreamsDlqResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const t0 = performance.now()
    try {
      const data = await apiAdminGetSystemHealth()
      setHealth(data)
      setLatencyMs(Math.round(performance.now() - t0))
      setLastUpdated(new Date().toLocaleTimeString('vi-VN'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kết nối tới cụm dịch vụ')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRelayOutbox() {
    setRelaying(true)
    setError(null)
    try {
      const res = await apiAdminTriggerOutboxRelay()
      setRelayStats(res)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đẩy bù sự kiện Outbox')
    } finally {
      setRelaying(false)
    }
  }

  async function handleInspectDlq() {
    setLoadingDlq(true)
    setError(null)
    try {
      const res = await apiAdminGetStreamsDlq(50)
      setDlqData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi đọc Dead-Letter Queue')
    } finally {
      setLoadingDlq(false)
    }
  }

  const serviceEntries = health ? Object.entries(health.services) : []
  const healthyCount = serviceEntries.filter(([, st]) => isServiceHealthy(st)).length
  const totalServices = Math.max(serviceEntries.length, SERVICE_META.length)
  const outboxByType = health?.outbox_pending_by_event_type ?? {}
  const streamLengths = health?.stream_lengths_by_event_type ?? {}
  const eventTypes = Array.from(
    new Set(['CompetencyUpdatedEvent', 'DomainGraphUpdatedEvent', ...Object.keys(outboxByType)]),
  )

  return (
    <section
      className="w-full space-y-6 text-[#14241B]"
      data-testid="scr20-admin-health"
    >
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
            Giám sát Hạ tầng, 4 Microservices &amp; Transactional Outbox / DLQ
          </h1>
          <p className="text-xs text-[#3F5247] mt-1">
            Dữ liệu thăm dò trực tiếp từ CSDL, Redis Streams và các dịch vụ thành phần — kèm công cụ đẩy bù Outbox và thanh tra DLQ.
          </p>
          {lastUpdated && (
            <p className="text-[11px] font-mono text-[#57534E] mt-1">
              Cập nhật lúc {lastUpdated} • Độ trễ API: {latencyMs ?? 0}ms
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={relaying}
            onClick={() => void handleRelayOutbox()}
            data-testid="trigger-outbox-relay-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
          >
            {relaying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Đẩy bù Outbox (Relay)</span>
          </button>

          <button
            type="button"
            disabled={loadingDlq}
            onClick={() => void handleInspectDlq()}
            data-testid="inspect-dlq-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FFFBEB] border border-[#F59E0B] text-[#78350F] hover:bg-[#FEF3C7] text-xs font-bold cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
            <span>Kiểm tra DLQ ({health?.dlq_count ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] hover:bg-[#F0FDF4] text-xs font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {relayStats && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-mono text-[#14532D] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
          <span>
            Outbox Relay hoàn tất: relayed={relayStats.relayed}, consumed={relayStats.consumed},
            acked={relayStats.acked}, reclaimed={relayStats.reclaimed}, dlq={relayStats.dlq}.
          </span>
        </div>
      )}

      {!loading && health && (
        <>
          {/* 4 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">
                  {health.mode === 'monolith' ? 'Chế độ Monolith' : 'Cụm Microservices'}
                </span>
                <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono">
                {healthyCount} / {totalServices}
              </div>
              <div className="text-[11px] font-mono text-[#57534E]">
                CSDL: <strong>{health.db_dialect ?? 'unknown'}</strong> • Cô lập 4 schema:{' '}
                <strong className={health.schemas_isolated ? 'text-[#15803D]' : 'text-[#D97706]'}>
                  {health.schemas_isolated ? 'Verified (PostgreSQL)' : 'Chưa bật cô lập'}
                </strong>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Redis Streams &amp; Độ trễ</span>
                <Zap className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#0D9488]">
                {health.redis_stream_lag_ms >= 0 ? `${health.redis_stream_lag_ms}ms` : 'N/A'}
              </div>
              <div className="text-[11px] font-mono text-[#57534E]">
                {health.redis_connected ? 'Redis Connected' : 'Redis Disconnected'} • p95 C2C:{' '}
                {health.outbox_commit_to_consume_p95_ms != null
                  ? `${health.outbox_commit_to_consume_p95_ms}ms`
                  : '--'}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Outbox Tồn đọng &amp; DLQ</span>
                <FileText className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono">
                {health.outbox_pending_count >= 0 ? health.outbox_pending_count : 'Unknown'}
              </div>
              <div className="text-[11px] font-mono text-[#57534E]">
                Bản tin lỗi DLQ:{' '}
                <strong className={(health.dlq_count ?? 0) > 0 ? 'text-[#9F1239]' : 'text-[#15803D]'}>
                  {health.dlq_count ?? 0}
                </strong>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Graph-State Cache Hit</span>
                <BarChart3 className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono">
                {(health.graph_cache_hit_rate * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] font-mono text-[#57534E]">
                RL Checkpoint:{' '}
                <strong className={health.rl_checkpoint_verified ? 'text-[#15803D]' : 'text-[#9F1239]'}>
                  {health.rl_checkpoint_verified ? 'SHA-256 OK' : 'Missing / Fallback'}
                </strong>
              </div>
            </div>
          </div>

          {/* 4 Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SERVICE_META.map((svc) => {
              const rawStatus = health.services[svc.key] ?? 'unknown'
              const ok = isServiceHealthy(rawStatus)
              return (
                <div
                  key={svc.key}
                  className="p-4 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-[#F6F8F5] text-[#57534E]">
                      Port {svc.port}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        ok ? 'bg-[#DCFCE7] text-[#14532D]' : 'bg-[#FFF1F2] text-[#9F1239]'
                      }`}
                    >
                      {rawStatus.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#14241B]">
                      {svc.order}. {svc.label}
                    </h2>
                    <p className="text-xs text-[#57534E] mt-0.5">{svc.role}</p>
                  </div>
                  <div className="pt-2 border-t border-[#E7EFE7] flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[#57534E]">Schema:</span>
                    <span className="font-bold text-[#15803D] inline-flex items-center gap-1">
                      <Database className="w-3 h-3" aria-hidden="true" />
                      {svc.schema}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Real Per-Event-Type Outbox & Redis Streams Table (ZERO hardcoded events) */}
          <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-extrabold text-[#14241B]">
              Thống kê Thực tế Transactional Outbox &amp; Redis Streams theo Loại Sự kiện
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#F6F8F5] text-[#57534E] uppercase text-[11px]">
                    <th className="py-2.5 px-3">Loại Sự kiện (event_type)</th>
                    <th className="py-2.5 px-3 text-center">Outbox Pending (DB)</th>
                    <th className="py-2.5 px-3 text-center">Độ dài Redis Stream</th>
                    <th className="py-2.5 px-3 text-right">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFE7]">
                  {eventTypes.map((evType) => {
                    const pending = outboxByType[evType] ?? 0
                    const streamLen = streamLengths[evType] ?? 0
                    return (
                      <tr key={evType} className="hover:bg-[#F6F8F5]">
                        <td className="py-2.5 px-3 font-bold text-[#14241B]">{evType}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-bold ${
                              pending > 0
                                ? 'bg-[#FFFBEB] text-[#B45309]'
                                : 'bg-[#F0FDF4] text-[#14532D]'
                            }`}
                          >
                            {pending}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">{streamLen}</td>
                        <td className="py-2.5 px-3 text-right">
                          {pending === 0 ? (
                            <span className="text-[#15803D] font-bold">Đã đồng bộ</span>
                          ) : (
                            <span className="text-[#D97706] font-bold">Đang chờ Relay</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* DLQ Inspector Panel */}
          {dlqData && (
            <div
              className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-3"
              data-testid="dlq-inspector-panel"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold text-[#14241B]">
                  Thanh tra Hàng đợi Lỗi Dead-Letter Queue ({dlqData.dlq_count} bản tin)
                </h2>
                <span className="text-[11px] font-mono text-[#57534E]">
                  Redis: {dlqData.redis_connected ? 'Connected' : 'Offline'}
                </span>
              </div>
              {dlqData.entries.length === 0 ? (
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#14532D]">
                  Không có bản tin lỗi nào trong Dead-Letter Queue.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {dlqData.entries.map((entry) => (
                    <div
                      key={`${entry.stream}-${entry.msg_id}`}
                      className="p-3 rounded-xl bg-[#FFF1F2]/60 border border-[#FDA4AF] text-[11px] font-mono space-y-1"
                    >
                      <div className="flex justify-between font-bold text-[#9F1239]">
                        <span>{entry.stream}</span>
                        <span>{entry.msg_id}</span>
                      </div>
                      <pre className="text-[10px] text-[#3F5247] whitespace-pre-wrap break-all">
                        {JSON.stringify(entry.fields, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
