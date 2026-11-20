import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Layers,
  Lock,
  RefreshCw,
  Server,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { apiAdminGetSystemHealth } from '../api'
import type { ActiveView, SystemHealthResponse } from '../types'

interface AdminSystemHealthPageProps {
  onNavigate: (view: ActiveView) => void
}

const SERVICE_META: Record<
  string,
  { label: string; port: string; schema: string; role: string }
> = {
  auth: {
    label: 'user-auth-service',
    port: '8001',
    schema: 'auth_svc',
    role: 'Argon2id + Session & RBAC',
  },
  content_kg: {
    label: 'content-kg-service',
    port: '8002',
    schema: 'content_svc',
    role: 'Kahn DAG + Multi-Domain KG',
  },
  assessment_grader: {
    label: 'assessment-grader-service',
    port: '8003',
    schema: 'assess_svc',
    role: 'Sandbox Worker + Rubric Grader',
  },
  recommendation_ai: {
    label: 'recommendation-ai-service',
    port: '8004',
    schema: 'rec_ai_svc',
    role: 'Masked GNN-PPO + Policy Guardrail',
  },
}

export function AdminSystemHealthPage({ onNavigate }: AdminSystemHealthPageProps) {
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
  const healthyCount = serviceEntries.filter(([, st]) => st.toLowerCase() === 'healthy' || st.toLowerCase() === 'ok' || st.toLowerCase() === 'up').length

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6"
      data-testid="scr20-admin-health"
    >
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] uppercase tracking-wider">
            <Server className="w-4 h-4" aria-hidden="true" />
            Cổng Admin — Giám sát 4 Microservices, Outbox &amp; Redis Streams (SCR-20)
          </span>
          <h1 className="text-xl font-extrabold text-[#14241B] mt-1">
            Sức khỏe Cụm Dịch vụ Phân tán &amp; Hạ tầng
          </h1>
          {lastUpdated && (
            <p className="text-xs text-[#57534E] mt-0.5 font-mono">
              Cập nhật lúc {lastUpdated} • Độ trễ API thực tế: {latencyMs ?? 0} ms
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate('admin_online_rl')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-[#F6F8F5] text-[#14241B] hover:border-[#15803D] cursor-pointer"
          >
            <Activity className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            Online RL Monitor
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin_registry')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-[#F6F8F5] text-[#14241B] hover:border-[#15803D] cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            Safety Gate
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#166534] disabled:opacity-50 text-white cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            Làm mới Trạng thái Cụm Dịch vụ
          </button>
        </div>
      </div>

      {loading && !health && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white border border-[#D8E2D8] animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1 rounded-lg bg-white border border-[#FECACA] text-[#991B1B] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {health && (
        <>
          {/* 4 Top Overview Key Metric Cards (100% Real Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#D8E2D8] shadow-2xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                  Microservices Online
                </span>
                <Server className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#14241B] font-mono">
                  {healthyCount} / {serviceEntries.length}
                </span>
                <span className="text-xs font-bold text-[#15803D]">
                  {health.schemas_isolated ? 'Schema Isolated' : 'Shared'}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#D8E2D8] shadow-2xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                  Độ trễ Redis Streams
                </span>
                <Zap className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-2xl font-extrabold font-mono ${
                    health.redis_stream_lag_ms > 500 ? 'text-[#B45309]' : 'text-[#0F766E]'
                  }`}
                >
                  {health.redis_stream_lag_ms} ms
                </span>
                <span className="text-xs text-[#57534E]">Mục tiêu &lt; 500ms</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#D8E2D8] shadow-2xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                  Hàng đợi Outbox
                </span>
                <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#14241B] font-mono">
                  {health.outbox_pending_count}
                </span>
                <span className="text-xs text-[#57534E]">bản ghi chờ</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#D8E2D8] shadow-2xs flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                  Graph Cache Hit Rate
                </span>
                <Database className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[#15803D] font-mono">
                  {Math.round(health.graph_cache_hit_rate * 100)}%
                </span>
                <span className="text-xs text-[#57534E]">
                  {health.redis_connected ? 'Redis Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* 4 Microservices Health & Schema Ownership Cards */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold text-[#14241B]">
                Trạng thái Cụm 4 Microservices &amp; Schema Ownership
              </h2>
              <span className="text-xs font-mono text-[#57534E]">
                Strict Database Isolation • Không Cross-Schema JOIN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {serviceEntries.map(([svc, st]) => {
                const meta = SERVICE_META[svc] ?? {
                  label: svc,
                  port: '—',
                  schema: svc,
                  role: 'Microservice',
                }
                const isUp = ['healthy', 'ok', 'up'].includes(st.toLowerCase())
                return (
                  <div
                    key={svc}
                    className="bg-white p-5 rounded-2xl border border-[#D8E2D8] shadow-2xs flex flex-col justify-between gap-3.5"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#F6F8F5] border border-[#D8E2D8] text-[#57534E]">
                          Port {meta.port}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            isUp
                              ? 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]'
                              : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          {st.toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-sm font-extrabold text-[#14241B] font-mono">
                        {meta.label}
                      </h3>
                      <p className="text-xs text-[#57534E]">{meta.role}</p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] flex items-center justify-between text-xs font-mono">
                      <span className="text-[#57534E]">DB Schema:</span>
                      <span className="text-[#15803D] font-bold inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" aria-hidden="true" />
                        {meta.schema}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Deep Telemetry Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] space-y-2.5 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                PostgreSQL 16 Schema Isolation &amp; Transactional Outbox
              </div>
              <div className="text-sm font-extrabold text-[#15803D]">
                {health.schemas_isolated
                  ? '4 Schema Cô lập: auth_svc, content_svc, assess_svc, rec_ai_svc'
                  : 'Chưa cô lập'}
              </div>
              <div className="text-xs text-[#3F5247] font-mono">
                Outbox Pending Events: <strong>{health.outbox_pending_count}</strong> • INV-OUTBOX-01
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] space-y-2.5 shadow-2xs">
              <div className="text-xs font-bold uppercase tracking-wider text-[#57534E]">
                Redis 7 Streams &amp; Graph-State Cache
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#3F5247]">Redis Streams Lag (mục tiêu &lt; 500ms):</span>
                <strong
                  className={`font-mono ${
                    health.redis_stream_lag_ms > 500 ? 'text-[#B45309]' : 'text-[#15803D]'
                  }`}
                >
                  {health.redis_stream_lag_ms} ms
                </strong>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#3F5247]">Graph Cache Hit Rate:</span>
                  <strong className="text-[#15803D] font-mono">
                    {Math.round(health.graph_cache_hit_rate * 100)}%
                  </strong>
                </div>
                <div className="w-full h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full bg-[#15803D] rounded-full"
                    style={{ width: `${Math.round(health.graph_cache_hit_rate * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
