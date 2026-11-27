import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LogOut,
  Target,
  XCircle,
} from 'lucide-react'
import type { DepthStepItem } from '../../types'

const TIER_LABELS: Record<number, string> = {
  1: 'Tầng 1: Khái niệm Cốt lõi',
  2: 'Tầng 2: Cơ chế Vận hành',
  3: 'Tầng 3: Xử lý Sự cố & Cạm bẫy',
  4: 'Tầng 4: Đánh đổi Kiến trúc',
  5: 'Tầng 5: Giải thích Bản chất Sâu',
}

const TASK_TYPE_LABELS: Record<string, string> = {
  mcq: 'Trắc nghiệm Kiến thức',
  troubleshooting: 'Tình huống Xử lý Sự cố',
  code_review: 'Đọc hiểu & Đánh giá Mã nguồn',
  constraint_shifting: 'Phân tích Thay đổi Ràng buộc',
  teach_back: 'Giải thích Bản chất (Feynman)',
}

export interface DepthProbeQuestionCardProps {
  stepItem: DepthStepItem
  isSpacedReview: boolean
  isMcq: boolean
  selectedOption: string
  onSelectOption: (key: string) => void
  writtenExplanation: string
  onWrittenExplanationChange: (val: string) => void
  mcqFeedback: {
    passed: boolean
    score: number
    nextStep: DepthStepItem | null
  } | null
  canSubmit: boolean
  submitting: boolean
  onContinueAfterMcq: () => void
  onRequestAbandon: () => void
  onSubmit: () => void
}

export function DepthProbeQuestionCard({
  stepItem,
  isSpacedReview,
  isMcq,
  selectedOption,
  onSelectOption,
  writtenExplanation,
  onWrittenExplanationChange,
  mcqFeedback,
  canSubmit,
  submitting,
  onContinueAfterMcq,
  onRequestAbandon,
  onSubmit,
}: DepthProbeQuestionCardProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ai-sunlit-bg text-ai-sunlit-text border border-ai-sunlit-border/40">
          <Target className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
          <span>
            {isSpacedReview
              ? 'Câu hỏi Ôn tập Trọng tâm'
              : TIER_LABELS[stepItem.depth_tier] ?? `Tầng ${stepItem.depth_tier}`}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{TASK_TYPE_LABELS[stepItem.task_type] ?? stepItem.task_type}</span>
        </span>
      </div>

      {/* Prompt Box */}
      <div className="p-4 sm:p-5 rounded-xl bg-surface-container-low border border-outline-variant/60 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-primary">
            {isSpacedReview ? 'Tình huống Ôn tập:' : `Câu hỏi Tầng ${stepItem.depth_tier}:`}
          </span>
          <span className="text-[11px] font-semibold text-on-surface-variant">
            Ngưỡng đạt: &ge; 75%
          </span>
        </div>
        <h1 className="text-sm sm:text-base font-bold text-on-surface leading-relaxed">
          {stepItem.prompt}
        </h1>
      </div>

      {/* Input Area */}
      {isMcq && stepItem.options ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface">Chọn đáp án đúng nhất:</span>
            <span className="text-[11px] text-outline hidden sm:inline">
              Nhấn phím 1–4 để chọn nhanh
            </span>
          </div>
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
            role="radiogroup"
            aria-label="Phương án trả lời"
          >
            {Object.entries(stepItem.options).map(([k, v]) => {
              const isSelected = selectedOption === k
              return (
                <label
                  key={k}
                  className={`flex flex-col p-3.5 rounded-xl border transition-all ${
                    mcqFeedback ? 'cursor-default opacity-90' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'border-2 border-primary bg-primary-container/25 shadow-2xs'
                      : 'border-outline-variant/60 hover:border-primary/50 bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="depth-mcq"
                        value={k}
                        disabled={Boolean(mcqFeedback)}
                        checked={isSelected}
                        onChange={() => onSelectOption(k)}
                        className="accent-primary"
                      />
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-primary' : 'text-on-surface'
                        }`}
                      >
                        Phương án {k}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isSelected
                          ? 'bg-primary text-on-primary'
                          : 'bg-white text-on-surface-variant'
                      }`}
                    >
                      {k}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface leading-relaxed">{v}</p>
                </label>
              )
            })}
          </div>

          {/* Immediate MCQ Micro-Feedback */}
          {mcqFeedback && (
            <div
              role="status"
              aria-live="polite"
              className={`mt-3 p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                mcqFeedback.passed
                  ? 'bg-primary-container/40 border-primary/35 text-on-primary-container'
                  : 'bg-ai-sunlit-bg border-ai-sunlit-border/50 text-ai-sunlit-text'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {mcqFeedback.passed ? (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <XCircle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <div className="text-xs sm:text-sm space-y-0.5">
                  <p className="font-bold">
                    {mcqFeedback.passed
                      ? `Chính xác (${Math.round(mcqFeedback.score * 100)}%)! Bạn đã vượt qua Tầng ${stepItem.depth_tier}.`
                      : 'Chưa chính xác! Hãy xem lại nhanh lý thuyết hoặc thử lại.'}
                  </p>
                  <p className="text-xs opacity-90">
                    {mcqFeedback.nextStep
                      ? `Bước kế tiếp: Tầng ${mcqFeedback.nextStep.depth_tier}.`
                      : 'Phiên đánh giá đã hoàn tất.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onContinueAfterMcq}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold shrink-0 cursor-pointer"
              >
                <span>
                  {mcqFeedback.nextStep
                    ? `Tiếp tục Tầng ${mcqFeedback.nextStep.depth_tier}`
                    : 'Xem Kết quả'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label htmlFor="depth-essay" className="text-xs font-bold text-on-surface">
              Phân tích &amp; Câu trả lời của bạn
            </label>
            <span className="text-[11px] text-secondary font-semibold">
              {writtenExplanation.trim().length} ký tự (tối thiểu 10 • tự động lưu nháp)
            </span>
          </div>
          <textarea
            id="depth-essay"
            rows={8}
            value={writtenExplanation}
            onChange={(e) => onWrittenExplanationChange(e.target.value)}
            placeholder="Trình bày phân tích kỹ thuật theo các tiêu chí ở cột bên phải..."
            className="w-full p-4 rounded-xl bg-surface border border-outline-variant text-sm text-on-surface focus:outline-none focus:bg-white focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed"
          />
        </div>
      )}

      {/* Action Buttons */}
      {!mcqFeedback && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onRequestAbandon}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
            data-testid="abandon-assessment-btn"
          >
            <LogOut className="w-4 h-4 text-outline" aria-hidden="true" />
            <span>Dừng phiên sớm</span>
          </button>

          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs sm:text-sm font-bold transition-colors shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>
              {submitting
                ? 'Đang chấm điểm & phân tích...'
                : isSpacedReview
                  ? 'Nộp bài Ôn tập'
                  : 'Nộp câu trả lời'}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
