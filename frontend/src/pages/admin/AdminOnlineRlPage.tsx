import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Sliders,
} from 'lucide-react'
import {
  apiAdminGetBufferSummary,
  apiAdminGetOnlineRlStatus,
  apiAdminRunMicroBatch,
} from '../../api'
import { PolicyInspectorPanel } from '../../components/admin/PolicyInspectorPanel'
import type {
  MicroBatchTrainResponse,
  OnlineRlBufferSummaryResponse,
  OnlineRlStatusResponse,
} from '../../types/admin'
import type { BackOfficeView } from '../../types/expert'

export interface AdminOnlineRlPageProps {
  onNavigate: (view: BackOfficeView, params?: { domainSlug?: string; conceptSlug?: string }) => void
}

export function AdminOnlineRlPage({ onNavigate }: AdminOnlineRlPageProps) {
  const [status, setStatus] = useState<OnlineRlStatusResponse | null>(null)
  const [bufferSummary, setBufferSummary] = useState<OnlineRlBufferSummaryResponse | null>(null)
  const [batchSize, setBatchSize] = useState(128)
  const [klTargetMax, setKlTargetMax] = useState(0.02)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<MicroBatchTrainResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await apiAdminGetOnlineRlStatus()
      setStatus(data)
      setKlTargetMax(data.kl_target_max)
      try {
        const buf = await apiAdminGetBufferSummary(20)
        setBufferSummary(buf)
      } catch {
        setBufferSummary(null)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Lỗi tải trạng thái Online RL')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleRunBatch() {
    setErr(null)
    setBatchResult(null)
    setRunning(true)
    try {
      const res = await apiAdminRunMicroBatch(batchSize, klTargetMax)
      setBatchResult(res)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không đủ mẫu trong Experience Buffer')
    } finally {
      setRunning(false)
    }
  }

  const bufferCount = status?.buffer_count ?? 0
  const validBatchSize = Number.isFinite(batchSize) && batchSize >= 16 && batchSize <= 2048
  const validKlTarget = Number.isFinite(klTargetMax) && klTargetMax > 0 && klTargetMax <= 0.2
  const insufficientBuffer = validBatchSize && bufferCount < batchSize
  const bufferProgressPct = validBatchSize
    ? Math.min(100, Math.round((bufferCount / batchSize) * 1000) / 10)
    : 0
  const activeModel = status?.active_model ?? null
  const passedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'PASSED').length
  const blockedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'BLOCKED').length

  return (
    <section
      className="w-full space-y-6 text-[#14241B]"
      data-testid="scr18-admin-online-rl"
    >
      {/* Header Bar */}
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#14241B] tracking-tight">
            Online RL, Kho Kinh nghiệm &amp; Thanh tra Chính sách (Policy Inspector)
          </h1>
          <p className="text-xs text-[#3F5247] mt-1">
            Giám sát mẫu tương tác thật trong Experience Buffer, kích hoạt tinh chỉnh Micro-batch và kiểm tra xác suất hành động GNN-PPO.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeModel && (
            <div className="px-3 py-1.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] font-mono text-[#14532D]">
              Active: <strong>{activeModel.version_tag}</strong> ({activeModel.checkpoint_sha256.slice(0, 8)})
            </div>
          )}
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

      {err && !loading && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{err}</span>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-1 rounded-lg bg-white border border-[#FDA4AF] cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      {!loading && status && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="font-bold uppercase">Verified Experience Buffer</span>
              <Database className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-[#14241B]">
              {status.buffer_count}
            </div>
            <div className="w-full h-1.5 rounded-full bg-[#E7EFE7] overflow-hidden">
              <div
                className="h-full bg-[#15803D] transition-all"
                style={{ width: `${bufferProgressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-[#57534E]">
              <span>
                Ngưỡng lô: {status.buffer_count} / {validBatchSize ? batchSize : 128}
              </span>
              <span className="font-bold text-[#15803D]">{bufferProgressPct}%</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="font-bold uppercase">Safety Gate Checkpoints</span>
              <ShieldCheck className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            </div>
            <div className="text-3xl font-extrabold font-mono text-[#15803D]">
              {passedCount}/{status.models.length}
            </div>
            <p className="text-[11px] text-[#57534E]">
              {blockedCount} candidate bị chặn do vi phạm ngưỡng an toàn
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="font-bold uppercase">Ràng buộc KL-Divergence</span>
              <Sliders className="w-4 h-4 text-[#0D9488]" aria-hidden="true" />
            </div>
            <div className="text-2xl font-extrabold font-mono text-[#0D9488]">
              D_KL &le; {status.kl_target_max}
            </div>
            <p className="text-[11px] text-[#57534E]">
              Giới hạn độ lệch phân phối chính sách khi tinh chỉnh Online RL
            </p>
          </div>

          <div className="p-5 rounded-xl bg-white border border-[#D8E2D8] shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-[#57534E]">
              <span className="font-bold uppercase">Production Model</span>
              <Cpu className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
            </div>
            <div className="text-base font-extrabold font-mono text-[#14241B] truncate">
              {activeModel?.version_tag ?? 'Chưa kích hoạt'}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('admin_registry')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#15803D] hover:underline cursor-pointer"
            >
              <span>Mở Safety Gate &amp; Rollback</span>
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Micro-batch Trigger (Left 5) + Live Experience Buffer Inspector (Right 7) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[#14241B]">
              Kích hoạt Lô Tinh chỉnh Micro-batch Online RL
            </h2>
            {insufficientBuffer && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]">
                Thiếu mẫu ({bufferCount} / {batchSize})
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="batch-size-input" className="block text-xs font-bold mb-1">
                Kích thước Lô (batch_size)
              </label>
              <input
                id="batch-size-input"
                type="number"
                min={16}
                max={2048}
                value={Number.isNaN(batchSize) ? '' : batchSize}
                onChange={(e) => {
                  const raw = e.target.value
                  setBatchSize(raw === '' ? Number.NaN : Number(raw))
                }}
                className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-xs font-mono focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="kl-target-input" className="block text-xs font-bold mb-1">
                KL Target Max (D_KL)
              </label>
              <input
                id="kl-target-input"
                type="number"
                step="0.005"
                min={0.005}
                max={0.2}
                value={Number.isNaN(klTargetMax) ? '' : klTargetMax}
                onChange={(e) => {
                  const raw = e.target.value
                  setKlTargetMax(raw === '' ? Number.NaN : Number(raw))
                }}
                className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-xs font-mono focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={
              running ||
              loading ||
              !status ||
              insufficientBuffer ||
              !validBatchSize ||
              !validKlTarget
            }
            onClick={() => void handleRunBatch()}
            data-testid="run-micro-batch-btn"
            className="w-full py-2.5 px-4 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {running
                ? 'Đang tinh chỉnh KL-Constrained PPO & chạy Safety Gate...'
                : 'Chạy Lô Tinh chỉnh Safe Micro-batch Online RL'}
            </span>
          </button>

          {batchResult && (
            <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] space-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-2 font-bold text-[#14532D]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                  <span>Đã tạo {batchResult.version_tag}</span>
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-mono text-[10px] ${
                    batchResult.safety_eval.gate_verdict === 'PASSED'
                      ? 'bg-[#DCFCE7] text-[#14532D]'
                      : 'bg-[#FFF1F2] text-[#9F1239]'
                  }`}
                >
                  {batchResult.safety_eval.gate_verdict}
                </span>
              </div>
              <div className="font-mono text-[11px] text-[#3F5247]">
                KL: {batchResult.kl_divergence.toFixed(4)} • Reward Ratio:{' '}
                {batchResult.safety_eval.mean_reward_ratio_vs_prod.toFixed(3)}
              </div>
              <button
                type="button"
                onClick={() => onNavigate('admin_registry')}
                className="text-[#15803D] font-bold hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Mở Safety Gate để đối sánh &amp; kích hoạt</span>
                <ExternalLink className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Live Experience Buffer Inspector */}
        <div
          className="lg:col-span-7 bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4"
          data-testid="experience-buffer-inspector"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-[#14241B]">
              Thanh tra Kho Kinh nghiệm Thật (Experience Buffer Inspector)
            </h2>
            {bufferSummary && (
              <span className="text-[11px] font-mono text-[#57534E]">
                Reward TB: <strong>{bufferSummary.reward_stats.mean.toFixed(3)}</strong> (min{' '}
                {bufferSummary.reward_stats.min.toFixed(2)}, max{' '}
                {bufferSummary.reward_stats.max.toFixed(2)})
              </span>
            )}
          </div>

          {!bufferSummary || bufferSummary.total_transitions === 0 ? (
            <div className="p-4 rounded-xl bg-[#F6F8F5] text-xs text-[#57534E]">
              Chưa có mẫu tương tác nào trong Kho Kinh nghiệm. Các phiên học và đánh giá thật của học viên sẽ tự động chảy qua Outbox vào đây.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-1.5">
                  <span className="font-bold text-[11px] uppercase text-[#57534E] block">
                    Phân bố theo Lĩnh vực
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(bufferSummary.by_domain).map(([dom, cnt]) => (
                      <span
                        key={dom}
                        className="px-2 py-0.5 rounded bg-white border border-[#D8E2D8] font-mono text-[11px]"
                      >
                        {dom}: <strong>{cnt}</strong>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-1.5">
                  <span className="font-bold text-[11px] uppercase text-[#57534E] block">
                    Phân bố theo Chế độ Học
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(bufferSummary.by_mode).map(([mode, cnt]) => (
                      <span
                        key={mode}
                        className="px-2 py-0.5 rounded bg-white border border-[#D8E2D8] font-mono text-[11px]"
                      >
                        {mode}: <strong>{cnt}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-56 overflow-y-auto">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead>
                    <tr className="bg-[#F6F8F5] text-[#57534E] uppercase">
                      <th className="py-2 px-2.5">Domain / Concept</th>
                      <th className="py-2 px-2">Mode</th>
                      <th className="py-2 px-2 text-center">Depth</th>
                      <th className="py-2 px-2.5 text-right">Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7EFE7]">
                    {bufferSummary.recent_transitions.map((tr) => (
                      <tr key={tr.id} className="hover:bg-[#F6F8F5]">
                        <td className="py-1.5 px-2.5">
                          <span className="text-[#57534E]">{tr.domain_slug}/</span>
                          <strong className="text-[#14241B]">{tr.concept_slug}</strong>
                        </td>
                        <td className="py-1.5 px-2">{tr.action_mode}</td>
                        <td className="py-1.5 px-2 text-center">
                          {tr.depth_before != null && tr.depth_after != null
                            ? `${Math.round(tr.depth_before * 100)}% -> ${Math.round(tr.depth_after * 100)}%`
                            : '--'}
                        </td>
                        <td
                          className={`py-1.5 px-2.5 text-right font-bold ${
                            tr.reward >= 0 ? 'text-[#15803D]' : 'text-[#9F1239]'
                          }`}
                        >
                          {tr.reward >= 0 ? `+${tr.reward.toFixed(3)}` : tr.reward.toFixed(3)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Row 3: Live Policy Logits & Feature Matrix Inspector + Admin What-If Time Simulation Clock */}
      <PolicyInspectorPanel models={status?.models ?? []} />
    </section>
  )
}
