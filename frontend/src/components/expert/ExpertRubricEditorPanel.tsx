import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Layers,
  Loader2,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { apiExpertRubricDryRun } from '../../api'
import type { ExpertRubricDryRunResponse, ExpertTaskType } from '../../types/expert'

export interface RubricRow {
  name: string
  weight: number
  keywords: string
  socratic_hint: string
}

export interface ExpertRubricEditorPanelProps {
  conceptSlug: string
  depthTier: number
  editingId: string | null
  taskType: ExpertTaskType
  prompt: string
  onPromptChange: (val: string) => void
  mcqOptions: { A: string; B: string; C: string; D: string }
  onMcqOptionsChange: Dispatch<SetStateAction<{ A: string; B: string; C: string; D: string }>>
  correctOptionKey: 'A' | 'B' | 'C' | 'D'
  onCorrectOptionKeyChange: (val: 'A' | 'B' | 'C' | 'D') => void
  criteria: RubricRow[]
  onCriteriaChange: Dispatch<SetStateAction<RubricRow[]>>
  refExp: string
  onRefExpChange: (val: string) => void
  totalWeight: number
  isWeightValid: boolean
  isMcqValid: boolean
  hasAllKeywords: boolean
  submitting: boolean
  statusMsg: string | null
  errorMsg: string | null
  onError: (msg: string | null) => void
  onResetToNew: () => void
  onSave: () => void
  buildRubricPayload: () => {
    criteria: Array<{
      name: string
      weight: number
      required_keywords: string[]
      socratic_hint: string | null
    }>
    reference_explanation: string
  }
  dryRunResetKey: string
}

