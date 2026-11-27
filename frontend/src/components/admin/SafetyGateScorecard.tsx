import { Check, ShieldAlert, ShieldCheck } from 'lucide-react'
import type { ModelRegistryItem } from '../../types/admin'

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

export interface SafetyGateScorecardProps {
  activeModel: ModelRegistryItem | null
  selectedCandidate: ModelRegistryItem | null
  klMax: number
  busyAction: string | null
  onRequestActivate: (model: ModelRegistryItem) => void
}

export function SafetyGateScorecard({
  activeModel,
  selectedCandidate,
  klMax,
  busyAction,
  onRequestActivate,
}: SafetyGateScorecardProps) {
  const blockReasons = selectedCandidate ? translateBlockReasons(selectedCandidate, klMax) : []

  return (
    <div className="lg:col-span-7 space-y-5">
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
                  disabled={busyAction !== null || selectedCandidate.gate_verdict !== 'PASSED'}
                  onClick={() => onRequestActivate(selectedCandidate)}
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
  )
}
