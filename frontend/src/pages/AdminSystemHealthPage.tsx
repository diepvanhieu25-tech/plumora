import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Layers,
  Lock,
  RefreshCw,
  Zap,
} from 'lucide-react'
import { apiAdminGetSystemHealth } from '../api'
import type { SystemHealthResponse } from '../types'

const SERVICE_META: Array<{
  key: string
  order: string
  label: string
  port: string
  schema: string
  role: string
  outboxEvent: string
}> = [
  {
    key: 'auth',
    order: '1',
    label: 'user-auth-service',
    port: '8001',
    schema: 'auth_svc',
    role: 'Argon2id + HttpOnly Session & RBAC',
    outboxEvent: 'UserRegisteredEvent',
  },
  {
    key: 'content_kg',
    order: '2',
    label: 'content-kg-service',
    port: '8002',
    schema: 'content_svc',
    role: 'Kahn Topological DAG (Multi-Domain)',
    outboxEvent: 'DomainGraphPublishedEvent',
  },
  {
    key: 'assessment_grader',
    order: '3',
    label: 'assessment-grader-service',
    port: '8003',
    schema: 'assess_svc',
    role: 'Sandbox Worker + Rubric Grader',
    outboxEvent: 'CompetencyUpdatedEvent',
  },
  {
    key: 'recommendation_ai',
    order: '4',
    label: 'recommendation-ai-service',
    port: '8004',
    schema: 'rec_ai_svc',
    role: 'Masked GNN-PPO + Policy Guardrail',
    outboxEvent: 'CandidateModelReadyEvent',
  },
]

function isServiceHealthy(status: string | undefined): boolean {
  if (!status) return false
  const s = status.toLowerCase()
  return s === 'healthy' || s === 'ok' || s === 'up' || s === 'monolith_embedded'
}

