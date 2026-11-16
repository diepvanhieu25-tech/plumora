import { Check, FileCheck2, Lock } from 'lucide-react'
import type { ConceptDetail } from '../../types'

interface McqQuizFormProps {
  currentConcept: ConceptDetail
  submissionId: string
  selectedAnswers: Record<string, 'A' | 'B' | 'C' | 'D'>
  onSelectAnswer: (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D') => void
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
  const questions = currentConcept.questions ?? []
  const totalQuestions = questions.length
  const answeredCount = questions.filter((q) => selectedAnswers[q.id] !== undefined).length
  const isComplete = totalQuestions > 0 && answeredCount === totalQuestions
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0

  return (
    <form onSubmit={onSubmit} className="space-y-6" data-testid="scr04-quiz-section">
      {/* 1. Header Card: Tiến độ tổng quan (Stitch SCR-04) */}
      <div className="bg-white border border-[#D8E2D8] rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-extrabold text-base text-[#14241B]">
              Đề kiểm tra Trắc nghiệm Khách quan
            </h2>
            <p className="text-xs text-[#57534E] mt-0.5">
              4 câu Single-choice — Ngưỡng đạt yêu cầu:{' '}
              <span className="font-bold text-[#15803D]">≥ 75% (đúng tối thiểu 3/4 câu)</span>
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono font-bold text-[#15803D] px-2.5 py-1 bg-[#F0FDF4] rounded-full border border-[#BBF7D0]">
              {answeredCount} / {totalQuestions} Hoàn thành
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
          <div
            className="bg-[#15803D] h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
        <div className="flex justify-between items-center text-[11px] text-[#57534E] mt-2 font-mono">
          <span>Tiến độ phản hồi: {progressPercent}%</span>
          <span className="text-[#15803D] font-semibold">
            {isComplete ? 'Sẵn sàng nộp bài kiểm tra' : 'Vui lòng hoàn thành tất cả câu hỏi'}
          </span>
        </div>
      </div>

      {/* Quiz Error Alert */}
      {quizError ? (
        <div
          role="alert"
          className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] text-xs font-semibold text-[#9F1239]"
        >
          {quizError}
        </div>
      ) : null}

      {/* 2. List of 4 MCQ Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const isAnswered = selectedAnswers[q.id] !== undefined
          return (
            <article
              key={q.id}
              className={`bg-white border rounded-xl p-5 shadow-sm space-y-4 transition-all ${
                isAnswered ? 'border-[#BBF7D0]' : 'border-[#D8E2D8]'
              }`}
              data-testid={`question-block-${idx + 1}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-2.5">
                  <span className="shrink-0 w-6 h-6 rounded-md bg-[#F0FDF4] text-[#15803D] text-xs font-bold flex items-center justify-center font-mono border border-[#BBF7D0]">
                    0{idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-[#14241B] leading-snug">
                    Câu {idx + 1} / {totalQuestions}: {q.prompt}
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#57534E] bg-[#F6F8F5] px-1.5 py-0.5 rounded border border-[#D8E2D8]">
                  1 điểm
                </span>
              </div>

              {/* Radio Options A, B, C, D */}
              <div className="space-y-2.5 pl-0 sm:pl-8">
                {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                  const isChecked = selectedAnswers[q.id] === optKey
                  return (
                    <label
                      key={optKey}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                        isChecked
                          ? 'border-2 border-[#15803D] bg-[#F0FDF4]'
                          : 'border-[#D8E2D8] hover:border-[#15803D]/50 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'border-[#15803D] bg-[#15803D] text-white'
                              : 'border-[#D8E2D8]'
                          }`}
                        >
                          {isChecked ? <div className="w-1.5 h-1.5 rounded-full bg-white"></div> : null}
                        </div>
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          value={optKey}
                          checked={isChecked}
                          onChange={() => onSelectAnswer(q.id, optKey)}
                          className="sr-only"
                          data-testid={`quiz-q${idx + 1}-opt-${optKey}`}
                        />
                        <span className="text-xs font-medium text-[#14241B]">
                          <strong className={isChecked ? 'text-[#15803D]' : 'text-[#57534E]'}>
                            {optKey}.
                          </strong>{' '}
                          {q.options[optKey]}
                        </span>
                      </div>
                      {isChecked ? (
                        <Check className="w-4 h-4 text-[#15803D] stroke-[2.5]" aria-hidden="true" />
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      {/* 3. Form Action Bar (Stitch SCR-04) */}
      <div className="bg-white border border-[#D8E2D8] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-[#57534E] font-mono">
          <Lock className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
          <span>
            submission_id: <strong className="text-[#14241B]">{submissionId.slice(0, 13)}...</strong>
          </span>
        </div>

        <button
          type="submit"
          disabled={!isComplete || isLoading}
          className="w-full sm:w-auto px-6 py-3 bg-[#15803D] hover:bg-[#166534] disabled:bg-[#D8E2D8] disabled:text-[#57534E] text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
          data-testid="submit-quiz-btn"
        >
          <FileCheck2 className="w-4 h-4" aria-hidden="true" />
          <span>
            {isLoading
              ? 'Đang chấm điểm trong ACID Transaction...'
              : !isComplete
                ? `Nộp bài kiểm tra (Chọn đủ ${totalQuestions}/${totalQuestions} câu)`
                : 'Nộp bài kiểm tra'}
          </span>
        </button>
      </div>
    </form>
  )
}
