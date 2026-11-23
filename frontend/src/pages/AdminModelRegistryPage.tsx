import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import {
  apiAdminActivateModel,
  apiAdminGetOnlineRlStatus,
  apiAdminRollbackModel,
} from '../api'
import type { ModelRegistryItem, OnlineRlStatusResponse } from '../types/admin'

const PAGE_SIZE = 8

function translateBlockReasons(model: ModelRegistryItem, klTargetMax: number): string[] {
  const m = model.eval_metrics
  const rawReasons = m?.block_reasons ?? []
  const reasons: string[] = []
  for (const r of rawReasons) {
    if (r.toLowerCase().includes('kl')) {
      reasons.push(`KL-Divergence (${model.kl_divergence.toFixed(4)}) vượt ngưỡng an toàn (${klTargetMax}).`)
    } else if (r.toLowerCase().includes('unmasked')) {
      reasons.push(
        `Tỷ lệ hành động không hợp lệ trước che mặt nạ (${((m?.invalid_action_rate_unmasked ?? 0) * 100).toFixed(1)}%) vượt ngưỡng 5.0%.`,
      )
    } else if (r.toLowerCase().includes('masked') || r.toLowerCase().includes('guardrail')) {
      reasons.push('Phát hiện vi phạm rào chắn tiên quyết sau Guardrail (> 0%).')
    } else if (r.toLowerCase().includes('reward')) {
      reasons.push(
        `Tỷ lệ phần thưởng so với bản Prod (${(m?.mean_reward_ratio_vs_prod ?? 0).toFixed(3)}) thấp hơn ngưỡng 0.98.`,
      )
    } else {
      reasons.push(r)
    }
  }
  if (reasons.length === 0 && model.gate_verdict === 'BLOCKED') {
    if (model.kl_divergence > klTargetMax) {
      reasons.push(`KL-Divergence (${model.kl_divergence.toFixed(4)}) vượt ngưỡng ${klTargetMax}.`)
    }
    if ((m?.invalid_action_rate_unmasked ?? 0) >= 0.05) {
      reasons.push(
        `Unmasked invalid action rate (${((m?.invalid_action_rate_unmasked ?? 0) * 100).toFixed(1)}%) >= 5.0%.`,
      )
    }
    if ((m?.masked_violation_rate ?? 0) > 0) {
      reasons.push('Masked guardrail violation rate > 0.0%.')
    }
    if (m?.mean_reward_ratio_vs_prod != null && m.mean_reward_ratio_vs_prod < 0.98) {
      reasons.push(`Reward ratio (${m.mean_reward_ratio_vs_prod.toFixed(3)}) < 0.98 so với Prod.`)
    }
  }
  return reasons
}

