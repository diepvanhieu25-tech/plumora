import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Loader2,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
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

  return (
    <section
      className="max-w-6xl mx-auto px-4 sm:px-6 pb-6 space-y-5"
      data-testid="scr18-admin-online-rl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#D8E2D8] shadow-2xs">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] uppercase tracking-wider">
            <Activity className="w-4 h-4" aria-hidden="true" />
            Cổng Admin — Giám sát Safe Online RL &amp; Experience Buffer (SCR-18)
          </span>
          <h1 className="text-xl font-extrabold text-[#14241B] mt-1">
            Tinh chỉnh Micro-batch Ràng buộc KL-Divergence
          </h1>
          <p className="text-xs text-[#57534E] mt-0.5">
            Chỉ sử dụng tương tác thật đã qua kiểm duyệt; mọi Candidate phải vượt qua Safety Evaluation Gate (200 episodes).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-white text-[#14241B] hover:bg-[#F6F8F5] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin_registry')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-white text-[#14241B] hover:border-[#15803D] cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
            Safety Gate &amp; Rollback
          </button>
          <button
            type="button"
            onClick={() => onNavigate('admin_health')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#D8E2D8] bg-white text-[#14241B] hover:border-[#15803D] cursor-pointer"
          >
            <Server className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
            Cụm 4 Microservices
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#D8E2D8] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && status && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] space-y-1.5 shadow-2xs">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#57534E]">
              <Database className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
              Verified Experience Buffer
            </span>
            <p className="text-2xl font-extrabold text-[#15803D]">{status.buffer_count} mẫu</p>
            <span className="text-[11px] text-[#57534E] block">
              {status.buffer_count < 128
                ? 'Đang thu thập thêm tương tác đã kiểm chứng (< 128 mẫu)'
                : 'Đủ ngưỡng tối thiểu để chạy Micro-batch'}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] space-y-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-[#57534E] block">
              Ngưỡng KL-Divergence Tối đa
            </span>
            <p className="text-2xl font-extrabold text-[#14241B] font-mono">
              {status.kl_target_max}
            </p>
            <span className="text-[11px] text-[#57534E] block">
              Bảo toàn chính sách không lệch phân phối gốc
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D8E2D8] space-y-1.5 shadow-2xs">
            <span className="text-xs font-semibold text-[#57534E] block">
              Prod Checkpoint Đang Phục vụ
            </span>
            <p className="text-sm font-extrabold text-[#15803D] flex items-center gap-1.5 pt-1">
              <Cpu className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {status.active_model?.version_tag ?? 'Chưa kích hoạt'}
              </span>
            </p>
            {status.active_model?.checkpoint_sha256 && (
              <span className="text-[11px] font-mono text-[#57534E] block truncate">
                SHA: {status.active_model.checkpoint_sha256.slice(0, 16)}…
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl border border-[#D8E2D8] space-y-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F1F5F9] pb-3">
          <div>
            <h2 className="text-sm font-extrabold text-[#14241B]">
              Cấu hình &amp; Kích hoạt Lô Tinh chỉnh Micro-batch
            </h2>
            <p className="text-xs text-[#57534E]">
              Yêu cầu tối thiểu {batchSize} mẫu trong Experience Buffer để thực hiện cập nhật chính sách.
            </p>
          </div>
          {insufficientBuffer && (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#FFFBEB] text-[#B45309] border border-[#F59E0B]">
              Thiếu mẫu ({bufferCount} / {batchSize})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="batch-size-input"
              className="block text-xs font-bold text-[#3F5247] mb-1"
            >
              Kích thước Lô (batch_size)
            </label>
            <input
              id="batch-size-input"
              type="number"
              min={16}
              max={2048}
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-sm font-mono w-40 focus:bg-white focus:border-[#15803D] focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="kl-target-input"
              className="block text-xs font-bold text-[#3F5247] mb-1"
            >
              KL Target Max
            </label>
            <input
              id="kl-target-input"
              type="number"
              step="0.005"
              min={0.005}
              max={0.1}
              value={klTargetMax}
              onChange={(e) => setKlTargetMax(Number(e.target.value))}
              className="rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] px-3 py-2 text-sm font-mono w-40 focus:bg-white focus:border-[#15803D] focus:outline-none"
            />
          </div>
          <button
            type="button"
            disabled={running || loading || !status || insufficientBuffer || !validBatchSize || !validKlTarget}
            onClick={() => void handleRunBatch()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803D] text-white text-sm font-bold hover:bg-[#166534] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            data-testid="run-micro-batch-btn"
          >
            {running ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4" aria-hidden="true" />
            )}
            {running
              ? 'Đang tinh chỉnh KL-Constrained PPO & chạy 200 kịch bản Safety Gate...'
              : 'Chạy Lô Tinh chỉnh Online RL (Micro-batch)'}
          </button>
        </div>

        {err && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-xs font-bold text-[#991B1B] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{err}</span>
          </div>
        )}

        {batchResult && (
          <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#14532D]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                Đã tạo Candidate &lsquo;{String(batchResult.version_tag)}&rsquo;
              </span>
              <button
                type="button"
                onClick={() => onNavigate('admin_registry')}
                className="underline text-[#15803D] cursor-pointer"
              >
                Mở Safety Gate &amp; Kích hoạt
              </button>
            </div>
            <p className="text-[11px] font-mono text-[#3F5247]">
              KL-Divergence: {String(batchResult.kl_divergence)} • SHA-256:{' '}
              {String(batchResult.checkpoint_sha256).slice(0, 16)}…
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
