import { Activity, X } from 'lucide-react'
import type { DagNode, RecommendationPayload } from '../../types'

interface ProvenanceDrawerProps {
  isDrawerOpen: boolean
  onClose: () => void
  recommendation: RecommendationPayload
  nodes: DagNode[]
}

export function ProvenanceDrawer({
  isDrawerOpen,
  onClose,
  recommendation,
  nodes,
}: ProvenanceDrawerProps) {
  if (!isDrawerOpen) return null

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="SCR-06 Ngăn kéo Bằng chứng RL 24 chiều"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white border-l border-[#D8E2D8] shadow-2xl p-6 overflow-y-auto space-y-5"
      data-testid="scr06-provenance-drawer"
    >
      <div className="flex items-center justify-between border-b border-[#D8E2D8] pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
          <h2 className="text-base font-bold">
            Bằng chứng Mô hình RL &amp; Vector Trạng thái 24 Chiều
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md hover:bg-stone-100"
          aria-label="Đóng ngăn kéo"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-2 text-xs font-mono bg-[#F6F8F5] p-3.5 rounded-lg border border-[#D8E2D8]">
        <div>policy_source: {recommendation.policy_source}</div>
        <div>state_source: {recommendation.state_source}</div>
        <div>guardrail_applied: {String(recommendation.guardrail_applied)}</div>
        <div>state_version: {recommendation.state_version}</div>
        <div className="break-all">
          checkpoint_sha256: {recommendation.checkpoint_sha256 ?? 'null (fallback)'}
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
                <th className="p-2">Slug</th>
                <th className="p-2">obs[i] Mastery</th>
                <th className="p-2">obs[i+12] Eligible</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n, idx) => (
                <tr key={n.slug} className="border-b border-[#D8E2D8] last:border-none">
                  <td className="p-2">{idx}</td>
                  <td className="p-2">{n.slug}</td>
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
    </aside>
  )
}
