import { FileCheck2 } from 'lucide-react'
import type { ConceptDetail } from '../../types'

interface McqQuizFormProps {
  currentConcept: ConceptDetail
  submissionId: string
  selectedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>
  onSelectAnswer: (questionId: string, option: 'A' | 'B' | 'C' | 'D') => void
  onSubmit: (e: React.FormEvent) => Promise<void>
  isLoading: boolean
  quizError: string | null
}

export function McqQuizForm({
  currentConcept,
  submissionId,
  selectedAnswers,
  onSelectAnswer,
  onSubmit,
  isLoading,
  quizError,
}: McqQuizFormProps) {
  const answeredCount = Object.keys(selectedAnswers).length
  const allFourAnswered = answeredCount === 4

  return (
    <section
      aria-label="SCR-04 Đề kiểm tra Quiz 4 câu và Phản hồi Mastery"
      className="plumora-card space-y-5"
      data-testid="scr04-quiz-section"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D8E2D8] pb-3">
        <div>
          <h2 className="text-lg font-bold text-[#14241B]">
            Đề kiểm tra Trắc nghiệm (4 câu Single-choice — Đạt chuẩn &gt;= 75%)
          </h2>
          <p className="text-xs text-[#3F5247]">
            Đề kiểm tra: {currentConcept.title} | Mã lượt nộp chống trùng lặp (submission_id):{' '}
            <span className="font-mono">{submissionId.slice(0, 12)}...</span>
          </p>
        </div>
        <div
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-stone-100 border border-[#D8E2D8]"
          data-testid="quiz-answered-counter"
        >
          Đã chọn {answeredCount} / 4 câu hỏi
        </div>
      </div>

      {quizError ? (
        <div
          role="alert"
          className="p-3 rounded-lg bg-[#FFF1F2] border border-[#FDA4AF] text-[#9F1239] text-xs font-medium flex items-center justify-between"
        >
          <span>{quizError}</span>
          <span className="font-mono">Idempotent Retry Sẵn sàng</span>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        {(currentConcept?.questions ?? []).map((q, idx) => (
          <fieldset
            key={q.id}
            className="p-4 rounded-xl border border-[#D8E2D8] bg-[#F6F8F5] space-y-2.5"
          >
            <legend className="font-semibold text-sm text-[#14241B]">
              Câu {idx + 1} / 4: {q.prompt}
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                const isChecked = selectedAnswers[q.id] === optKey
                return (
                  <label
                    key={optKey}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer text-xs font-medium ${
                      isChecked
                        ? 'bg-[#F0FDF4] border-2 border-[#15803D] text-[#14241B]'
                        : 'bg-white border-[#D8E2D8] text-[#3F5247]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={optKey}
                      checked={isChecked}
                      onChange={() => onSelectAnswer(q.id, optKey)}
                      className="mt-0.5 accent-[#15803D]"
                      data-testid={`quiz-q${idx + 1}-opt-${optKey}`}
                    />
                    <span>
                      <strong>{optKey}.</strong> {q.options[optKey]}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <span className="text-xs text-[#3F5247]">
            {!allFourAnswered
              ? 'Vui lòng chọn đủ 4/4 câu hỏi để mở khóa nút Nộp bài kiểm tra.'
              : 'Đã chọn đủ 4/4 câu hỏi. Sẵn sàng chấm điểm trong ACID Transaction.'}
          </span>

          <button
            type="submit"
            disabled={!allFourAnswered || isLoading}
            className="plumora-btn-primary"
            data-testid="submit-quiz-btn"
          >
            <FileCheck2 className="w-4 h-4" aria-hidden="true" />
            <span>Nộp bài kiểm tra</span>
          </button>
        </div>
      </form>
    </section>
  )
}