export function ExpertRubricEditorPanel({
  conceptSlug,
  depthTier,
  editingId,
  taskType,
  prompt,
  onPromptChange,
  mcqOptions,
  onMcqOptionsChange,
  correctOptionKey,
  onCorrectOptionKeyChange,
  criteria,
  onCriteriaChange,
  refExp,
  onRefExpChange,
  totalWeight,
  isWeightValid,
  isMcqValid,
  hasAllKeywords,
  submitting,
  statusMsg,
  errorMsg,
  onError,
  onResetToNew,
  onSave,
  buildRubricPayload,
  dryRunResetKey,
}: ExpertRubricEditorPanelProps) {
  const [sampleAnswer, setSampleAnswer] = useState('')
  const [dryRunning, setDryRunning] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<ExpertRubricDryRunResponse | null>(null)

  useEffect(() => {
    setDryRunResult(null)
  }, [dryRunResetKey])

  async function handleDryRunRubric() {
    if (taskType === 'mcq' || !sampleAnswer.trim() || !isWeightValid || !hasAllKeywords) return
    setDryRunning(true)
    onError(null)
    try {
      const res = await apiExpertRubricDryRun({
        prompt: prompt.trim() || 'Câu hỏi đánh giá tự luận',
        sample_answer: sampleAnswer.trim(),
        rubric: buildRubricPayload(),
      })
      setDryRunResult(res)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Lỗi chạy thử bộ chấm Rubric')
    } finally {
      setDryRunning(false)
    }
  }

  return (
    <div className="lg:col-span-8 space-y-5">
      <div className="bg-white rounded-2xl border border-[#D8E2D8] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-[#E7EFE7]">
          <h2 className="text-sm font-extrabold text-[#14241B]">
            {editingId ? 'Chỉnh sửa Câu hỏi Hiện có' : 'Soạn Câu hỏi Mới'} —{' '}
            <code className="font-mono text-[#15803D]">{conceptSlug}</code> (Tầng {depthTier})
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={onResetToNew}
              className="text-xs font-semibold text-[#15803D] hover:underline cursor-pointer"
            >
              Chuyển sang tạo câu mới
            </button>
          )}
        </div>

        {/* Prompt Input */}
        <div>
          <label
            htmlFor="scr16-prompt-textarea"
            className="block text-xs font-bold text-[#14241B] mb-1.5"
          >
            Nội dung câu hỏi / Tình huống kỹ thuật
          </label>
          <textarea
            id="scr16-prompt-textarea"
            rows={4}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Nhập câu hỏi, tình huống sự cố, đoạn code cần review hoặc yêu cầu giải thích..."
            className="w-full rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] p-3 text-xs text-[#14241B] focus:bg-white focus:border-[#15803D] focus:outline-none leading-relaxed"
          />
        </div>

        {taskType === 'mcq' ? (
          <div className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
                <span>4 Phương án Trắc nghiệm (A, B, C, D)</span>
              </span>
              <div className="flex items-center gap-2">
                <label htmlFor="mcq-correct-key" className="text-[#57534E]">
                  Đáp án đúng:
                </label>
                <select
                  id="mcq-correct-key"
                  value={correctOptionKey}
                  onChange={(e) =>
                    onCorrectOptionKeyChange(e.target.value as 'A' | 'B' | 'C' | 'D')
                  }
                  className="rounded-lg border border-[#D8E2D8] bg-white px-2.5 py-1 text-xs font-mono font-bold text-[#15803D]"
                >
                  {(['A', 'B', 'C', 'D'] as const).map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((k) => (
                <div
                  key={k}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border bg-white ${
                    correctOptionKey === k ? 'border-[#15803D]' : 'border-[#D8E2D8]'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                      correctOptionKey === k
                        ? 'bg-[#15803D] text-white'
                        : 'bg-[#F6F8F5] text-[#14241B]'
                    }`}
                  >
                    {k}
                  </span>
                  <input
                    value={mcqOptions[k]}
                    onChange={(e) =>
                      onMcqOptionsChange((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    placeholder={`Nội dung phương án ${k}`}
                    className="flex-1 text-xs bg-transparent focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Structured Rubric Criteria */}
            <div className="p-4 rounded-xl bg-[#F6F8F5] border border-[#D8E2D8] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                <span>Bảng Tiêu chí Rubric (Tổng trọng số = 1.0)</span>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-mono ${isWeightValid ? 'text-[#15803D]' : 'text-[#9F1239]'}`}
                  >
                    Tổng: {totalWeight}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (criteria.length === 0) return
                      const base = Math.floor(100 / criteria.length) / 100
                      const rem = Math.round((1.0 - base * criteria.length) * 100) / 100
                      onCriteriaChange((prev) =>
                        prev.map((c, idx) => ({
                          ...c,
                          weight: idx === 0 ? Number((base + rem).toFixed(2)) : base,
                        })),
                      )
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F0FDF4] border border-[#86EFAC] text-[#14532D] text-[11px] font-bold cursor-pointer"
                  >
                    <span>Tự cân bằng = 1.0</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onCriteriaChange((prev) => [
                        ...prev,
                        { name: `Tiêu chí ${prev.length + 1}`, weight: 0, keywords: '', socratic_hint: '' },
                      ])
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-[#D8E2D8] text-[#15803D] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Thêm tiêu chí</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {criteria.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-white border border-[#D8E2D8] space-y-2 text-xs"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <input
                        value={row.name}
                        onChange={(e) =>
                          onCriteriaChange((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)),
                          )
                        }
                        placeholder="Tên tiêu chí đánh giá"
                        className="sm:col-span-7 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5"
                      />
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={row.weight}
                        onChange={(e) =>
                          onCriteriaChange((prev) =>
                            prev.map((r, i) =>
                              i === idx ? { ...r, weight: Number(e.target.value) } : r,
                            ),
                          )
                        }
                        aria-label={`Trọng số tiêu chí ${idx + 1}`}
                        className="sm:col-span-3 rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-mono"
                      />
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          type="button"
                          disabled={criteria.length <= 1}
                          onClick={() =>
                            onCriteriaChange((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded-lg text-[#9F1239] hover:bg-[#FFF1F2] disabled:opacity-30 cursor-pointer"
                          title="Xóa tiêu chí"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={row.keywords}
                      onChange={(e) =>
                        onCriteriaChange((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, keywords: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Từ khóa bắt buộc (phân tách bằng dấu phẩy, vd: index, b-tree, scan)"
                      className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 font-mono text-[11px]"
                    />
                    <input
                      value={row.socratic_hint}
                      onChange={(e) =>
                        onCriteriaChange((prev) =>
                          prev.map((r, i) =>
                            i === idx ? { ...r, socratic_hint: e.target.value } : r,
                          ),
                        )
                      }
                      placeholder="Gợi ý Socratic khi học viên thiếu tiêu chí này (tùy chọn)"
                      className="w-full rounded-lg border border-[#D8E2D8] bg-[#F6F8F5] px-2.5 py-1.5 text-[11px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Reference Explanation */}
            <div>
              <label
                htmlFor="scr16-ref-exp"
                className="block text-xs font-bold text-[#14241B] mb-1"
              >
                Lời giải thích tham chiếu chuẩn (Reference Explanation)
              </label>
              <textarea
                id="scr16-ref-exp"
                rows={2}
                value={refExp}
                onChange={(e) => onRefExpChange(e.target.value)}
                placeholder="Giải thích chuẩn để AI Tutor phản hồi cho học viên..."
                className="w-full rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] p-2.5 text-xs focus:bg-white focus:border-[#15803D] focus:outline-none"
              />
            </div>

            {/* Live Rubric Dry-Run Tool */}
            <div
              className="p-4 rounded-xl bg-[#F0FDF4]/70 border border-[#BBF7D0] space-y-3"
              data-testid="live-rubric-dry-run-panel"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-extrabold text-[#14532D]">
                  Kiểm thử Bộ chấm Rubric Trực tiếp (Live Rubric Dry-Run)
                </h3>
                <button
                  type="button"
                  disabled={dryRunning || !sampleAnswer.trim() || !isWeightValid || !hasAllKeywords}
                  onClick={() => void handleDryRunRubric()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
                >
                  {dryRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>Chạy thử Bộ chấm</span>
                </button>
              </div>

              <textarea
                rows={2}
                value={sampleAnswer}
                onChange={(e) => setSampleAnswer(e.target.value)}
                placeholder="Nhập thử câu trả lời mẫu của học viên để kiểm tra điểm số và từ khóa khớp..."
                className="w-full rounded-lg border border-[#BBF7D0] bg-white p-2.5 text-xs focus:border-[#15803D] focus:outline-none"
              />

              {dryRunResult && (
                <div className="p-3 rounded-lg bg-white border border-[#D8E2D8] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">
                      Điểm chấm thử:{' '}
                      <span
                        className={`font-mono ${
                          dryRunResult.passed ? 'text-[#15803D]' : 'text-[#9F1239]'
                        }`}
                      >
                        {Math.round(dryRunResult.rubric_score * 100)}% (
                        {dryRunResult.passed ? 'ĐẠT >= 75%' : 'CHƯA ĐẠT'})
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-[#57534E]">
                      Nguồn: {dryRunResult.grader_source}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#3F5247]">{dryRunResult.tutor_summary}</p>
                  <div className="space-y-1">
                    {dryRunResult.criteria_results.map((cr, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded bg-[#F6F8F5] flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="font-semibold text-[#14241B]">{cr.name}</span>
                        <span className="font-mono">
                          Điểm: {Math.round(cr.score * 100)}% | Khớp:{' '}
                          {cr.matched_keywords.join(', ') || 'Không'} | Thiếu:{' '}
                          {cr.missing_keywords.join(', ') || 'Không'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-bold text-[#9F1239] flex items-center gap-2"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        {statusMsg && (
          <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#14532D] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" aria-hidden="true" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Save Footer */}
        <div className="pt-3 border-t border-[#E7EFE7] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#57534E]">
            {isWeightValid && isMcqValid && hasAllKeywords
              ? 'Cấu trúc câu hỏi hợp lệ để xuất bản.'
              : 'Vui lòng điền đủ đề bài, phương án hoặc từ khóa Rubric (tổng trọng số = 1.0).'}
          </span>
          <button
            type="button"
            disabled={
              submitting ||
              !prompt.trim() ||
              !isWeightValid ||
              !isMcqValid ||
              !hasAllKeywords
            }
            onClick={onSave}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#15803D] hover:bg-[#166534] disabled:opacity-45 text-white text-xs font-bold cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Đang lưu...'
                : editingId
                  ? 'Cập nhật Câu hỏi & Rubric'
                  : 'Lưu Câu hỏi & Rubric'}
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
