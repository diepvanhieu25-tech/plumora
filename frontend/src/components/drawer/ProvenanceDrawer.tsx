import { Activity, Cpu, Database, ShieldCheck, X } from 'lucide-react'
import type { DagNode, RecommendationPayload } from '../../types'
import { useFocusTrap } from '../../utils/useFocusTrap'

interface ProvenanceDrawerProps {
  isDrawerOpen: boolean
  onClose: () => void
  recommendation: RecommendationPayload | null
  nodes: DagNode[]
}

export function ProvenanceDrawer({
  isDrawerOpen,
  onClose,
  recommendation,
  nodes,
}: ProvenanceDrawerProps) {
  const containerRef = useFocusTrap(isDrawerOpen, onClose)

  if (!isDrawerOpen) return null

  return (
    <aside
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="SCR-06 Ngăn kéo Bằng chứng RL 24 chiều"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-[#D8E2D8] shadow-2xl p-6 overflow-y-auto space-y-5"
      data-testid="scr06-provenance-drawer"
    >
      <div className="flex items-center justify-between border-b border-[#D8E2D8] pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
          <h2 className="text-base font-bold text-[#14241B]">
            Bằng chứng Mô hình RL &amp; Vector Trạng thái 24 Chiều
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-stone-100 text-[#57534E] hover:text-[#14241B] cursor-pointer"
          aria-label="Đóng ngăn kéo"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {!recommendation ? (
        <div className="p-4 bg-[#F8FAF7] border border-[#D8E2D8] rounded-lg text-xs text-[#57534E] text-center">
          Chưa có dữ liệu khuyến nghị AI hoặc mô hình đang nạp...
        </div>
      ) : (
        <>
          <div className="space-y-2 text-xs bg-[#F6F8F5] p-3.5 rounded-lg border border-[#D8E2D8] text-[#14241B]">
            <div className="flex items-center justify-between">
              <span className="text-[#57534E] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                <span>Nguồn chính sách (Policy Source):</span>
              </span>
              <span className="font-bold text-[#78350F]">
                {recommendation.policy_source === 'dqn'
                  ? 'Mô hình DQN (Deep Q-Network)'
                  : recommendation.policy_source === 'dqn_masked_q'
                    ? 'Mô hình DQN (Lọc hành động hợp lệ Masked-Q)'
                    : recommendation.policy_source === 'fallback_rule'
                      ? 'Quy tắc thứ tự Topo (Topo Fallback)'
                      : recommendation.policy_source === 'completed'
                        ? 'Đã hoàn tất toàn bộ lộ trình'
                        : recommendation.policy_source}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Chế độ vận hành (Degraded):</span>
              <span className={`font-semibold ${recommendation.degraded ? 'text-[#B91C1C]' : 'text-[#15803D]'}`}>
                {recommendation.degraded ? 'Chế độ dự phòng (Degraded)' : 'Bình thường'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#0D9488]" aria-hidden="true" />
                <span>Nguồn trạng thái (State Source):</span>
              </span>
              <span className="font-medium">
                {recommendation.state_source === 'redis_cache'
                  ? 'Bộ đệm Redis Cache (24-D)'
                  : 'PostgreSQL Database'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Kiểm soát an toàn (Guardrail):</span>
              <span className="font-semibold text-[#15803D]">
                {recommendation.guardrail_applied ? 'Đã kích hoạt' : 'Không'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#57534E]">Phiên bản trạng thái (State Version):</span>
              <span className="font-mono font-bold">v{recommendation.state_version}</span>
            </div>
            <div className="flex items-start justify-between gap-2 pt-1 border-t border-[#E7E5E4]">
              <span className="text-[#57534E] shrink-0 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                <span>Mã băm Checkpoint:</span>
              </span>
              <span className="font-mono text-[11px] text-[#15803D] break-all text-right">
                {recommendation.checkpoint_sha256 ?? 'Không có (Dự phòng)'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#3F5247]">
              Vector Observation 24 Chiều (obs[0..11] mastery + obs[12..23] is_eligible)
            </h3>
            <div className="border border-[#D8E2D8] rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-stone-100 border-b border-[#D8E2D8]">
                  <tr>
                    <th className="p-2">ID</th>
                    <th className="p-2">Khái niệm</th>
                    <th className="p-2">Mastery (0..1)</th>
                    <th className="p-2">Eligible (0/1)</th>
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n, idx) => (
                    <tr key={n.slug} className="border-b border-[#D8E2D8] last:border-none">
                      <td className="p-2">{idx}</td>
                      <td className="p-2">{n.title}</td>
                      <td className="p-2">
                        {(recommendation.observation_24d[idx] ?? n.mastery_score).toFixed(2)}
                      </td>
                      <td className="p-2">
                        {(
                          recommendation.observation_24d[idx + 12] ??
                          (n.status === 'unlocked' ? 1.0 : 0.0)
                        ).toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </aside>
  )
}
