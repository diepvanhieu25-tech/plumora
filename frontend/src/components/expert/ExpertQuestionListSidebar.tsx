import { FileQuestion, Plus, Trash2 } from 'lucide-react'
import type { ExpertQuestionItem } from '../../types/expert'

export interface ExpertQuestionListSidebarProps {
  conceptSlug: string
  depthTier: number
  questions: ExpertQuestionItem[]
  loading: boolean
  editingId: string | null
  onCreateNew: () => void
  onSelectQuestion: (q: ExpertQuestionItem) => void
  onRequestDelete: (id: string) => void
}

export function ExpertQuestionListSidebar({
  conceptSlug,
  depthTier,
  questions,
  loading,
  editingId,
  onCreateNew,
  onSelectQuestion,
  onRequestDelete,
}: ExpertQuestionListSidebarProps) {
  return (
    <div className="lg:col-span-4 bg-white rounded-2xl border border-[#D8E2D8] p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E7EFE7]">
        <div className="flex items-center gap-1.5">
          <FileQuestion className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#14241B]">
            Câu hỏi Tầng {depthTier} ({questions.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#15803D] hover:bg-[#166534] text-white text-[11px] font-bold cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Tạo mới</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[#F6F8F5] animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/50 text-xs text-[#78350F] space-y-1">
          <div className="font-bold">Chưa có câu hỏi nào ở Tầng {depthTier}</div>
          <p className="text-[11px]">
            Hãy soạn ít nhất 1 câu hỏi cho tầng này để hoàn thiện chuỗi đào sâu 5 tầng của khái niệm{' '}
            <code className="font-mono font-bold">{conceptSlug}</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {questions.map((q) => {
            const isSelected = editingId === q.id
            return (
              <div
                key={q.id}
                className={`p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-[#F0FDF4] border-[#15803D]'
                    : 'bg-[#F6F8F5] border-[#D8E2D8] hover:border-[#15803D]/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(q)}
                    className="text-left flex-1 min-w-0 cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#57534E] mb-1">
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#D8E2D8] font-bold text-[#15803D]">
                        {q.task_type}
                      </span>
                      <span>v{q.version}</span>
                    </div>
                    <p className="text-xs font-semibold text-[#14241B] line-clamp-2">
                      {q.prompt}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRequestDelete(q.id)}
                    className="p-1.5 rounded-lg text-[#57534E] hover:text-[#9F1239] hover:bg-[#FFF1F2] cursor-pointer shrink-0"
                    title="Xóa câu hỏi"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
