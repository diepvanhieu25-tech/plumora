import { useEffect, useRef } from 'react'
import {
  Bot,
  Brain,
  CheckCircle2,
  History,
  Lightbulb,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import type { TutorFeedbackOut, UpdatedCompetencyOut } from '../types'

interface AiTutorRubricDrawerProps {
  isOpen: boolean
  onClose: () => void
  conceptSlug: string
  graderSource: string
  stepScore: number
  tutorFeedback: TutorFeedbackOut | null
  updatedCompetency: UpdatedCompetencyOut | null
  onCompleteAndReturn: () => void
}

export function AiTutorRubricDrawer({
  isOpen,
  onClose,
  conceptSlug,
  graderSource,
  stepScore,
  tutorFeedback,
  updatedCompetency,
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
        return
      }
      if (event.key === 'Tab' && drawerRef.current) {
        const focusables = Array.from(
          drawerRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey) {
          if (
            document.activeElement === first ||
            !drawerRef.current.contains(document.activeElement)
          ) {
            event.preventDefault()
            last.focus()
          }
        } else if (
          document.activeElement === last ||
          !drawerRef.current.contains(document.activeElement)
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isFallback = graderSource === 'deterministic_fallback'
  const scorePct = Math.round(stepScore * 100)
  const retentionPct = updatedCompetency
    ? Math.round(updatedCompetency.retention_ebbinghaus * 100)
    : 100
  const currentS = updatedCompetency ? updatedCompetency.stability_s : 3.0
  const projectedS = Number((currentS * 2.1).toFixed(1))

  const allMatchedKeywords = tutorFeedback
    ? tutorFeedback.criteria_results.flatMap((c) => c.matched_keywords)
    : []
  const allMissingKeywords = tutorFeedback
    ? tutorFeedback.criteria_results.flatMap((c) => c.missing_keywords)
    : []

  return (
    <div
      ref={drawerRef}
      className="fixed inset-0 z-50 flex justify-end bg-inverse-surface/45 backdrop-blur-[1.5px]"
      role="dialog"
      aria-modal="true"
      aria-label="Phản hồi Gia sư AI và Biểu điểm Rubric"
      data-testid="scr14-ai-tutor-drawer"
    >
      <div className="w-full max-w-5xl bg-surface text-on-surface h-full shadow-2xl border-l border-outline-variant/30 flex flex-col">
        {/* Top Drawer Context Bar */}
        <div className="px-6 py-4 border-b border-outline-variant/25 flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-headline font-extrabold text-on-surface">
                  Phân tích Tiêu chí &amp; Gia sư AI
                </h2>
                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold">
                  Chấm điểm Minh bạch
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-0.5">
                <span>Chủ đề:</span>
                <span className="font-mono text-primary font-bold">{conceptSlug}</span>
              </div>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-lowest hover:text-on-surface cursor-pointer transition-colors"
            aria-label="Đóng ngăn kéo Gia sư AI"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body: 2-Column Split Workspace matching SCR-14 Stitch Reference */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* LEFT COLUMN: Ebbinghaus Spaced Repetition & Memory Retention Workspace */}
            <div className="flex flex-col gap-5">
              {/* Ebbinghaus Header Banner */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold font-label uppercase tracking-wider mb-2">
                      <History className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Thuật toán 2-Component Memory</span>
                    </div>
                    <h3 className="text-base font-headline font-extrabold text-on-surface tracking-tight leading-snug">
                      Trạm Ôn tập Ngắt quãng Ebbinghaus — Khôi phục Độ bền Trí nhớ R(t)
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1.5 leading-relaxed">
                      Tính toán độ dốc quên lãng theo mô hình Trí nhớ Hai Thành phần (Độ ổn định{' '}
                      <span className="font-mono font-semibold text-on-surface">S</span> &amp; Khả
                      năng Thu hồi{' '}
                      <span className="font-mono font-semibold text-on-surface">R(t)</span>) nhằm
                      chọn đúng điểm vàng kích hoạt tái củng cố.
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-xl bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
                    <Brain className="w-5 h-5" aria-hidden="true" />
                  </div>
                </div>
              </div>

              {/* Retention Decay Gauge & Dynamic 4-Metrics Card */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25 relative overflow-hidden space-y-4">
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    retentionPct < 60 ? 'bg-tertiary' : 'bg-primary'
                  }`}
                />

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded bg-surface-container text-on-surface font-mono text-xs font-bold">
                      {conceptSlug}
                    </span>
                    {updatedCompetency && (
                      <span className="text-xs text-primary font-bold">
                        {updatedCompetency.depth_label} (
                        {Math.round(updatedCompetency.depth_level_norm * 100)}%)
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold font-label ${
                      retentionPct < 60 ? 'text-tertiary' : 'text-primary'
                    }`}
                  >
                    {retentionPct < 60 ? 'Cảnh báo R(t) < 60%' : 'Độ bền trí nhớ ổn định'}
                  </span>
                </div>

                {/* Retention Decay Gauge Display */}
                <div className="bg-surface-container-low rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-[11px] font-label font-medium text-on-surface-variant">
                        Khả năng Thu hồi hiện tại (Retrievability):
                      </span>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span
                          className={`text-2xl font-headline font-black ${
                            retentionPct < 60 ? 'text-tertiary' : 'text-primary'
                          }`}
                        >
                          R(t) = {retentionPct}%
                        </span>
                        <span className="text-xs font-medium text-on-surface-variant">
                          / Ngưỡng an toàn 60%
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-primary font-bold">
                        MỤC TIÊU PHỤC HỒI
                      </span>
                      <div className="text-sm font-bold text-primary font-headline">100% R(t)</div>
                    </div>
                  </div>

                  {/* Multi-level custom progress bar with 60% threshold marker */}
                  <div className="relative w-full h-3 bg-surface-container-highest rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 left-[60%] w-0.5 bg-on-surface-variant z-10 opacity-75"
                      title="Ngưỡng an toàn 60%"
                    />
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        retentionPct < 60 ? 'bg-tertiary' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.max(5, retentionPct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                    <span>0% Quên hoàn toàn</span>
                    <span className="text-tertiary font-semibold">Ngưỡng ôn tập: 60%</span>
                    <span className="text-primary font-semibold">Tối ưu 100%</span>
                  </div>
                </div>

                {/* 4 Metrics Micro-Grid */}
                {updatedCompetency && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col justify-between">
                      <span className="text-[11px] font-label text-on-surface-variant">
                        Độ ổn định hiện tại (Stability)
                      </span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-base font-bold font-headline text-on-surface font-mono">
                          S = {updatedCompetency.stability_s.toFixed(1)}
                        </span>
                        <span className="text-xs text-on-surface-variant">ngày</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-primary/10 flex flex-col justify-between">
                      <span className="text-[11px] font-label text-primary font-medium">
                        Dự báo chu kỳ kế tiếp
                      </span>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-base font-bold font-headline text-primary font-mono">
                          S &rarr; {projectedS}
                        </span>
                        <span className="text-xs font-bold text-primary">ngày</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col justify-between">
                      <span className="text-[11px] font-label text-on-surface-variant">
                        Mức hiểu xác lập
                      </span>
                      <div className="mt-1">
                        <span className="text-xs font-bold font-headline text-on-surface">
                          {updatedCompetency.depth_label} (
                          {Math.round(updatedCompetency.depth_level_norm * 100)}%)
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-container-low flex flex-col justify-between">
                      <span className="text-[11px] font-label text-on-surface-variant">
                        Độ tin cậy (Confidence)
                      </span>
                      <div className="mt-1">
                        <span className="text-xs font-bold font-mono text-primary">
                          {Math.round(updatedCompetency.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Architectural Invariant Transparency Banner (INV-DEPTH-01) */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                  <span className="text-xs font-bold font-headline uppercase tracking-wider text-on-surface">
                    Lưu ý minh bạch
                  </span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed font-medium bg-surface-container-low p-3 rounded-xl">
                  Điểm số được chấm theo tiêu chí chuẩn hóa; phản hồi của Gia sư AI giúp bạn cải thiện câu trả lời hiệu quả hơn.
                </p>
              </div>
            </div>

            {/* RIGHT COLUMN: AI Tutor Pedagogical Insights & Structured Rubric Breakdown */}
            <div className="flex flex-col gap-5">
              {/* Right Header: Score & Adapter Provenance */}
              <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          isFallback
                            ? 'bg-tertiary-container/30 text-on-tertiary-container'
                            : 'bg-primary-container text-on-primary-container'
                        }`}
                      >
                        {isFallback ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Chấm dự phòng tất định (Deterministic Fallback)</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Chấm bởi LLM Rubric Adapter</span>
                          </>
                        )}
                      </span>
                    </div>
                    <h3 className="text-lg font-headline font-extrabold text-on-surface tracking-tight">
                      Phản hồi Chấm điểm Rubric &amp; AI Tutor
                    </h3>
                    <p className="text-[11px] text-on-surface-variant font-mono">
                      adapter: {graderSource}
                    </p>
                  </div>

                  {/* Score Pill */}
                  <div className="shrink-0 flex sm:flex-col items-center sm:items-end justify-between bg-primary/10 px-4 py-2.5 rounded-xl">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary font-label">
                      Tổng Điểm Rubric
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black font-headline text-primary font-mono">
                        {scorePct} / 100
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-primary bg-primary/20 px-2 py-0.5 rounded-full mt-0.5">
                      {scorePct >= 75 ? 'ĐẠT CHUẨN' : 'CẦN BỔ SUNG'}
                    </span>
                  </div>
                </div>
              </div>

              {!tutorFeedback && (
                <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant/25 text-xs text-on-surface-variant">
                  Chưa có dữ liệu phản hồi Rubric chi tiết cho bước này.
                </div>
              )}

              {tutorFeedback && (
                <>
                  {/* Structured Rubric Breakdown Table */}
                  <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-headline font-bold text-on-surface flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                        <span>
                          Bóc tách Tiêu chí Chấm điểm Chuẩn hóa ({tutorFeedback.criteria_results.length})
                        </span>
                      </h3>
                      <span className="text-[11px] font-label text-on-surface-variant">
                        Rubric Grid
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {tutorFeedback.criteria_results.map((c, idx) => {
                        const critPct = Math.round(c.score * 100)
                        const passedCrit = c.score >= 0.75
                        const weightPts = Math.round(c.weight * 100)
                        const earnedPts = Math.round(c.score * weightPts)

                        return (
                          <div
                            key={c.name}
                            className="p-3.5 rounded-xl bg-surface-container-low flex flex-col gap-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-bold font-headline text-on-surface">
                                    {passedCrit ? (
                                      <CheckCircle2
                                        className="w-3.5 h-3.5 text-primary shrink-0"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <XCircle
                                        className="w-3.5 h-3.5 text-tertiary shrink-0"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span>
                                      {idx + 1}. {c.name}
                                    </span>
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      passedCrit
                                        ? 'bg-primary/15 text-primary'
                                        : 'bg-tertiary/15 text-tertiary'
                                    }`}
                                  >
                                    {critPct}% (Trọng số {weightPts}%)
                                  </span>
                                </div>

                                {c.matched_keywords.length > 0 && (
                                  <p className="text-xs text-primary">
                                    Ý đã đạt:{' '}
                                    <span className="font-semibold">
                                      {c.matched_keywords.join(', ')}
                                    </span>
                                  </p>
                                )}
                                {c.missing_keywords.length > 0 && (
                                  <p className="text-xs text-tertiary">
                                    Từ khóa gợi ý bổ sung:{' '}
                                    <span className="font-semibold">
                                      {c.missing_keywords.join(', ')}
                                    </span>
                                  </p>
                                )}
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className={`text-xs font-headline font-bold font-mono ${
                                    passedCrit ? 'text-primary' : 'text-tertiary'
                                  }`}
                                >
                                  {earnedPts} / {weightPts}
                                </div>
                              </div>
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

                  {/* AI Tutor Pedagogical Insights (Socratic Model) */}
                  <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-outline-variant/25 flex flex-col gap-3.5">
                    <div className="flex items-center justify-between pb-2.5 border-b border-surface-container">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center shrink-0">
                          <Bot className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                          <h3 className="text-sm font-headline font-bold text-on-surface">
                            {graderSource === 'llm_rubric'
                              ? 'Nhận xét Sư phạm từ AI Tutor (LLM Rubric)'
                              : 'Phản hồi Chấm Rubric Tất định (Offline Fallback)'}
                          </h3>
                          <span className="text-[10px] font-label text-on-surface-variant">
                            {graderSource === 'llm_rubric'
                              ? 'Phân tích lập luận dựa trên Knowledge Graph'
                              : 'Đối sánh từ khóa theo tiêu chí Rubric'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                        {graderSource === 'llm_rubric' ? 'LLM_GRADED' : 'DETERMINISTIC'}
                      </span>
                    </div>

                    <div className="space-y-3 text-xs leading-relaxed">
                      {/* Strengths */}
                      <div className="p-3.5 rounded-xl bg-primary/5 flex items-start gap-3">
                        <ThumbsUp
                          className="w-4 h-4 text-primary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-bold text-primary font-headline block mb-0.5">
                            Tổng kết đánh giá &amp; Điểm sáng (Strengths)
                          </span>
                          <p className="text-on-surface">{tutorFeedback.summary}</p>
                          {allMatchedKeywords.length > 0 && (
                            <p className="text-[11px] font-mono text-primary mt-1">
                              Luận điểm xác thực: {allMatchedKeywords.join(', ')}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Refinements */}
                      <div className="p-3.5 rounded-xl bg-surface-container-low flex items-start gap-3">
                        <Lightbulb
                          className="w-4 h-4 text-tertiary shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <div>
                          <span className="font-bold text-on-surface font-headline block mb-0.5">
                            Điểm mài sắc tư duy (Refinements)
                          </span>
                          <p className="text-on-surface-variant">
                            {allMissingKeywords.length > 0
                              ? `Để nâng mức hiểu lên bậc tiếp theo, hãy phân tích sâu hơn các khía cạnh: ${allMissingKeywords.join(', ')}.`
                              : 'Bạn đã bao phủ đầy đủ các từ khóa và luận điểm cốt lõi trong Rubric của tầng đánh giá này.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="px-6 py-4 border-t border-outline-variant/25 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-on-surface-variant font-mono">
            Trạng thái hồ sơ: Đã đồng bộ Ebbinghaus &amp; Bậc chiều sâu
          </span>
          <button
            type="button"
            onClick={onCompleteAndReturn}
            className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-primary text-on-primary font-headline font-bold text-xs hover:bg-primary-dim cursor-pointer transition-colors shadow-sm"
          >
            Hoàn tất &amp; Cập nhật Hồ sơ Năng lực
          </button>
        </div>
      </div>
    </div>
  )
}