export function AdminSystemHealthPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const serviceEntries = health ? Object.entries(health.services) : []
  const healthyCount = serviceEntries.filter(([, st]) => isServiceHealthy(st)).length
  const totalServices = Math.max(serviceEntries.length, SERVICE_META.length)

  return (
    <section
      className="w-full px-4 sm:px-6 lg:px-10 py-6 space-y-8 max-w-[1720px] mx-auto"
      data-testid="scr20-admin-health"
    >
      {/* Section 1: Breadcrumb & Page Header (Stitch SCR-20) */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-6 pb-6 border-b border-surface-container-high">
        <div className="space-y-2">
          <nav
            aria-label="Breadcrumbs"
            className="flex items-center gap-2 text-xs font-label text-on-surface-variant flex-wrap"
          >
            <span>Quản trị Hệ thống</span>
            <span className="text-outline-variant font-mono">/</span>
            <span>Kiến trúc Phân tán</span>
            <span className="text-outline-variant font-mono">/</span>
            <span className="text-primary font-medium">
              Cụm 4 Microservices &amp; Outbox Health (SCR-20)
            </span>
          </nav>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
              Giám sát Cụm 4 Microservices, Transactional Outbox &amp; Hạ tầng K8s
            </h1>
            {health && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium ${
                  healthyCount === totalServices
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-[#FFFBEB] text-[#92400E]'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {healthyCount}/{totalServices} Ready
              </span>
            )}
          </div>

          <p className="text-sm text-on-surface-variant font-body max-w-4xl">
            Kiểm soát tính độc lập Database Schema, Độ trễ Redis Streams Event Bus, Idempotency và Trạng thái hạ tầng theo chuẩn Kiến trúc Phân tán Plumora.
          </p>
          {lastUpdated && (
            <p className="text-xs text-on-surface-variant font-label">
              Cập nhật lúc <span className="font-mono">{lastUpdated}</span> • Độ trễ API thực tế:{' '}
              <span className="font-mono">{latencyMs ?? 0} ms</span>
            </p>
          )}
        </div>

        {/* Right Header Action Group */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 px-4 min-h-[44px] sm:min-h-[38px] rounded-lg bg-primary hover:bg-primary-dim text-on-primary font-medium text-xs shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Làm mới Trạng thái</span>
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && !loading && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#FECACA] text-[#991B1B] hover:bg-[#FEE2E2] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 rounded-xl bg-surface-container-lowest border border-outline-variant/20 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Section 2: Top Overview Key Metric Cards */}
      {!loading && health && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1 */}
            <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant">
                  Tổng số Microservices
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <Layers className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-bold text-on-surface tracking-tight">
                    {healthyCount} / {totalServices}
                  </span>
                  <span className="text-xs font-semibold text-primary">Active</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Trạng thái kết nối các module dịch vụ
                </p>
              </div>
              <div className="pt-3 border-t border-surface-container flex items-center justify-between text-[11px] font-mono">
                <span className="text-on-surface-variant">Multi-Schema</span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    health.schemas_isolated
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-[#FFFBEB] text-[#92400E]'
                  }`}
                >
                  {health.schemas_isolated ? 'Schema Isolated' : 'Unverified'}
                </span>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant">
                  Độ trễ Redis Streams
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                  <Zap className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-bold text-secondary tracking-tight">
                    {health.redis_stream_lag_ms}ms
                  </span>
                  <span className="text-xs font-semibold text-secondary">Consumer Lag</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  {health.redis_connected
                    ? 'Redis 7 đã kết nối ổn định'
                    : 'Redis mất kết nối — chạy fallback'}
                </p>
              </div>
              <div className="pt-3 border-t border-surface-container flex items-center justify-between text-[11px] font-mono">
                <span className="text-on-surface-variant">Realtime Event Bus</span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold ${
                    health.redis_connected
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-[#FEE2E2] text-[#991B1B]'
                  }`}
                >
                  {health.redis_connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant">
                  Hàng đợi Outbox Tồn đọng
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <FileText className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-bold text-on-surface tracking-tight">
                    {health.outbox_pending_count}
                  </span>
                  <span className="text-xs font-semibold text-primary">bản ghi</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Transactional Outbox đồng bộ sự kiện
                </p>
              </div>
              <div className="pt-3 border-t border-surface-container flex items-center justify-between text-[11px] font-mono">
                <span className="text-on-surface-variant">Invariant Rule</span>
                <span className="px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-semibold">
                  INV-OUTBOX-01
                </span>
              </div>
            </div>

            {/* Card 4 */}
            <div className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant">
                  Cache Hit Graph-State
                </span>
                <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
                  <BarChart3 className="w-4 h-4" aria-hidden="true" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-headline font-bold text-on-surface tracking-tight">
                    {(health.graph_cache_hit_rate * 100).toFixed(1)}%
                  </span>
                  <span className="text-xs font-semibold text-tertiary">Cache Rate</span>
                </div>
                <p className="text-xs text-on-surface-variant mt-1">
                  Tỷ lệ trúng bộ nhớ đệm Redis Graph State
                </p>
              </div>
              <div className="pt-3 border-t border-surface-container flex items-center justify-between text-[11px] font-mono">
                <span className="text-on-surface-variant">API Latency</span>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">
                  {latencyMs ?? 0}ms
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: 4 Microservices Health & Schema Ownership Cards */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-headline font-bold text-on-surface">
                  Trạng thái Cụm 4 Microservices &amp; Schema Ownership
                </h2>
                <span className="text-xs font-mono text-on-surface-variant">
                  (Strict Database Isolation • Không Cross-Schema JOIN)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {SERVICE_META.map((svc) => {
                const rawStatus = health.services[svc.key] ?? 'unknown'
                const ok = isServiceHealthy(rawStatus)
                return (
                  <div
                    key={svc.key}
                    className="p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-surface-container text-on-surface-variant">
                          Port {svc.port}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                            ok
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-[#FEE2E2] text-[#991B1B]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              ok ? 'bg-primary animate-pulse' : 'bg-[#9F1239]'
                            }`}
                          />
                          {rawStatus.toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-base font-headline font-bold text-on-surface">
                          {svc.order}. {svc.label}
                        </h3>
                        <p className="text-xs font-body text-on-surface-variant mt-0.5">
                          {svc.role}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-surface-container-low space-y-2">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-on-surface-variant font-label">DB Schema:</span>
                        <span className="font-mono text-primary font-semibold flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          {svc.schema}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-on-surface-variant truncate">
                      <span className="text-on-surface font-medium">Outbox:</span> {svc.outboxEvent}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section 4: Transactional Outbox & Infrastructure Summary */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <div className="xl:col-span-7 p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-surface-container">
                <div>
                  <h2 className="text-base font-headline font-bold text-on-surface">
                    Bảng Giám sát Transactional Outbox &amp; Redis Streams Event Bus
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    Bảo toàn tính nhất quán eventual consistency giữa các dịch vụ (No Distributed 2PC).
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container text-xs font-mono text-on-surface shrink-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      health.redis_connected ? 'bg-primary' : 'bg-[#9F1239]'
                    }`}
                  />
                  Redis 7 Streams
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] font-mono text-on-surface-variant border-b border-surface-container uppercase">
                      <th className="py-3 px-3">Sự kiện &amp; Luồng đi</th>
                      <th className="py-3 px-2 text-center">Pending Outbox</th>
                      <th className="py-3 px-2 text-center">Stream Lag</th>
                      <th className="py-3 px-3 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container text-xs font-mono">
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-on-surface">CompetencyUpdatedEvent</div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <span className="text-primary font-medium">assess_svc</span>
                          <span>-&gt;</span>
                          <span className="text-secondary font-medium">rec_ai_svc</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                          {health.outbox_pending_count}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center text-primary font-semibold">
                        {health.redis_stream_lag_ms}ms
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-container text-on-primary-container font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          Active
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-on-surface">DomainGraphPublishedEvent</div>
                        <div className="text-[11px] text-on-surface-variant flex items-center gap-1 mt-0.5">
                          <span className="text-primary font-medium">content_svc</span>
                          <span>-&gt;</span>
                          <span className="text-secondary font-medium">rec_ai_svc</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 text-center">
                        <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-semibold">
                          0
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-center text-primary font-semibold">
                        {health.redis_stream_lag_ms}ms
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container font-semibold text-[11px]">
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          Synced
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-5 p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Database className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-base font-headline font-bold text-on-surface">
                    Cô lập Schema &amp; Hạ tầng Kubernetes
                  </h2>
                  <p className="text-xs text-on-surface-variant">
                    Khai báo sẵn trong <code className="font-mono">k8s/</code> &amp; Docker Compose profiles
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 text-xs font-mono bg-surface-container-low p-4 rounded-xl">
                <div className="flex justify-between items-center py-1">
                  <span className="text-on-surface-variant font-label">4-Schema Isolation:</span>
                  <span className="font-bold text-primary">
                    {health.schemas_isolated ? 'Verified (4 schemas)' : 'Degraded'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-on-surface-variant font-label">Redis State Cache:</span>
                  <span className="font-bold text-on-surface">
                    {health.redis_connected ? 'Connected' : 'Fallback'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-on-surface-variant font-label">Sandbox Network Policy:</span>
                  <span className="font-bold text-on-surface">k8s/network-policy.yaml</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-on-surface-variant font-label">Auto-scaling (HPA):</span>
                  <span className="font-bold text-on-surface">k8s/hpa.yaml</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
