import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
} from 'lucide-react'
import {
  apiAdminActivateModel,
  apiAdminGetOnlineRlStatus,
  apiAdminRollbackModel,
} from '../api'
import type { ActiveView, OnlineRlStatusResponse } from '../types'

interface AdminModelRegistryPageProps {
  onNavigate: (view: ActiveView) => void
}

const PAGE_SIZE = 10

export function AdminModelRegistryPage({ onNavigate }: AdminModelRegistryPageProps) {
  const [status, setStatus] = useState<OnlineRlStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'PASSED' | 'BLOCKED'>('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  async function load() {
    setLoading(true)
    setErr(null)
    try {
      setStatus(await apiAdminGetOnlineRlStatus())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải Model Registry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filteredModels = useMemo(() => {
    const models = status?.models ?? []
    const q = query.trim().toLowerCase()
    return models.filter((m) => {
      if (verdictFilter !== 'ALL' && m.gate_verdict !== verdictFilter) return false
      if (
        q &&
        !m.version_tag.toLowerCase().includes(q) &&
        !m.checkpoint_sha256.toLowerCase().includes(q)
      ) {
        return false
      }
      return true
    })
  }, [status, verdictFilter, query])

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedModels = filteredModels.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function handleActivate(id: string) {
    setErr(null)
    setMsg(null)
    try {
      const res = await apiAdminActivateModel(id)
      setMsg(`Đã kích hoạt Checkpoint mới (${String(res.switch_latency_ms)}ms).`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không thể kích hoạt Checkpoint')
    }
  }

  async function handleRollback() {
    setErr(null)
    setMsg(null)
    try {
      const res = await apiAdminRollbackModel()
      setMsg(`Đã Rollback 1-Click thành công trong ${String(res.switch_latency_ms)}ms.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi Rollback')
    }
  }

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-5"
      data-testid="scr19-admin-registry"
    >
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            Cổng Admin — Safety Evaluation Gate &amp; 1-Click Rollback (SCR-19)
          </span>
          <h1 className="text-xl font-extrabold text-[#14241B] mt-1">
            Kiểm định An toàn Mô hình &amp; Điều phối Model Registry ({filteredModels.length} phiên
            bản)
          </h1>
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
            onClick={() => onNavigate('admin_health')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-[#F6F8F5] text-[#14241B] hover:border-[#15803D] cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
            Microservices
          </button>
          <button
            type="button"
            onClick={() => void handleRollback()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B] hover:bg-[#FEF3C7] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            1-Click Rollback
          </button>
        </div>
      </div>

      {/* Active Prod Banner */}
      {status?.active_model && (
        <div className="bg-[#F0FDF4] border border-[#86EFAC] border-l-4 border-l-[#16A34A] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-2xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]">
                SAFETY GATE: {status.active_model.gate_verdict}
              </span>
              <span className="text-xs font-bold text-[#15803D]">
                Active Production Checkpoint (Serving GNN-PPO)
              </span>
            </div>
            <div className="text-base font-extrabold text-[#14241B] font-mono">
              {status.active_model.version_tag}
            </div>
            <div className="text-xs font-mono text-[#3F5247]">
              SHA-256: {status.active_model.checkpoint_sha256.slice(0, 24)}… • KL-Divergence:{' '}
              {status.active_model.kl_divergence} (Ngưỡng &le; {status.kl_target_max})
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white border border-[#BBF7D0] text-xs font-mono font-bold text-[#15803D]">
              Experience Buffer: {status.buffer_count} mẫu
            </span>
          </div>
        </div>
      )}

      {err && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      )}
      {msg && (
        <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#14532D] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{msg}</span>
        </div>
      )}

      {/* 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Safety Gate Comparison Table & Protocol */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white rounded-2xl border border-[#D8E2D8] shadow-2xs overflow-hidden">
            <div className="p-5 bg-[#F6F8F5] border-b border-[#D8E2D8] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-extrabold text-[#14241B]">
                  Bảng Đối chiếu Safety Evaluation Gate &amp; KL-Divergence
                </h2>
                <p className="text-xs text-[#57534E] mt-0.5">
                  Khóa cứng kích hoạt nếu Checkpoint chưa vượt qua Safety Gate (INV-ONLINE-RL-01).
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-white border border-[#D8E2D8] text-[#15803D]">
                KL Limit &le; {status?.kl_target_max ?? 0.02}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F6F8F5] text-[#57534E] font-mono uppercase text-[10px] border-b border-[#D8E2D8]">
                    <th className="py-3 px-4">Phiên bản</th>
                    <th className="py-3 px-3">KL-Div</th>
                    <th className="py-3 px-3">Safety Gate</th>
                    <th className="py-3 px-4">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] font-mono">
                  {pagedModels.map((m) => (
                    <tr key={m.model_id} className={m.is_active ? 'bg-[#F0FDF4]/60' : ''}>
                      <td className="py-3 px-4 font-bold text-[#14241B]">{m.version_tag}</td>
                      <td className="py-3 px-3 text-[#3F5247]">{m.kl_divergence}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            m.gate_verdict === 'PASSED'
                              ? 'bg-[#DCFCE7] text-[#14532D]'
                              : 'bg-[#FEE2E2] text-[#991B1B]'
                          }`}
                        >
                          {m.gate_verdict}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {m.is_active ? (
                          <span className="text-[#15803D] font-bold">ACTIVE PROD</span>
                        ) : (
                          <span className="text-[#57534E]">STANDBY</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {pagedModels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-[#57534E] font-sans">
                        Chưa có dữ liệu checkpoint khớp bộ lọc.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Safe Rollback Protocol Box */}
          <div className="p-4 rounded-2xl bg-[#FFFBEB] border border-[#F59E0B] text-xs text-[#78350F] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <div className="font-extrabold text-[#92400E]">
                Quy chuẩn Khôi phục Tức thì (Safe Rollback Protocol &lt; 2000ms)
              </div>
              <p className="leading-relaxed">
                Khi nhấn 1-Click Rollback, hệ thống chuyển con trỏ Serving sang Checkpoint an toàn
                liền trước và ghi nhận audit log qua Transactional Outbox mà không làm gián đoạn
                phiên học của người dùng.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Immutable Model Registry & Controls */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Filter */}
          <div className="bg-white p-4 rounded-2xl border border-[#D8E2D8] space-y-3 shadow-2xs">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#57534E] absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Tìm theo version tag hoặc SHA-256..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5">
              {(['ALL', 'PASSED', 'BLOCKED'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => {
                    setVerdictFilter(filter)
                    setPage(1)
                  }}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    verdictFilter === filter
                      ? 'bg-[#15803D] text-white border-[#15803D]'
                      : 'bg-[#F6F8F5] text-[#57534E] border-[#D8E2D8] hover:text-[#14241B]'
                  }`}
                >
                  {filter === 'ALL' ? 'Tất cả' : filter}
                </button>
              ))}
            </div>
          </div>

          {loading && !status ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-24 rounded-2xl bg-white border border-[#D8E2D8] animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#D8E2D8] overflow-hidden shadow-2xs">
              <div className="divide-y divide-[#F1F5F9]">
                {pagedModels.map((m) => (
                  <div
                    key={m.model_id}
                    className={`p-4 space-y-2.5 ${m.is_active ? 'bg-[#F0FDF4]/40' : ''}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-extrabold text-sm text-[#14241B]">
                        {m.version_tag}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            m.gate_verdict === 'PASSED'
                              ? 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]'
                              : 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]'
                          }`}
                        >
                          SAFETY GATE: {m.gate_verdict}
                        </span>
                        {m.is_active && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#15803D] text-white">
                            ĐANG PHỤC VỤ
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs font-mono text-[#57534E]">
                      SHA-256: {m.checkpoint_sha256.slice(0, 16)}… • KL: {m.kl_divergence}
                    </p>

                    <button
                      type="button"
                      disabled={m.is_active || m.gate_verdict !== 'PASSED'}
                      onClick={() => void handleActivate(m.model_id)}
                      title={
                        m.gate_verdict !== 'PASSED'
                          ? 'Bị khóa: Checkpoint chưa vượt qua Safety Evaluation Gate'
                          : m.is_active
                            ? 'Checkpoint đang phục vụ'
                            : 'Kích hoạt Checkpoint này'
                      }
                      className="w-full py-2 px-3.5 rounded-xl text-xs font-bold bg-[#15803D] hover:bg-[#166534] disabled:bg-[#D8E2D8] disabled:text-[#57534E] text-white cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {m.is_active ? 'Đang phục vụ' : 'Kích hoạt Checkpoint Mới'}
                    </button>
                  </div>
                ))}
                {pagedModels.length === 0 && (
                  <div className="p-6 text-center text-xs text-[#57534E]">
                    Không có phiên bản mô hình nào khớp bộ lọc hiện tại.
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="px-4 py-3 bg-[#F6F8F5] border-t border-[#D8E2D8] flex items-center justify-between text-xs text-[#57534E]">
                  <span>
                    Trang {currentPage} / {totalPages}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1.5 rounded-lg border border-[#D8E2D8] bg-white disabled:opacity-40 cursor-pointer"
                      aria-label="Trang trước"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      disabled={currentPage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="p-1.5 rounded-lg border border-[#D8E2D8] bg-white disabled:opacity-40 cursor-pointer"
                      aria-label="Trang sau"
                    >
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
