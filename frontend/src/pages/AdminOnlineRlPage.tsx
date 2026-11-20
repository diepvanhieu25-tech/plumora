import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sliders,
} from 'lucide-react'
import { apiAdminGetOnlineRlStatus, apiAdminRunMicroBatch } from '../api'
import type { ActiveView, OnlineRlStatusResponse } from '../types'

interface AdminOnlineRlPageProps {
  onNavigate: (view: ActiveView) => void
}

export function AdminOnlineRlPage({ onNavigate }: AdminOnlineRlPageProps) {
  const [status, setStatus] = useState<OnlineRlStatusResponse | null>(null)
  const [batchSize, setBatchSize] = useState(128)
  const [klTargetMax, setKlTargetMax] = useState(0.02)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [batchResult, setBatchResult] = useState<Record<string, unknown> | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const data = await apiAdminGetOnlineRlStatus()
      setStatus(data)
      setKlTargetMax(data.kl_target_max)
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
  const recentModels = (status?.models ?? []).slice(0, 5)
  const latestCandidate = status?.models?.[0] ?? null
  const passedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'PASSED').length
  const blockedCount = (status?.models ?? []).filter((m) => m.gate_verdict === 'BLOCKED').length

  return (
    <section
      className="flex flex-col w-full pb-12"
      data-testid="scr18-admin-online-rl"
    >
      {/* Top System Bar & Breadcrumb (Stitch SCR-18) */}
      <div className="w-full px-4 sm:px-6 lg:px-10 py-5 bg-surface-container-lowest shadow-sm mb-6 border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col gap-1.5 min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-xs font-label text-on-surface-variant flex-wrap"
            >
              <span>Quản trị Hệ thống</span>
              <span>/</span>
              <span>Reinforcement Learning</span>
              <span>/</span>
              <span className="font-semibold text-primary">
                Giám sát Online RL &amp; Buffer
              </span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl lg:text-2xl font-headline font-bold text-on-surface tracking-tight">
                Kho Kinh nghiệm Kiểm chứng &amp; Online RL Monitor
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-secondary-container/50 text-on-secondary-container">
                stream:verified_rl_buffer
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  status ? 'bg-primary animate-pulse' : 'bg-outline'
                }`}
              />
              <span className="font-label font-medium text-primary">
                {loading
                  ? 'Đang kiểm tra Buffer...'
                  : insufficientBuffer
                    ? `Buffer: ${bufferCount}/${batchSize}`
                    : 'Trạng thái Buffer: Sẵn sàng'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary font-semibold">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="tracking-wide">Safe Online RL Active</span>
            </div>
            {activeModel && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant">
                <span>
                  Model:{' '}
                  <strong className="text-on-surface">{activeModel.version_tag}</strong>
                </span>
                <span className="text-outline-variant">|</span>
                <span>
                  SHA:{' '}
                  <strong className="text-on-surface">
                    {activeModel.checkpoint_sha256.slice(0, 8)}
                  </strong>
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 px-3 min-h-[44px] sm:min-h-[34px] rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-label font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 space-y-6">
        {/* Error Banner */}
        {err && !loading && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{err}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-36 rounded-xl bg-surface-container-lowest border border-outline-variant/20 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* 4 Top Metric Cards (Stitch SCR-18) */}
        {!loading && status && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Metric 1: Verified Experience Buffer */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-col">
                  <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant font-semibold">
                    Verified Experience Buffer
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                      {status.buffer_count}
                    </span>
                    <span className="text-xs font-label text-on-surface-variant font-medium">
                      tương tác hợp lệ
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <Database className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xs font-label text-on-surface-variant leading-relaxed mb-3">
                Chỉ gom tương tác thật đã qua kiểm chứng Rubric &amp; Sandbox để tránh ô nhiễm chính sách.
              </p>
              <div>
                <div className="flex justify-between items-center text-[11px] font-mono mb-1.5 text-on-surface-variant">
                  <span>
                    Ngưỡng lô hiện tại:{' '}
                    <strong className="text-on-surface">
                      {status.buffer_count} / {validBatchSize ? batchSize : 128}
                    </strong>
                  </span>
                  <span className="text-primary font-bold">{bufferProgressPct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-container overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${bufferProgressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Metric 2: Policy Guardrail */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-col">
                  <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant font-semibold">
                    Guardrail &amp; Safety Gate
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-headline font-extrabold text-primary tracking-tight">
                      {passedCount}/{status.models.length}
                    </span>
                    <span className="text-xs font-label text-on-surface-variant font-medium">
                      mô hình đạt chuẩn
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xs font-label text-on-surface-variant leading-relaxed mb-3">
                {blockedCount > 0
                  ? `Đã chặn ${blockedCount} candidate vượt ngưỡng KL hoặc vi phạm DAG/Ebbinghaus.`
                  : 'Mọi khuyến nghị đều đi qua Action Masking trước khi tới người học.'}
              </p>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-primary/10 text-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  100% Safe Action Masking
                </span>
              </div>
            </div>

            {/* Metric 3: KL Divergence Target */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-col">
                  <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant font-semibold">
                    Ràng buộc Chống Quên (KL)
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-2xl font-headline font-extrabold text-secondary tracking-tight font-mono">
                      D_KL &le; {status.kl_target_max}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
                  <Sliders className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xs font-label text-on-surface-variant leading-relaxed mb-3">
                Giới hạn KL-Divergence so với chính sách gốc GNN-PPO để ngăn trôi dạt sư phạm.
              </p>
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-secondary/10 text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                  KL Guard Active
                </span>
              </div>
            </div>

            {/* Metric 4: Active Production Model */}
            <div className="flex flex-col justify-between p-5 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-label uppercase tracking-wider text-on-surface-variant font-semibold">
                    Prod Checkpoint Đang Phục vụ
                  </span>
                  <div className="mt-1.5 flex items-center gap-1.5 min-w-0">
                    <span className="text-base font-headline font-extrabold text-on-surface truncate">
                      {activeModel?.version_tag ?? 'Chưa kích hoạt'}
                    </span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
                  <Cpu className="w-5 h-5" aria-hidden="true" />
                </div>
              </div>
              <p className="text-xs font-mono text-on-surface-variant truncate mb-3">
                {activeModel
                  ? `SHA: ${activeModel.checkpoint_sha256.slice(0, 18)}...`
                  : 'Chưa có checkpoint đang phục vụ'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => onNavigate('admin_registry')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-label font-semibold bg-primary-container text-on-primary-container hover:opacity-90 cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  Registry &amp; Rollback
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main 2-Column Workspace (Stitch SCR-18: 7 cols Left, 5 cols Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7 cols): Micro-batch Config + Recent Registry Runs */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {/* Panel: Micro-batch Configuration & Execution */}
            <div className="p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-headline font-bold text-on-surface">
                    Cấu hình &amp; Kích hoạt Lô Tinh chỉnh Micro-batch
                  </h2>
                  <p className="text-xs font-label text-on-surface-variant mt-0.5">
                    Yêu cầu tối thiểu {validBatchSize ? batchSize : 128} mẫu trong Experience Buffer để thực hiện cập nhật chính sách.
                  </p>
                </div>
                {insufficientBuffer && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]">
                    Thiếu mẫu ({bufferCount} / {batchSize})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="batch-size-input"
                    className="block text-xs font-bold text-on-surface mb-1.5"
                  >
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
                    className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3.5 py-2.5 text-sm font-mono text-on-surface focus:bg-white focus:border-primary focus:outline-none"
                  />
                  <span className="text-[11px] text-on-surface-variant mt-1 block">
                    Khoảng hợp lệ: 16 – 2,048 transitions
                  </span>
                </div>
                <div>
                  <label
                    htmlFor="kl-target-input"
                    className="block text-xs font-bold text-on-surface mb-1.5"
                  >
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
                    className="w-full rounded-xl border border-outline-variant/50 bg-surface-container-low px-3.5 py-2.5 text-sm font-mono text-on-surface focus:bg-white focus:border-primary focus:outline-none"
                  />
                  <span className="text-[11px] text-on-surface-variant mt-1 block">
                    Ngưỡng khuyến nghị: &le; 0.0200
                  </span>
                </div>
              </div>

              {/* Action CTA */}
              <div className="flex flex-wrap items-center gap-3">
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
                  className="flex-1 min-w-[240px] py-3 px-4 rounded-xl bg-primary text-on-primary font-headline font-bold text-sm flex items-center justify-center gap-2 shadow-sm hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                  data-testid="run-micro-batch-btn"
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
              </div>

              {batchResult && (
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#14532D]">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                      Đã tạo Candidate &lsquo;{String(batchResult.version_tag)}&rsquo;
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate('admin_registry')}
                      className="inline-flex items-center gap-1 underline text-[#15803D] cursor-pointer"
                    >
                      Mở Safety Gate &amp; Kích hoạt
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="text-[11px] font-mono text-[#3F5247]">
                    KL-Divergence: {String(batchResult.kl_divergence)} • SHA-256:{' '}
                    {String(batchResult.checkpoint_sha256).slice(0, 16)}…
                  </p>
                </div>
              )}
            </div>

            {/* Panel: Recent Model Candidates / Registry Runs Table */}
            <div className="p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-headline font-bold text-on-surface">
                      Lịch sử Checkpoints &amp; Đánh giá KL-Divergence
                    </h2>
                  </div>
                  <p className="text-xs font-label text-on-surface-variant">
                    Dữ liệu thật từ bảng model_registry — {status?.models.length ?? 0} phiên bản
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('admin_registry')}
                  className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-label font-semibold text-on-surface cursor-pointer"
                >
                  Xem toàn bộ Registry
                </button>
              </div>

              {recentModels.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-container-low text-center text-xs text-on-surface-variant">
                  Chưa có phiên bản candidate nào trong Model Registry.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-container text-on-surface-variant font-label uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-3">Phiên bản</th>
                        <th className="py-3 px-3">SHA-256</th>
                        <th className="py-3 px-3 text-right">KL-Div</th>
                        <th className="py-3 px-3 text-right">Safety Gate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-container text-on-surface font-mono">
                      {recentModels.map((m) => (
                        <tr key={m.model_id} className="hover:bg-surface-container-low transition-colors">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-on-surface font-label">
                                {m.version_tag}
                              </span>
                              {m.is_active && (
                                <span className="px-1.5 py-0.5 rounded bg-primary-container text-on-primary-container text-[10px] font-bold">
                                  ACTIVE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-on-surface-variant">
                            {m.checkpoint_sha256.slice(0, 14)}…
                          </td>
                          <td className="py-3 px-3 text-right font-semibold">
                            {m.kl_divergence.toFixed(4)}
                          </td>
                          <td className="py-3 px-3 text-right font-label">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                m.gate_verdict === 'PASSED'
                                  ? 'bg-primary-container text-on-primary-container'
                                  : 'bg-[#FEE2E2] text-[#991B1B]'
                              }`}
                            >
                              {m.gate_verdict}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Hyperparameter Spec + Safe Protocol + Quick Links */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col gap-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Activity className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-base font-headline font-bold text-on-surface">
                      Thông số Kỹ thuật &amp; Giao thức An toàn
                    </h2>
                    <span className="text-xs font-label text-on-surface-variant">
                      Động cơ Tinh chỉnh Trọng số Online RL
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 text-xs font-mono bg-surface-container-low p-4 rounded-xl">
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-on-surface-variant font-label">Model cơ sở (Active):</span>
                  <span className="font-bold text-on-surface truncate">
                    {activeModel?.version_tag ?? 'Chưa kích hoạt'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-on-surface-variant font-label">Hash SHA-256:</span>
                  <span className="text-on-surface truncate max-w-[170px]">
                    {activeModel ? `${activeModel.checkpoint_sha256.slice(0, 14)}…` : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-on-surface-variant font-label">Batch Size mục tiêu:</span>
                  <span className="text-primary font-bold">
                    {validBatchSize ? batchSize : '--'} transitions
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-on-surface-variant font-label">Ngưỡng Target KL:</span>
                  <span className="text-secondary font-bold">
                    &le; {validKlTarget ? klTargetMax : '--'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 gap-2">
                  <span className="text-on-surface-variant font-label">Safety Diagnostic:</span>
                  <span className="text-on-surface font-semibold">200 synthetic episodes</span>
                </div>
              </div>

              {/* Safety Notice Box */}
              <div className="p-4 rounded-xl bg-tertiary-container/15 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-headline font-bold text-on-tertiary-container">
                    Nguyên tắc Cập nhật Trực tuyến An toàn (Safe Online RL)
                  </span>
                  <p className="text-on-surface-variant leading-relaxed">
                    Mô hình chỉ được cập nhật trọng số vào <strong>Shadow Candidate</strong> và bắt buộc vượt qua <strong>Safety Evaluation Gate</strong> (KL &le; ngưỡng và 0% vi phạm DAG) trước khi cho phép kích hoạt Production.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('admin_registry')}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span>Xem Kết quả Safety Gate &amp; Rollback (SCR-19)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('admin_health')}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface-variant font-label font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Server className="w-4 h-4 text-secondary" aria-hidden="true" />
                  <span>Giám sát Cụm 4 Microservices &amp; Outbox (SCR-20)</span>
                </button>
              </div>
            </div>

            {latestCandidate && (
              <div className="p-6 rounded-xl bg-surface-container-lowest shadow-sm border border-outline-variant/15 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                    <h3 className="text-sm font-headline font-bold text-on-surface">
                      Phiên bản Mới nhất: {latestCandidate.version_tag}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                      latestCandidate.gate_verdict === 'PASSED'
                        ? 'bg-primary-container text-on-primary-container'
                        : 'bg-[#FEE2E2] text-[#991B1B]'
                    }`}
                  >
                    {latestCandidate.gate_verdict}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-center font-mono">
                  <div className="p-3 rounded-lg bg-surface-container-low">
                    <span className="text-[10px] uppercase font-label text-on-surface-variant block mb-1">
                      KL Divergence
                    </span>
                    <span className="text-sm font-bold text-secondary">
                      {latestCandidate.kl_divergence.toFixed(4)}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-surface-container-low">
                    <span className="text-[10px] uppercase font-label text-on-surface-variant block mb-1">
                      Trạng thái
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {latestCandidate.is_active ? 'Production' : 'Standby'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
