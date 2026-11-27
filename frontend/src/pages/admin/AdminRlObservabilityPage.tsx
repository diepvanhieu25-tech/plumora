import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { apiAdminGetRlAnalytics } from '../../api'
import type { AdminRlAnalyticsResponse } from '../../types/admin'
import type { BackOfficeView } from '../../types/expert'

export interface AdminRlObservabilityPageProps {
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

const MODE_BADGE: Record<string, string> = {
  Learn_New: 'bg-[#F0FDF4] text-[#14532D] border-[#BBF7D0]',
  Deep_Probe: 'bg-[#EFF6FF] text-[#1E3A8A] border-[#BFDBFE]',
  Code_Practice: 'bg-[#F0FDFA] text-[#134E4A] border-[#99F6E4]',
  Spaced_Review: 'bg-[#FFFBEB] text-[#78350F] border-[#FDE68A]',
}

export function AdminRlObservabilityPage({ onNavigate }: AdminRlObservabilityPageProps) {
  const [data, setData] = useState<AdminRlAnalyticsResponse | null>(null)
  const [domainFilter, setDomainFilter] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const res = await apiAdminGetRlAnalytics({
        domainSlug: domainFilter || undefined,
        limit: 30,
      })
      setData(res)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải dữ liệu giám sát RL')
    } finally {
      setLoading(false)
    }
  }, [domainFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section
      className="w-full space-y-6 text-[#14241B]"
      data-testid="admin-rl-observability-page"
    >
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
            Giám sát Hoạt động Mô hình RL (Production Observability)
          </h1>
          <p className="text-xs text-[#3F5247] mt-1">
            Theo dõi trực tiếp phân bổ quyết định GNN-PPO, tần suất can thiệp Policy Guardrail, tỷ lệ Cache Hit và lịch sử thích ứng trên người học thật.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Lọc chuyên ngành"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] text-xs font-semibold text-[#14241B]"
          >
            <option value="">Tất cả chuyên ngành</option>
            <option value="backend">Backend</option>
            <option value="frontend">Frontend</option>
            <option value="devops">DevOps</option>
          </select>

          <button
            type="button"
            onClick={() => onNavigate('admin_online_rl')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white font-bold cursor-pointer"
          >
            <span>Vòng đời RL &amp; Safety Gate</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] hover:bg-[#F0FDF4] font-semibold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {err && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      )}

      {/* 4 Live Production KPIs */}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Tổng lượt đề xuất RL</span>
                <Activity className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#14241B]">
                {data.total_recommendations}
              </div>
              <p className="text-[11px] text-[#57534E]">
                Ghi nhận trực tiếp từ bảng rec_ai_svc.recommendation_logs
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Guardrail Can thiệp</span>
                <ShieldCheck className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#0D9488]">
                {(data.guardrail_intervention_rate * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-[#57534E]">
                Tỷ lệ mặt nạ tiên quyết/tuần tự điều chỉnh logit thô
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Tỷ lệ Fallback Rule</span>
                <AlertTriangle className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#D97706]">
                {(data.fallback_rate * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-[#57534E]">
                Thấp (0%) chứng tỏ GNN-PPO checkpoint phục vụ ổn định
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[#57534E]">
                <span className="font-bold uppercase">Redis State Cache Hit</span>
                <Zap className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-[#15803D]">
                {(data.redis_cache_hit_rate * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-[#57534E]">
                Tỷ lệ đọc trạng thái năng lực trực tiếp từ Redis Feature Store
              </p>
            </div>
          </div>

          {/* Distribution Charts: Learning Modes + Top Concepts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                <h2 className="text-sm font-extrabold">Phân bổ Chế độ học RL Đề xuất</h2>
              </div>
              {data.by_mode.length === 0 ? (
                <p className="text-xs text-[#57534E]">Chưa có dữ liệu đề xuất nào.</p>
              ) : (
                <div className="space-y-3">
                  {data.by_mode.map((item) => (
                    <div key={item.mode} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-bold">{item.mode}</span>
                        <span className="font-mono text-[#3F5247]">
                          {item.count} ({item.share_pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#E7EFE7] overflow-hidden">
                        <div
                          className="h-full bg-[#15803D] rounded-full"
                          style={{ width: `${Math.max(4, item.share_pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-7 bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
                <h2 className="text-sm font-extrabold">Top Khái niệm được RL Ưu tiên Đề xuất</h2>
              </div>
              {data.top_concepts.length === 0 ? (
                <p className="text-xs text-[#57534E]">Chưa có dữ liệu khái niệm.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {data.top_concepts.map((c) => (
                    <div
                      key={c.concept_slug}
                      className="p-2.5 rounded-xl bg-[#F6F8F5] border border-[#E7EFE7] flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-bold text-[#14241B] truncate">
                        {c.concept_slug}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#15803D] shrink-0">
                        {c.count} ({c.share_pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Live RL Decisions Audit Table */}
          <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold">Lịch sử Quyết định &amp; Thích ứng RL Gần nhất</h2>
              <span className="text-[11px] font-mono text-[#57534E]">
                Hiển thị {data.recent_decisions.length} bản ghi mới nhất
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#D8E2D8] text-[#57534E] uppercase text-[10px]">
                    <th className="py-2 px-3">Ngành</th>
                    <th className="py-2 px-3">Khái niệm đề xuất</th>
                    <th className="py-2 px-3">Chế độ</th>
                    <th className="py-2 px-3">Policy / Guardrail</th>
                    <th className="py-2 px-3">Nguồn State</th>
                    <th className="py-2 px-3">Checkpoint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E7EFE7]">
                  {data.recent_decisions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 px-3 text-center text-xs text-[#57534E]"
                      >
                        Chưa có log quyết định RL nào trong phạm vi lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    data.recent_decisions.map((row) => (
                      <tr key={row.id} className="hover:bg-[#F6F8F5]">
                        <td className="py-2.5 px-3 font-semibold">{row.domain_slug}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#14241B]">
                          {row.recommended_concept_slug ?? 'completed'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                              MODE_BADGE[row.recommended_mode ?? ''] ??
                              'bg-[#F6F8F5] text-[#57534E] border-[#D8E2D8]'
                            }`}
                          >
                            {row.recommended_mode ?? 'completed'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <span>{row.policy_source}</span>
                          {row.guardrail_applied && (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 text-[#0D9488] font-bold">
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                              masked
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#3F5247]">
                          {row.state_source}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-[#57534E]">
                          {row.checkpoint_sha256 ? row.checkpoint_sha256.slice(0, 8) : '--'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
