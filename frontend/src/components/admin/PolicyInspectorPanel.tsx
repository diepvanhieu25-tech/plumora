import { useState } from 'react'
import { Activity, Clock, Loader2, Play } from 'lucide-react'
import { apiAdminInspectPolicy } from '../../api'
import type { ModelRegistryItem, PolicyInspectResponse } from '../../types/admin'

export interface PolicyInspectorPanelProps {
  models: ModelRegistryItem[]
}

export function PolicyInspectorPanel({ models }: PolicyInspectorPanelProps) {
  const [inspectDomain, setInspectDomain] = useState('backend')
  const [simDaysOffset, setSimDaysOffset] = useState(0)
  const [inspectModelId, setInspectModelId] = useState<string>('')
  const [inspecting, setInspecting] = useState(false)
  const [policyInspect, setPolicyInspect] = useState<PolicyInspectResponse | null>(null)
  const [inspectErr, setInspectErr] = useState<string | null>(null)

  async function handleInspectPolicy() {
    setInspecting(true)
    setInspectErr(null)
    try {
      const res = await apiAdminInspectPolicy({
        domain_slug: inspectDomain,
        simulated_time_offset_days: simDaysOffset,
        checkpoint_model_id: inspectModelId || null,
      })
      setPolicyInspect(res)
    } catch (e) {
      setInspectErr(e instanceof Error ? e.message : 'Không thể phân tích chính sách mô hình')
    } finally {
      setInspecting(false)
    }
  }

  return (
    <div
      className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4"
      data-testid="admin-policy-inspector"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E7EFE7]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-extrabold text-[#14241B]">
              Thanh tra Chính sách GNN-PPO &amp; Đồng hồ Mô phỏng Thời gian (What-If Clock)
            </h2>
            <p className="text-xs text-[#57534E]">
              Kiểm tra ma trận đặc trưng N x 8, xác suất hành động thô (Raw) vs sau Guardrail khi giả lập trôi thời gian Ebbinghaus (chỉ dành cho Admin).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            aria-label="Lĩnh vực kiểm tra chính sách"
            value={inspectDomain}
            onChange={(e) => setInspectDomain(e.target.value)}
            className="rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-bold"
          >
            <option value="backend">backend</option>
            <option value="frontend">frontend</option>
            <option value="devops">devops</option>
          </select>

          <select
            aria-label="Checkpoint kiểm tra"
            value={inspectModelId}
            onChange={(e) => setInspectModelId(e.target.value)}
            className="rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-mono"
          >
            <option value="">Active Production Model</option>
            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.version_tag} ({m.gate_verdict})
              </option>
            ))}
          </select>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FFFBEB] border border-[#F59E0B]/60">
            <Clock className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
            <label htmlFor="what-if-days" className="font-semibold text-[#78350F]">
              What-If +Ngày:
            </label>
            <input
              id="what-if-days"
              type="number"
              min={0}
              max={365}
              value={simDaysOffset}
              onChange={(e) => setSimDaysOffset(Math.max(0, Number(e.target.value) || 0))}
              className="w-14 rounded border border-[#F59E0B] bg-white px-1.5 py-0.5 font-mono text-center"
            />
          </div>

          <button
            type="button"
            disabled={inspecting}
            onClick={() => void handleInspectPolicy()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white font-bold cursor-pointer"
          >
            {inspecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>Phân tích Chính sách</span>
          </button>
        </div>
      </div>

      {inspectErr && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239]"
        >
          {inspectErr}
        </div>
      )}

      {policyInspect && (
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              Hành động được chọn:{' '}
              <strong className="text-[#15803D]">
                ({policyInspect.selected_action.concept_slug},{' '}
                {policyInspect.selected_action.learning_mode})
              </strong>
            </div>
            <div className="text-[#3F5247]">
              Model: <strong>{policyInspect.model_version}</strong> • Source:{' '}
              <strong>{policyInspect.selected_action.policy_source}</strong> • Guardrail:{' '}
              <strong>{String(policyInspect.selected_action.guardrail_applied)}</strong> • Offset:{' '}
              <strong>+{policyInspect.simulated_time_offset_days}d</strong>
            </div>
          </div>

          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="bg-[#F6F8F5] text-[#57534E]">
                  <th className="py-2 px-2">Node</th>
                  <th className="py-2 px-2">Depth</th>
                  <th className="py-2 px-2">Ret R(t)</th>
                  <th className="py-2 px-2">Elig / Rev</th>
                  <th className="py-2 px-2">Guarded P(Learn/Probe/Code/Rev)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EFE7]">
                {policyInspect.nodes.map((n) => {
                  const isPicked = n.concept_slug === policyInspect.selected_action.concept_slug
                  return (
                    <tr key={n.concept_slug} className={isPicked ? 'bg-[#FFFBEB] font-bold' : ''}>
                      <td className="py-1.5 px-2">
                        [T{n.tier}] {n.concept_slug}
                      </td>
                      <td className="py-1.5 px-2">{Math.round((n.features[0] ?? 0) * 100)}%</td>
                      <td className="py-1.5 px-2">{Math.round((n.features[2] ?? 1) * 100)}%</td>
                      <td className="py-1.5 px-2">
                        {n.features[3] === 1 ? 'OK' : 'Lock'} /{' '}
                        {n.features[4] === 1 ? 'Rev' : '-'}
                      </td>
                      <td className="py-1.5 px-2">
                        {(n.guarded_probs.Learn_New ?? 0).toFixed(2)} /{' '}
                        {(n.guarded_probs.Deep_Probe ?? 0).toFixed(2)} /{' '}
                        {(n.guarded_probs.Code_Practice ?? 0).toFixed(2)} /{' '}
                        {(n.guarded_probs.Spaced_Review ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