export function AdminModelRegistryPage() {
  const [status, setStatus] = useState<OnlineRlStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'PASSED' | 'BLOCKED'>('ALL')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  // Shared confirmation modal for BOTH Activate and 1-Click Rollback with mandatory audit reason
  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'activate'; model: ModelRegistryItem }
    | { kind: 'rollback' }
    | null
  >(null)
  const [auditReason, setAuditReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await apiAdminGetOnlineRlStatus()
      setStatus(data)
      setSelectedCandidateId((prev) => {
        if (prev && data.models.some((m) => m.model_id === prev)) return prev
        const firstNonActive = data.models.find((m) => !m.is_active)
        return firstNonActive?.model_id ?? data.models[0]?.model_id ?? null
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải Model Registry')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

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
  const selectedCandidate =
    status?.models.find((m) => m.model_id === selectedCandidateId) ??
    status?.models.find((m) => !m.is_active) ??
    activeModel
  const klMax = status?.kl_target_max ?? 0.02
  const blockReasons = selectedCandidate ? translateBlockReasons(selectedCandidate, klMax) : []

  async function executeConfirmedAction() {
    if (!confirmAction || !auditReason.trim()) return
    setErr(null)
    setMsg(null)
    if (confirmAction.kind === 'activate') {
      setBusyAction(confirmAction.model.model_id)
      try {
        const res = await apiAdminActivateModel(confirmAction.model.model_id, auditReason.trim())
        setMsg(
          `Đã kích hoạt '${confirmAction.model.version_tag}' vào Production (${res.switch_latency_ms}ms).`,
        )
        setConfirmAction(null)
        setAuditReason('')
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Không thể kích hoạt Checkpoint')
      } finally {
        setBusyAction(null)
      }
    } else {
      setBusyAction('rollback')
      try {
        const res = await apiAdminRollbackModel(auditReason.trim())
        setMsg(`Đã Rollback 1-Click thành công trong ${res.switch_latency_ms}ms.`)
        setConfirmAction(null)
        setAuditReason('')
        await load()
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Lỗi khôi phục phiên bản trước')
      } finally {
        setBusyAction(null)
      }
    }
  }

  return (
    <section
      className="w-full space-y-6 text-[#14241B]"
      data-testid="scr19-admin-registry"
    >
      {/* Header */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
            Cổng Kiểm định An toàn (Safety Gate) &amp; Điều phối Model Registry
          </h1>
          <p className="text-xs text-[#3F5247] mt-1">
            Đối sánh trực diện chỉ số kiểm định thực tế giữa Candidate và Production, kèm xác nhận kiểm toán cho mọi thao tác Activate / Rollback.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busyAction !== null || loading || (status?.models.length ?? 0) < 2}
            onClick={() => {
              setAuditReason('Khôi phục khẩn cấp về phiên bản Production ổn định trước đó')
              setConfirmAction({ kind: 'rollback' })
            }}
            data-testid="open-rollback-modal-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FFFBEB] border border-[#F59E0B] text-[#78350F] hover:bg-[#FEF3C7] disabled:opacity-45 text-xs font-bold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
            <span>1-Click Rollback</span>
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
          className="p-3.5 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{err}</span>
        </div>
      )}

      {/* Main 2-Column Layout: Left Head-to-Head Scorecard (7) + Right Registry List (5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-5">
          {/* Head-to-Head Live Safety Gate Scorecard */}
          <div
            className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4"
            data-testid="head-to-head-safety-scorecard"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E7EFE7]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-extrabold text-[#14241B]">
                    Đối sánh Trực diện Safety Gate: Candidate vs Active Production
                  </h2>
                  <p className="text-[11px] text-[#57534E]">
                    Chỉ số kiểm định thực tế từ 200 kịch bản đánh giá trên đồ thị đa lĩnh vực.
                  </p>
                </div>
              </div>

              {selectedCandidate && (
                <span
                  className={`px-2.5 py-1 rounded-full font-mono text-xs font-bold ${
                    selectedCandidate.gate_verdict === 'PASSED'
                      ? 'bg-[#DCFCE7] text-[#14532D]'
                      : 'bg-[#FFF1F2] text-[#9F1239] border border-[#FDA4AF]'
                  }`}
                >
                  SAFETY GATE: {selectedCandidate.gate_verdict}
                </span>
              )}
            </div>

            {selectedCandidate ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F6F8F5] text-[#57534E] font-mono text-[11px] uppercase">
                        <th className="py-2.5 px-3">Tiêu chí Kiểm định</th>
                        <th className="py-2.5 px-3">Ngưỡng An toàn</th>
                        <th className="py-2.5 px-3">Active Prod ({activeModel?.version_tag ?? '--'})</th>
                        <th className="py-2.5 px-3 bg-[#F0FDF4] text-[#14532D]">
                          Đang chọn ({selectedCandidate.version_tag})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="font-mono divide-y divide-[#E7EFE7]">
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold">KL-Divergence</td>
                        <td className="py-2.5 px-3">&le; {klMax.toFixed(4)}</td>
                        <td className="py-2.5 px-3">
                          {activeModel ? activeModel.kl_divergence.toFixed(4) : '--'}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            selectedCandidate.kl_divergence <= klMax
                              ? 'text-[#15803D]'
                              : 'text-[#9F1239]'
                          }`}
                        >
                          {selectedCandidate.kl_divergence.toFixed(4)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold">
                          Unmasked Invalid Action Rate
                        </td>
                        <td className="py-2.5 px-3">&lt; 5.0%</td>
                        <td className="py-2.5 px-3">
                          {activeModel?.eval_metrics?.invalid_action_rate_unmasked != null
                            ? `${(activeModel.eval_metrics.invalid_action_rate_unmasked * 100).toFixed(2)}%`
                            : '0.00%'}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            (selectedCandidate.eval_metrics?.invalid_action_rate_unmasked ?? 0) < 0.05
                              ? 'text-[#15803D]'
                              : 'text-[#9F1239]'
                          }`}
                        >
                          {selectedCandidate.eval_metrics?.invalid_action_rate_unmasked != null
                            ? `${(selectedCandidate.eval_metrics.invalid_action_rate_unmasked * 100).toFixed(2)}%`
                            : '--'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold">
                          Masked Guardrail Violation
                        </td>
                        <td className="py-2.5 px-3">== 0.0%</td>
                        <td className="py-2.5 px-3">
                          {activeModel?.eval_metrics?.masked_violation_rate != null
                            ? `${(activeModel.eval_metrics.masked_violation_rate * 100).toFixed(2)}%`
                            : '0.00%'}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            (selectedCandidate.eval_metrics?.masked_violation_rate ?? 0) === 0
                              ? 'text-[#15803D]'
                              : 'text-[#9F1239]'
                          }`}
                        >
                          {selectedCandidate.eval_metrics?.masked_violation_rate != null
                            ? `${(selectedCandidate.eval_metrics.masked_violation_rate * 100).toFixed(2)}%`
                            : '--'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold">
                          Mean Reward Ratio vs Prod
                        </td>
                        <td className="py-2.5 px-3">&ge; 0.980</td>
                        <td className="py-2.5 px-3">1.000</td>
                        <td
                          className={`py-2.5 px-3 font-bold ${
                            (selectedCandidate.eval_metrics?.mean_reward_ratio_vs_prod ?? 1) >= 0.98
                              ? 'text-[#15803D]'
                              : 'text-[#9F1239]'
                          }`}
                        >
                          {selectedCandidate.eval_metrics?.mean_reward_ratio_vs_prod != null
                            ? selectedCandidate.eval_metrics.mean_reward_ratio_vs_prod.toFixed(3)
                            : '--'}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-semibold">
                          Mean Episode Reward (200 ep)
                        </td>
                        <td className="py-2.5 px-3">Delta &ge; -2%</td>
                        <td className="py-2.5 px-3">
                          {selectedCandidate.eval_metrics?.active_mean_reward != null
                            ? selectedCandidate.eval_metrics.active_mean_reward.toFixed(2)
                            : '--'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#14241B]">
                          {selectedCandidate.eval_metrics?.candidate_mean_reward != null
                            ? `${selectedCandidate.eval_metrics.candidate_mean_reward.toFixed(2)} (${
                                (selectedCandidate.eval_metrics.reward_delta ?? 0) >= 0 ? '+' : ''
                              }${(selectedCandidate.eval_metrics.reward_delta ?? 0).toFixed(2)})`
                            : '--'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Block Reasons Breakdown */}
                {selectedCandidate.gate_verdict === 'BLOCKED' && (
                  <div
                    role="alert"
                    className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] space-y-1.5 text-xs text-[#9F1239]"
                  >
                    <div className="font-extrabold flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>Lý do Candidate bị khóa bởi Safety Evaluation Gate:</span>
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {blockReasons.map((reason, idx) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Activate CTA */}
                {!selectedCandidate.is_active && (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    <span className="text-xs font-mono text-[#57534E]">
                      SHA-256: {selectedCandidate.checkpoint_sha256.slice(0, 20)}...
                    </span>
                    <button
                      type="button"
                      disabled={
                        busyAction !== null || selectedCandidate.gate_verdict !== 'PASSED'
                      }
                      onClick={() => {
                        setAuditReason(
                          `Kích hoạt ${selectedCandidate.version_tag} sau khi đạt 100% tiêu chí Safety Gate`,
                        )
                        setConfirmAction({ kind: 'activate', model: selectedCandidate })
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {selectedCandidate.gate_verdict === 'PASSED'
                          ? `Kích hoạt ${selectedCandidate.version_tag}`
                          : 'Bị khóa (Chưa đạt Safety Gate)'}
                      </span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="p-6 text-center text-xs text-[#57534E]">
                Chưa có checkpoint nào trong Model Registry.
              </div>
            )}
          </div>
        </div>

        {/* Right: Immutable Model Registry List */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[#14241B] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
              <span>Kho Checkpoints ({filteredModels.length})</span>
            </h2>
          </div>

          <div className="space-y-2">
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
                placeholder="Tìm version_tag hoặc SHA-256..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] text-xs font-mono focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F6F8F5] text-xs">
              {(['ALL', 'PASSED', 'BLOCKED'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setVerdictFilter(f)
                    setPage(1)
                  }}
                  className={`flex-1 py-1.5 rounded font-semibold cursor-pointer ${
                    verdictFilter === f ? 'bg-white text-[#14241B] shadow-2xs' : 'text-[#57534E]'
                  }`}
                >
                  {f === 'ALL' ? 'Tất cả' : f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {pagedModels.map((m) => {
              const isSelected = selectedCandidate?.model_id === m.model_id
              return (
                <button
                  key={m.model_id}
                  type="button"
                  onClick={() => setSelectedCandidateId(m.model_id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'border-[#15803D] ring-1 ring-[#15803D] bg-[#F0FDF4]/60'
                      : 'border-[#D8E2D8] bg-[#F6F8F5] hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#14241B] truncate">
                      {m.version_tag}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {m.is_active && (
                        <span className="px-1.5 py-0.5 rounded bg-[#DCFCE7] text-[#14532D] font-mono text-[10px] font-bold">
                          PROD
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold ${
                          m.gate_verdict === 'PASSED'
                            ? 'bg-[#DCFCE7] text-[#14532D]'
                            : 'bg-[#FFF1F2] text-[#9F1239]'
                        }`}
                      >
                        {m.gate_verdict}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#57534E]">
                    <span>SHA: {m.checkpoint_sha256.slice(0, 14)}...</span>
                    <span>KL: {m.kl_divergence.toFixed(4)}</span>
                  </div>
                </button>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs font-mono text-[#57534E]">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F6F8F5] disabled:opacity-40 cursor-pointer"
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#F6F8F5] disabled:opacity-40 cursor-pointer"
              >
                Sau
                <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Activate & Rollback with Mandatory Audit Reason */}
      {confirmAction && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl border border-[#D8E2D8] p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmAction.kind === 'rollback'
                    ? 'bg-[#FFFBEB] text-[#D97706] border border-[#F59E0B]'
                    : 'bg-[#DCFCE7] text-[#15803D]'
                }`}
              >
                {confirmAction.kind === 'rollback' ? (
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-[#14241B]">
                  {confirmAction.kind === 'rollback'
                    ? 'Xác nhận Khôi phục Khẩn cấp (1-Click Rollback)'
                    : `Xác nhận Kích hoạt ${confirmAction.model.version_tag}`}
                </h3>
                <p className="text-xs text-[#57534E]">
                  Thao tác sẽ chuyển đổi con trỏ Serving Production và ghi nhận lý do kiểm toán.
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="model-audit-reason"
                className="block text-xs font-bold text-[#14241B] mb-1"
              >
                Lý do thực hiện (Bắt buộc cho Audit Log)
              </label>
              <textarea
                id="model-audit-reason"
                rows={2}
                value={auditReason}
                onChange={(e) => setAuditReason(e.target.value)}
                placeholder="Nhập lý do kích hoạt hoặc rollback..."
                className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] p-2.5 text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg bg-[#F6F8F5] border border-[#D8E2D8] text-xs font-semibold cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={busyAction !== null || !auditReason.trim()}
                onClick={() => void executeConfirmedAction()}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer ${
                  confirmAction.kind === 'rollback'
                    ? 'bg-[#D97706] hover:bg-[#B45309]'
                    : 'bg-[#15803D] hover:bg-[#166534]'
                }`}
              >
                {busyAction !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />}
                <span>
                  {confirmAction.kind === 'rollback' ? 'Xác nhận Rollback' : 'Xác nhận Kích hoạt'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
