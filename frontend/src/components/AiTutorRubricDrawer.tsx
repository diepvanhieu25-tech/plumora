import { useEffect, useRef } from 'react'
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  History,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import type { TutorFeedbackOut, UpdatedCompetencyOut } from '../types'
import { formatNextReviewCountdown } from './ui/RetentionMeter'

interface AiTutorRubricDrawerProps {
  isOpen: boolean
  onClose: () => void
  conceptTitle: string
  graderSource: string
  stepScore: number
  tutorFeedback: TutorFeedbackOut | null
  updatedCompetency: UpdatedCompetencyOut | null
  hasNextStep?: boolean
  nextTierNumber?: number | null
  onCompleteAndReturn: () => void
}

export function AiTutorRubricDrawer({
  isOpen,
  onClose,
  conceptTitle,
  graderSource,
  stepScore,
  tutorFeedback,
  updatedCompetency,
  hasNextStep = false,
  nextTierNumber = null,
  onCompleteAndReturn,
}: AiTutorRubricDrawerProps) {
  const drawerRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeBtnRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const scorePct = Math.round(stepScore * 100)
  const retentionPct = updatedCompetency
    ? Math.round(updatedCompetency.retention_ebbinghaus * 100)
    : 100
  const stabilityBefore = updatedCompetency?.stability_s_before
  const stabilityAfter = updatedCompetency?.stability_s_after ?? updatedCompetency?.stability_s ?? 3.0
  const nextReviewLabel = formatNextReviewCountdown(
    updatedCompetency?.next_review_due_at,
    retentionPct < 60,
  )

  const allMatchedKeywords = tutorFeedback
    ? tutorFeedback.criteria_results.flatMap((c) => c.matched_keywords)
    : []
  const allHints = tutorFeedback
    ? tutorFeedback.criteria_results
        .map((c) => c.socratic_hint)
        .filter((h): h is string => Boolean(h && h.trim()))
    : []
  const allMissingKeywords = tutorFeedback
    ? tutorFeedback.criteria_results.flatMap((c) => c.missing_keywords)
    : []

  const isLlm = graderSource === 'llm_rubric'

  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex justify-end bg-inverse-surface/45 backdrop-blur-[1.5px]"
      role="dialog"
      aria-modal="true"
      aria-label="Nhận xét từ Gia sư AI và Biểu điểm"
      data-testid="scr14-ai-tutor-drawer"
    >
      <div className="w-full max-w-4xl bg-surface text-on-surface h-full shadow-2xl border-l border-outline-variant/40 flex flex-col">
        {/* Top Drawer Context Bar */}
        <div className="px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-headline font-extrabold text-on-surface">
                Nhận xét Gia sư AI &amp; Bóc tách Tiêu chí
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Chủ đề: <strong className="text-primary">{conceptTitle}</strong>
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface cursor-pointer transition-colors"
            aria-label="Đóng ngăn kéo Gia sư AI"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN (5 cols): Memory & Competency Progress */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/40 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center">
                      <Brain className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <h3 className="text-sm font-bold text-on-surface">Độ bền Ghi nhớ &amp; Tiến độ</h3>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      retentionPct < 60
                        ? 'bg-ai-sunlit-bg text-tertiary border border-ai-sunlit-border/40'
                        : 'bg-primary-container text-on-primary-container'
                    }`}
                  >
                    {retentionPct < 60 ? 'Cần củng cố' : 'Ghi nhớ tốt'}
                  </span>
                </div>

                {/* Retention Gauge */}
                <div className="bg-surface-container-low rounded-xl p-4 space-y-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-on-surface-variant font-medium">
                      Mức độ ghi nhớ hiện tại
                    </span>
                    <span
                      className={`text-xl font-black font-mono ${
                        retentionPct < 60 ? 'text-tertiary' : 'text-primary'
                      }`}
                    >
                      {retentionPct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        retentionPct < 60 ? 'bg-tertiary' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(5, retentionPct)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                    <span>Lịch ôn tập tiếp theo: {nextReviewLabel}</span>
                  </p>
                </div>

                {/* Real Stability Transition (Before -> After) */}
                {updatedCompetency && (
                  <div className="grid grid-cols-1 gap-2.5 text-xs">
                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
                      <span className="text-on-surface-variant">Chu kỳ ghi nhớ bền vững</span>
                      <span className="font-bold text-primary font-mono">
                        {stabilityBefore != null &&
                        Math.abs(stabilityAfter - stabilityBefore) >= 0.05
                          ? `${stabilityBefore.toFixed(1)} → ${stabilityAfter.toFixed(1)} ngày`
                          : `${stabilityAfter.toFixed(1)} ngày`}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low flex items-center justify-between">
                      <span className="text-on-surface-variant">Mức hiểu hiện tại</span>
                      <span className="font-bold text-on-surface">
                        {updatedCompetency.depth_label} ({Math.round(updatedCompetency.depth_level_norm * 100)}%)
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-primary-container/25 border border-primary/20 flex items-start gap-2 text-xs text-on-surface-variant">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Điểm số được đánh giá theo bộ tiêu chí chuẩn hóa để bạn biết rõ phần nào đã nắm vững và phần nào cần bổ sung.
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN (7 cols): Score, Rubric Breakdown & Socratic AI Tutor */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {/* Score Header */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary-container text-on-primary-container">
                    <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isLlm ? 'Phân tích bởi Gia sư AI' : 'Đánh giá theo Tiêu chí Chuẩn'}</span>
                  </span>
                  <h3 className="text-base font-extrabold text-on-surface">
                    Kết quả Đánh giá Câu trả lời
                  </h3>
                </div>

                <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between bg-primary-container/40 px-4 py-2.5 rounded-xl border border-primary/20">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    Điểm bước này
                  </span>
                  <span className="text-2xl font-black text-primary font-mono">
                    {scorePct} / 100
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                      scorePct >= 75
                        ? 'bg-primary text-on-primary'
                        : 'bg-tertiary text-on-tertiary'
                    }`}
                  >
                    {scorePct >= 75 ? 'ĐẠT CHUẨN' : 'CẦN BỔ SUNG'}
                  </span>
                </div>
              </div>

              {!tutorFeedback ? (
                <div className="p-4 rounded-xl bg-white border border-outline-variant/40 text-xs text-on-surface-variant">
                  Chưa có nhận xét chi tiết cho bước này.
                </div>
              ) : (
                <>
                  {/* Structured Criteria Breakdown */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/40 space-y-3">
                    <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                      <span>Chi tiết từng Tiêu chí ({tutorFeedback.criteria_results.length})</span>
                    </h3>

                    <div className="space-y-2.5">
                      {tutorFeedback.criteria_results.map((c, idx) => {
                        const critPct = Math.round(c.score * 100)
                        const passedCrit = c.score >= 0.75
                        const weightPts = Math.round(c.weight * 100)
                        const earnedPts = Math.round(c.score * weightPts)

                        return (
                          <div
                            key={`${c.name}-${idx}`}
                            className="p-3.5 rounded-xl bg-surface-container-low space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface">
                                    {passedCrit ? (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5 text-tertiary shrink-0" aria-hidden="true" />
                                    )}
                                    <span>
                                      {idx + 1}. {c.name}
                                    </span>
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      passedCrit
                                        ? 'bg-primary-container text-on-primary-container'
                                        : 'bg-ai-sunlit-bg text-tertiary border border-ai-sunlit-border/30'
                                    }`}
                                  >
                                    {critPct}%
                                  </span>
                                </div>

                                {c.matched_keywords.length > 0 && (
                                  <p className="text-xs text-primary">
                                    Ý đã làm tốt:{' '}
                                    <span className="font-semibold">
                                      {c.matched_keywords.join(', ')}
                                    </span>
                                  </p>
                                )}

                                {c.socratic_hint ? (
                                  <p className="text-xs text-ai-sunlit-text bg-ai-sunlit-bg border border-ai-sunlit-border/30 rounded-lg px-2.5 py-1.5 mt-1">
                                    Gợi ý tư duy: {c.socratic_hint}
                                  </p>
                                ) : c.missing_keywords.length > 0 ? (
                                  <p className="text-xs text-tertiary">
                                    Khía cạnh cần bổ sung:{' '}
                                    <span className="font-semibold">
                                      {c.missing_keywords.join(', ')}
                                    </span>
                                  </p>
                                ) : null}
                              </div>

                              <span
                                className={`text-xs font-bold font-mono shrink-0 ${
                                  passedCrit ? 'text-primary' : 'text-tertiary'
                                }`}
                              >
                                {earnedPts}/{weightPts}
                              </span>
                            </div>

                            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  passedCrit ? 'bg-primary' : 'bg-tertiary'
                                }`}
                                style={{ width: `${Math.max(4, critPct)}%` }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Socratic AI Tutor Guidance */}
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/40 space-y-3 text-xs leading-relaxed">
                    <div className="p-3.5 rounded-xl bg-primary-container/30 flex items-start gap-3">
                      <ThumbsUp className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className="font-bold text-primary block mb-0.5">
                          Tổng kết &amp; Điểm mạnh
                        </span>
                        <p className="text-on-surface">{tutorFeedback.summary}</p>
                        {allMatchedKeywords.length > 0 && (
                          <p className="text-[11px] text-primary mt-1 font-medium">
                            Luận điểm đã nắm vững: {allMatchedKeywords.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-ai-sunlit-bg/70 border border-ai-sunlit-border/30 flex items-start gap-3">
                      <Lightbulb className="w-4 h-4 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                      <div className="space-y-1">
                        <span className="font-bold text-ai-sunlit-text block">
                          Gợi ý đào sâu tư duy
                        </span>
                        {allHints.length > 0 ? (
                          <ul className="space-y-1 text-on-surface-variant list-disc pl-4">
                            {allHints.map((hint, hIdx) => (
                              <li key={hIdx}>{hint}</li>
                            ))}
                          </ul>
                        ) : allMissingKeywords.length > 0 ? (
                          <p className="text-on-surface-variant">
                            Để hoàn thiện câu trả lời ở bậc sâu hơn, hãy phân tích thêm các khía cạnh:{' '}
                            <strong className="text-on-surface">{allMissingKeywords.join(', ')}</strong>.
                          </p>
                        ) : (
                          <p className="text-on-surface-variant">
                            Bạn đã bao phủ đầy đủ các luận điểm cốt lõi của tầng đánh giá này.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contextual Footer CTA */}
        <div className="px-6 py-4 border-t border-outline-variant/30 bg-white flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant">
            {hasNextStep
              ? 'Kết quả bước vừa rồi đã được ghi nhận vào tiến độ của bạn.'
              : 'Hồ sơ năng lực và lịch ôn tập đã được cập nhật.'}
          </span>
          <button
            type="button"
            onClick={onCompleteAndReturn}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-primary text-on-primary font-bold text-xs sm:text-sm hover:bg-primary-dim cursor-pointer transition-colors shadow-sm"
          >
            <span>
              {hasNextStep
                ? nextTierNumber
                  ? `Tiếp tục Tầng ${nextTierNumber}`
                  : 'Tiếp tục bước kế tiếp'
                : 'Hoàn tất & Quay về Bản đồ Lộ trình'}
            </span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
