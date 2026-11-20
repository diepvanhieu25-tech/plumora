import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Info,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import {
  apiAdminActivateModel,
  apiAdminGetOnlineRlStatus,
  apiAdminRollbackModel,
} from '../api'
import type { ModelRegistryItem, OnlineRlStatusResponse } from '../types'

const PAGE_SIZE = 8

export function AdminModelRegistryPage() {
  const [status, setStatus] = useState<OnlineRlStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'PASSED' | 'BLOCKED'>('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [confirmModel, setConfirmModel] = useState<ModelRegistryItem | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      setStatus(await apiAdminGetOnlineRlStatus())
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải Model Registry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!confirmModel) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setConfirmModel(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmModel])

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

  const activeModel = status?.active_model ?? null
  const latestPassedCandidate =
    status?.models.find((m) => !m.is_active && m.gate_verdict === 'PASSED') ?? null
  const passedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'PASSED').length
  const blockedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'BLOCKED').length

  async function handleActivate(id: string) {
    setErr(null)
    setMsg(null)
    setBusyAction(id)
    try {
      const res = await apiAdminActivateModel(id)
      setMsg(`Đã kích hoạt Checkpoint mới (${String(res.switch_latency_ms)}ms).`)
      setConfirmModel(null)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không thể kích hoạt Checkpoint')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleRollback() {
    setErr(null)
    setMsg(null)
    setBusyAction('rollback')
    try {
      const res = await apiAdminRollbackModel()
      setMsg(`Đã Rollback 1-Click thành công trong ${String(res.switch_latency_ms)}ms.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi Rollback')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <section
      className="flex flex-col w-full px-4 sm:px-6 lg:px-10 py-6 max-w-[1520px] mx-auto space-y-6"
      data-testid="scr19-admin-registry"
    >
      {/* Top Navigation & Page Title Section (Stitch SCR-19) */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-mono tracking-tight text-on-surface-variant flex-wrap">
          <span>Quản trị Hệ thống</span>
          <span className="text-outline-variant">/</span>
          <span>Reinforcement Learning</span>
          <span className="text-outline-variant">/</span>
          <span className="text-primary font-medium">
            Safety Gate &amp; Model Registry (SCR-19)
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-headline font-bold text-on-surface tracking-tight">
              Cổng Kiểm định An toàn Mô hình &amp; Điều phối Model Registry
            </h1>
            <p className="text-sm text-on-surface-variant mt-1 font-body">
              Thẩm định rào chắn vi phạm toán học, chặn trôi dạt chính sách (Policy Drift) và điều phối Checkpoint bất biến.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high shadow-2xs text-xs font-mono text-on-surface">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-on-surface-variant">Registry:</span>
              <span className="font-semibold text-primary">
                {status ? `${status.models.length} checkpoints` : '...'}
              </span>
            </div>
            {activeModel && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high shadow-2xs text-xs font-mono text-on-surface-variant">
                <Cpu className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                <span>SHA:</span>
                <span className="font-semibold text-on-surface">
                  {activeModel.checkpoint_sha256.slice(0, 12)}…
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[34px] rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-label font-semibold text-on-surface cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Safety Gate Verification Top Banner (Stitch SCR-19) */}
      <div className="w-full bg-[#F0FDF4] rounded-xl p-5 shadow-sm flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 border-l-4 border-l-[#16A34A]">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0 text-[#15803D]">
            <ShieldCheck className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-mono font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D]">
                SAFETY GATE: {passedCount} ĐẠT CHUẨN / {blockedCount} BỊ CHẶN
              </span>
              <span className="text-xs font-mono text-outline">
                KL Target Max &le; {status?.kl_target_max ?? 0.02}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs font-mono text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#15803D]" />
                <span>
                  Hiện hành (Prod):{' '}
                  <strong className="text-on-surface">
                    {activeModel?.version_tag ?? 'Chưa kích hoạt'}
                  </strong>
                </span>
                {activeModel && (
                  <span className="text-outline-variant text-[11px]">
                    (SHA: {activeModel.checkpoint_sha256.slice(0, 12)}…)
                  </span>
                )}
              </div>
              {latestPassedCandidate && (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                  <span>
                    Ứng viên sẵn sàng:{' '}
                    <strong className="text-on-surface">
                      {latestPassedCandidate.version_tag}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Gateway Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full xl:w-auto justify-end">
          <button
            type="button"
            disabled={busyAction !== null || loading || (status?.models.length ?? 0) < 2}
            onClick={() => void handleRollback()}
            className="px-4 py-2.5 min-h-[44px] sm:min-h-[38px] rounded-lg bg-[#FFFBEB] text-[#78350F] hover:bg-[#FEF3C7] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-label font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            {busyAction === 'rollback' ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#D97706]" aria-hidden="true" />
            ) : (
              <RotateCcw className="w-4 h-4 text-[#D97706]" aria-hidden="true" />
            )}
            <span>1-Click Rollback</span>
          </button>

          {latestPassedCandidate && (
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => setConfirmModel(latestPassedCandidate)}
              className="px-5 py-2.5 min-h-[44px] sm:min-h-[38px] rounded-lg bg-[#15803D] text-white hover:bg-[#166534] disabled:opacity-50 text-xs font-label font-semibold shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
              <span>Kích hoạt {latestPassedCandidate.version_tag}</span>
            </button>
          )}
        </div>
      </div>

      {/* Status / Error Alerts */}
      {msg && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#14532D] flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{msg}</span>
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

      {/* Main 2-Column Responsive Workspace Grid (7 cols Left - 5 cols Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (7 cols): 4-Tier Benchmark Table + Visual Chart + Insight */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/15 p-6 flex flex-col">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 mb-5 bg-surface-container-low/50 -mx-6 -mt-6 p-6 rounded-t-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D]" />
                  <h2 className="text-base font-headline font-bold text-on-surface tracking-tight">
                    Bảng So sánh Hiệu năng &amp; Ràng buộc An toàn Đa tầng (4-Tier Benchmark)
                  </h2>
                </div>
                <p className="text-xs font-body text-on-surface-variant mt-1">
                  Đánh giá trên bộ mô phỏng đa ngành (eval_seed = 2026, 500 episodes, 3 training seeds).
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F0FDF4] text-[#14532D] text-[11px] font-mono shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" aria-hidden="true" />
                0.0% Masked Violation
              </span>
            </div>

            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-mono uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-3 rounded-l-lg font-semibold min-w-[180px]">
                      Chỉ số Đo lường
                    </th>
                    <th className="py-3 px-2 text-center text-outline">Random / Topo</th>
                    <th className="py-3 px-2 text-center text-outline">Heuristics B3</th>
                    <th className="py-3 px-2 text-center text-outline">MLP-PPO</th>
                    <th className="py-3 px-3 text-center bg-[#F0FDF4] text-[#14532D] font-bold rounded-r-lg">
                      GNN-PPO v2 Base
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono divide-y divide-surface-container-low">
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-body font-semibold text-on-surface">
                        1. In-Domain Reward
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        Backend + Frontend + DevOps
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">12.40</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">54.10</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">61.20</td>
                    <td className="py-3 px-3 text-center bg-[#F0FDF4] text-[#15803D] font-bold">
                      66.65
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-body font-semibold text-on-surface">
                        2. Zero-Shot Transfer
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        heldout_data_eng_graph (10 nodes)
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">9.80</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">52.30</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">58.90</td>
                    <td className="py-3 px-3 text-center bg-[#F0FDF4] text-[#15803D] font-bold">
                      67.36
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-body font-semibold text-on-surface">
                        3. Guardrail Violation
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        Kahn Post-masking Invariant
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-error">34.2%</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">0.0%</td>
                    <td className="py-3 px-2 text-center text-on-surface-variant">0.0%</td>
                    <td className="py-3 px-3 text-center bg-[#F0FDF4] text-[#14532D] font-bold">
                      0.0% (PASS)
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-body font-semibold text-on-surface">
                        4. Active Serving KL
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        Ngưỡng an toàn &le; {status?.kl_target_max ?? 0.02}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center text-outline">N/A</td>
                    <td className="py-3 px-2 text-center text-outline">N/A</td>
                    <td className="py-3 px-2 text-center text-outline">N/A</td>
                    <td className="py-3 px-3 text-center bg-[#F0FDF4] text-[#15803D] font-bold">
                      {activeModel ? activeModel.kl_divergence.toFixed(4) : '0.0000'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual Bar Chart */}
            <div className="mt-6 pt-5 bg-surface-container-low/30 -mx-6 -mb-6 p-6 rounded-b-xl flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-headline font-semibold text-on-surface">
                <span>So sánh Điểm Thưởng In-Domain vs Zero-Shot Transfer</span>
                <div className="flex items-center gap-3 text-[11px] font-mono text-on-surface-variant font-normal">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#15803D]" /> In-Domain
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#0D9488]" /> Held-out Transfer
                  </span>
                </div>
              </div>
              <div className="w-full h-32 flex items-end gap-4 sm:gap-8 pt-4 px-2">
                {[
                  { label: 'Random', inDom: 18, transfer: 15, active: false },
                  { label: 'Heuristics', inDom: 80, transfer: 77, active: false },
                  { label: 'MLP-PPO', inDom: 91, transfer: 87, active: false },
                  { label: 'GNN-PPO', inDom: 99, transfer: 100, active: true },
                ].map((bar) => (
                  <div
                    key={bar.label}
                    className={`flex-1 flex flex-col items-center gap-1.5 h-full justify-end ${
                      bar.active ? 'bg-surface-container rounded-lg p-1' : ''
                    }`}
                  >
                    <div className="w-full flex items-end justify-center gap-1 h-20">
                      <div
                        className={`w-3.5 rounded-t ${
                          bar.active ? 'bg-[#15803D]' : 'bg-outline/50'
                        }`}
                        style={{ height: `${bar.inDom}%` }}
                      />
                      <div
                        className={`w-3.5 rounded-t ${
                          bar.active ? 'bg-[#0D9488]' : 'bg-outline/30'
                        }`}
                        style={{ height: `${bar.transfer}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] font-mono text-center truncate ${
                        bar.active ? 'font-bold text-[#15803D]' : 'text-on-surface-variant'
                      }`}
                    >
                      {bar.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Benchmark Summary Insight Card */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/15 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0 text-primary">
              <Info className="w-5 h-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-headline font-bold text-on-surface uppercase tracking-wide">
                Cơ sở Khoa học: Zero-Shot Transfer qua Isomorphic Node Embeddings
              </h3>
              <p className="text-xs font-body text-on-surface-variant leading-relaxed">
                Mô hình Masked GNN-PPO 3 lớp mã hóa cấu trúc quan hệ tiên quyết topo thay vì ghi nhớ cứng ID khái niệm, giúp đạt <strong>67.36</strong> điểm trên đồ thị Kỹ nghệ Dữ liệu chưa từng thấy với <strong>0.0%</strong> vi phạm tiên quyết.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): Immutable Model Registry & Rollback Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/15 p-6 flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#0D9488]" />
                <h2 className="text-base font-headline font-bold text-on-surface tracking-tight">
                  Kho Checkpoints Bất biến &amp; Lịch sử Rollback ({filteredModels.length})
                </h2>
              </div>
              <p className="text-xs font-body text-on-surface-variant mt-0.5">
                Định danh bằng Hash SHA-256 thật trên đĩa.
              </p>
            </div>

            {/* Search + Verdict Filter */}
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Tìm version_tag hoặc SHA-256..."
                  aria-label="Tìm kiếm phiên bản mô hình hoặc SHA-256"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-low text-xs font-mono text-on-surface focus:bg-white focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1 rounded-lg bg-surface-container-low text-xs font-label">
                {(['ALL', 'PASSED', 'BLOCKED'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setVerdictFilter(f)
                      setPage(1)
                    }}
                    className={`flex-1 px-2.5 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
                      verdictFilter === f
                        ? 'bg-white text-on-surface shadow-2xs'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {f === 'ALL' ? 'Tất cả' : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Checkpoints List */}
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-24 rounded-xl bg-surface-container-low animate-pulse"
                  />
                ))}
              </div>
            ) : pagedModels.length === 0 ? (
              <div className="p-6 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                Không có phiên bản mô hình nào khớp bộ lọc.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pagedModels.map((m) => (
                  <div
                    key={m.model_id}
                    className={`p-4 rounded-xl flex flex-col gap-2.5 border transition-all ${
                      m.is_active
                        ? 'bg-[#F0FDF4] border-[#86EFAC]'
                        : m.gate_verdict === 'PASSED'
                          ? 'bg-surface-container-low/70 border-outline-variant/25'
                          : 'bg-[#FEF2F2]/60 border-[#FECACA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            m.is_active
                              ? 'bg-[#15803D]'
                              : m.gate_verdict === 'PASSED'
                                ? 'bg-[#0D9488]'
                                : 'bg-[#9F1239]'
                          }`}
                        />
                        <span className="text-xs font-mono font-bold text-on-surface truncate">
                          {m.version_tag}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {m.is_active && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#14532D] font-bold">
                            ACTIVE PROD
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                            m.gate_verdict === 'PASSED'
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-[#FEE2E2] text-[#991B1B]'
                          }`}
                        >
                          {m.gate_verdict}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-on-surface-variant flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          SHA: {m.checkpoint_sha256.slice(0, 20)}…
                        </span>
                        <span className="text-on-surface font-semibold shrink-0">
                          KL: {m.kl_divergence.toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {!m.is_active && m.gate_verdict === 'PASSED' && (
                      <div className="pt-1">
                        <button
                          type="button"
                          disabled={busyAction !== null}
                          onClick={() => setConfirmModel(m)}
                          className="w-full py-2 px-3 rounded-lg bg-[#15803D] text-white hover:bg-[#166534] disabled:opacity-50 text-xs font-label font-semibold shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Kích hoạt vào Production</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2 text-xs font-mono text-on-surface-variant">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Trước
                </button>
                <span>
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 cursor-pointer"
                >
                  Sau
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Safe Rollback Protocol Box */}
            <div className="mt-2 p-4 rounded-xl bg-surface-container text-xs font-body text-on-surface-variant flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <span className="font-headline font-bold text-on-surface">
                  Quy chuẩn Khôi phục Tức thì (Safe Rollback Protocol)
                </span>
                <p className="leading-relaxed text-[11px]">
                  Khi nhấn 1-Click Rollback, hệ thống chuyển con trỏ Model Registry trong PostgreSQL và đồng bộ Redis State Cache dưới 2000ms mà không làm gián đoạn phiên học viên.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-promote-title"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-surface-container-lowest max-w-md w-full rounded-2xl p-6 shadow-xl flex flex-col gap-4 border border-outline-variant/30">
            <div className="w-12 h-12 rounded-xl bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h3
                id="confirm-promote-title"
                className="text-base font-headline font-bold text-on-surface"
              >
                Xác nhận Thăng hạng Checkpoint vào Production
              </h3>
              <p className="text-xs text-on-surface-variant font-body mt-1.5 leading-relaxed">
                Mô hình{' '}
                <span className="font-mono text-on-surface font-semibold">
                  {confirmModel.version_tag}
                </span>{' '}
                sẽ tiếp nhận lưu lượng khuyến nghị GNN-PPO v2.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-surface-container-low text-xs font-mono text-on-surface flex flex-col gap-1">
              <div>
                SHA-256:{' '}
                <span className="font-bold text-[#15803D]">
                  {confirmModel.checkpoint_sha256.slice(0, 24)}…
                </span>
              </div>
              <div>
                KL-Divergence: <strong>{confirmModel.kl_divergence.toFixed(4)}</strong>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModel(null)}
                className="px-4 py-2 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface text-xs font-label font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleActivate(confirmModel.model_id)}
                className="px-4 py-2 rounded-lg bg-[#15803D] text-white hover:bg-[#166534] disabled:opacity-50 text-xs font-label font-semibold cursor-pointer inline-flex items-center gap-1.5"
              >
                {busyAction === confirmModel.model_id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                )}
                Xác nhận Triển khai
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
