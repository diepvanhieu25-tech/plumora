import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  History,
  Layers,
  Lock,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import {
  apiAbandonAssessmentV2,
  apiStartAssessmentV2,
  apiSubmitAssessmentV2,
} from '../api'
import { AiTutorRubricDrawer } from '../components/AiTutorRubricDrawer'
import { PlaybookQuickDrawer } from '../components/PlaybookQuickDrawer'
import { PageContextBar } from '../components/ui/PageContextBar'
import { SafetyConfirmModal } from '../components/ui/SafetyConfirmModal'
import { StatusAlertBanner } from '../components/ui/StatusAlertBanner'
import { useDraftStorage } from '../hooks/useDraftStorage'
import type {
  DepthStepItem,
  TutorFeedbackOut,
  UpdatedCompetencyOut,
} from '../types'
import { generateSubmissionId } from '../utils/submission'

interface DepthProbePageProps {
  domainSlug: string
  conceptSlug: string
  sessionMode: 'depth_probe' | 'spaced_review'
  onBackToRoadmap: () => void
}

const TIER_NAMES: Record<
  number,
  { short: string; label: string; desc: string; depthTarget: string }
> = {
  1: {
    short: 'Khái niệm',
    label: 'Tầng 1: Khái niệm Cốt lõi',
    desc: 'Nhận diện định nghĩa & vai trò',
    depthTarget: '25%',
  },
  2: {
    short: 'Cơ chế',
    label: 'Tầng 2: Cơ chế Vận hành',
    desc: 'Cách hệ thống hoạt động bên trong',
    depthTarget: '50%',
  },
  3: {
    short: 'Tình huống',
    label: 'Tầng 3: Xử lý Sự cố & Cạm bẫy',
    desc: 'Chẩn đoán lỗi & xử lý thực tế',
    depthTarget: '75%',
  },
  4: {
    short: 'Đánh đổi',
    label: 'Tầng 4: Đánh đổi Kiến trúc',
    desc: 'Phân tích ràng buộc & lựa chọn thiết kế',
    depthTarget: '85%',
  },
  5: {
    short: 'Bản chất',
    label: 'Tầng 5: Giải thích Bản chất Sâu',
    desc: 'Truyền đạt lại theo tư duy Feynman',
    depthTarget: '100%',
  },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  mcq: 'Trắc nghiệm Kiến thức',
  troubleshooting: 'Tình huống Xử lý Sự cố',
  code_review: 'Đọc hiểu & Đánh giá Mã nguồn',
  constraint_shifting: 'Phân tích Thay đổi Ràng buộc',
  teach_back: 'Giải thích Bản chất (Feynman)',
}

export function DepthProbePage({
  domainSlug,
  conceptSlug,
  sessionMode,
  onBackToRoadmap,
}: DepthProbePageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [stepItem, setStepItem] = useState<DepthStepItem | null>(null)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const draftKey = stepItem
    ? `plumora_draft_essay_${conceptSlug}_${stepItem.question_id}`
    : ''
  const [writtenExplanation, setWrittenExplanation, clearEssayDraft] = useDraftStorage(draftKey, '')

  const [pendingSubmissionId, setPendingSubmissionId] = useState<string>(() =>
    generateSubmissionId(),
  )
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [updatedComp, setUpdatedComp] = useState<UpdatedCompetencyOut | null>(null)
  const [tutorFeedback, setTutorFeedback] = useState<TutorFeedbackOut | null>(null)
  const [graderSource, setGraderSource] = useState<string>('deterministic_mcq')
  const [lastScore, setLastScore] = useState<number>(0)
  const [completedTiers, setCompletedTiers] = useState<Array<{ tier: number; score: number }>>([])
  const [mcqFeedback, setMcqFeedback] = useState<{
    passed: boolean
    score: number
    nextStep: DepthStepItem | null
  } | null>(null)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isPlaybookOpen, setIsPlaybookOpen] = useState(false)
  const [showAbandonModal, setShowAbandonModal] = useState(false)
  const [abandoning, setAbandoning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  const initSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    setMcqFeedback(null)
    setCompletedTiers([])
    setSessionStatus('active')
    try {
      const res = await apiStartAssessmentV2(domainSlug, conceptSlug, sessionMode)
      if (!mountedRef.current) return
      setSessionId(res.session_id)
      setStepItem(res.step_item)
      setPendingSubmissionId(generateSubmissionId())
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Không thể khởi tạo phiên đánh giá')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [domainSlug, conceptSlug, sessionMode])

  useEffect(() => {
    mountedRef.current = true
    void initSession()
    return () => {
      mountedRef.current = false
    }
  }, [initSession])

  const isMcq = stepItem?.task_type === 'mcq'

  // Keyboard shortcuts 1-4 for Tier 1-2 MCQ
  useEffect(() => {
    if (!stepItem || !isMcq || !stepItem.options || mcqFeedback) return
    const keys = Object.keys(stepItem.options)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      if (idx >= 0 && keys[idx]) {
        setSelectedOption(keys[idx])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stepItem, isMcq, mcqFeedback])

  async function handleSubmit() {
    if (!sessionId || !stepItem || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const submittedTier = stepItem.depth_tier
      const wasMcq = stepItem.task_type === 'mcq'
      const res = await apiSubmitAssessmentV2(sessionId, {
        submission_id: pendingSubmissionId,
        question_id: stepItem.question_id,
        selected_option: wasMcq ? selectedOption : null,
        written_explanation: !wasMcq ? writtenExplanation : null,
      })
      if (!mountedRef.current) return

      setSessionStatus(res.session_status)
      setUpdatedComp(res.updated_competency)
      setGraderSource(res.grader_source)
      setLastScore(res.step_score)
      setCompletedTiers((prev) => [...prev, { tier: submittedTier, score: res.step_score }])
      setPendingSubmissionId(generateSubmissionId())

      if (!wasMcq) {
        clearEssayDraft()
      }

      if (res.tutor_feedback) {
        setTutorFeedback(res.tutor_feedback)
        setIsDrawerOpen(true)
        setStepItem(res.next_step_item ?? null)
        setSelectedOption('')
      } else if (wasMcq) {
        // Show immediate micro-feedback for Tier 1-2 MCQ before moving on
        setMcqFeedback({
          passed: res.step_passed,
          score: res.step_score,
          nextStep: res.next_step_item ?? null,
        })
      } else {
        setStepItem(res.next_step_item ?? null)
        setSelectedOption('')
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Lỗi khi nộp câu trả lời')
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  function handleContinueAfterMcq() {
    if (!mcqFeedback) return
    setStepItem(mcqFeedback.nextStep)
    setSelectedOption('')
    setMcqFeedback(null)
  }

  async function handleConfirmAbandon() {
    if (!sessionId) {
      setShowAbandonModal(false)
      onBackToRoadmap()
      return
    }
    setAbandoning(true)
    setError(null)
    try {
      const res = await apiAbandonAssessmentV2(sessionId)
      if (!mountedRef.current) return
      setSessionStatus(res.session_status)
      setUpdatedComp(res.updated_competency)
      setStepItem(null)
      setMcqFeedback(null)
      setShowAbandonModal(false)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Không thể dừng phiên đánh giá')
      setShowAbandonModal(false)
    } finally {
      if (mountedRef.current) setAbandoning(false)
    }
  }

  const canSubmit = isMcq ? Boolean(selectedOption) : writtenExplanation.trim().length >= 10
  const isSpacedReview = sessionMode === 'spaced_review'

  return (
    <section
      className="w-full pb-8 space-y-6 text-on-surface"
      data-testid="scr12-depth-probe"
    >
      {/* 1. CONTEXTUAL BAR */}
      <PageContextBar
        backLabel={`Quay về Lộ trình (${domainSlug})`}
        onBack={onBackToRoadmap}
        breadcrumbs={[
          { label: domainSlug, onClick: onBackToRoadmap },
          { label: conceptSlug },
          {
            label: isSpacedReview ? 'Ôn tập Củng cố Trí nhớ' : 'Kiểm tra Đào sâu 5 Tầng',
            isCurrent: true,
          },
        ]}
        rightSlot={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaybookOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-container/60 text-on-primary-container hover:bg-primary-container text-xs font-bold cursor-pointer transition-colors"
              data-testid="open-playbook-quick-drawer-btn"
            >
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xem nhanh Lý thuyết</span>
            </button>
            {tutorFeedback && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-ai-sunlit-text text-xs font-bold cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
                <span>Nhận xét Gia sư AI</span>
              </button>
            )}
          </div>
        }
      />

      {/* 2. DEDICATED SPACED REVIEW HEADER vs 5-DEPTH STEPPER BAR */}
      {isSpacedReview ? (
        <div
          className="bg-ai-sunlit-bg p-5 rounded-2xl border border-ai-sunlit-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          data-testid="spaced-review-header"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-tertiary text-on-tertiary flex items-center justify-center shrink-0">
              <History className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-headline font-extrabold text-ai-sunlit-text">
                Trạm Ôn tập Củng cố Nhanh (1 Tình huống Trọng tâm)
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Hoàn thành câu hỏi trọng tâm dưới đây để khôi phục độ bền ghi nhớ lên 100% và kéo dài chu kỳ ôn tập tiếp theo.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-white border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text shrink-0 self-start sm:self-auto">
            1 Bước • ~3 phút
          </span>
        </div>
      ) : (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-outline-variant/50 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
            {[1, 2, 3, 4, 5].map((t) => {
              const active = stepItem?.depth_tier === t
              const passed =
                sessionStatus === 'completed' ||
                (stepItem !== null && stepItem.depth_tier > t) ||
                completedTiers.some((c) => c.tier === t && c.score >= 0.75)
              const stoppedAtCeiling =
                !active && !passed && !stepItem && completedTiers.some((c) => c.tier === t)
              const info = TIER_NAMES[t]

              return (
                <div
                  key={t}
                  className={`relative flex flex-col p-3 rounded-xl space-y-1 transition-all ${
                    active
                      ? 'bg-ai-sunlit-bg border-2 border-ai-sunlit-border shadow-xs'
                      : passed
                        ? 'bg-primary-container/25 border border-primary/25'
                        : stoppedAtCeiling
                          ? 'bg-error-container/25 border border-error/40'
                          : 'bg-surface-container-low border border-outline-variant/30 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-bold flex items-center gap-1.5 ${
                        active
                          ? 'text-tertiary'
                          : passed
                            ? 'text-primary'
                            : stoppedAtCeiling
                              ? 'text-error'
                              : 'text-on-surface-variant'
                      }`}
                    >
                      <span>
                        Tầng {t} • {info.short}
                      </span>
                    </span>
                    {passed ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />
                    ) : stoppedAtCeiling ? (
                      <AlertTriangle className="w-4 h-4 text-error" aria-hidden="true" />
                    ) : active ? (
                      <Target className="w-4 h-4 text-tertiary" aria-hidden="true" />
                    ) : (
                      <Lock className="w-4 h-4 text-outline" aria-hidden="true" />
                    )}
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">{info.desc}</p>
                  <span
                    className={`text-[10px] font-bold self-start px-1.5 py-0.5 rounded ${
                      active
                        ? 'text-on-tertiary bg-tertiary'
                        : passed
                          ? 'text-primary bg-white'
                          : stoppedAtCeiling
                            ? 'text-error bg-error-container/40'
                            : 'text-outline bg-white/70'
                    }`}
                  >
                    {active
                      ? 'ĐANG LÀM'
                      : passed
                        ? `ĐÃ QUA (${info.depthTarget})`
                        : stoppedAtCeiling
                          ? 'CHƯA ĐẠT'
                          : 'CHỜ MỞ'}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/50 shrink-0">
            <Layers className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold block">
                Mức hiểu hiện tại
              </span>
              <span className="text-xs font-extrabold text-primary">
                {updatedComp
                  ? `${updatedComp.depth_label} (${Math.round(updatedComp.depth_level_norm * 100)}%)`
                  : stepItem
                    ? `Đang kiểm tra Tầng ${stepItem.depth_tier}`
                    : 'Đang cập nhật'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN ASSESSMENT WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-outline-variant/50 space-y-5">
            {loading && (
              <div className="space-y-4">
                <div className="h-6 w-1/3 rounded-lg bg-surface-container animate-pulse" />
                <div className="h-24 rounded-xl bg-surface-container animate-pulse" />
                <div className="h-36 rounded-xl bg-surface-container animate-pulse" />
              </div>
            )}

            {error && (
              <StatusAlertBanner
                variant="error"
                message={error}
                onRetry={!stepItem && !updatedComp ? () => void initSession() : undefined}
              />
            )}

            {!loading && stepItem && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-ai-sunlit-bg text-ai-sunlit-text border border-ai-sunlit-border/40">
                    <Target className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
                    <span>
                      {isSpacedReview
                        ? 'Câu hỏi Ôn tập Trọng tâm'
                        : TIER_NAMES[stepItem.depth_tier]?.label ?? `Tầng ${stepItem.depth_tier}`}
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
                                  onChange={() => setSelectedOption(k)}
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
                          onClick={handleContinueAfterMcq}
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
                      onChange={(e) => setWrittenExplanation(e.target.value)}
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
                      onClick={() => setShowAbandonModal(true)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                      data-testid="abandon-assessment-btn"
                    >
                      <LogOut className="w-4 h-4 text-outline" aria-hidden="true" />
                      <span>Dừng phiên sớm</span>
                    </button>

                    <button
                      type="button"
                      disabled={!canSubmit || submitting}
                      onClick={() => void handleSubmit()}
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
            )}

            {/* Session Finished / Ceiling / Insufficient Evidence Summary */}
            {!loading && !stepItem && updatedComp && (
              <div
                role="status"
                aria-live="polite"
                className={`rounded-2xl border p-5 space-y-4 ${
                  sessionStatus === 'insufficient_evidence'
                    ? 'border-ai-sunlit-border bg-ai-sunlit-bg'
                    : 'border-primary/35 bg-primary-container/30'
                }`}
                data-testid="assessment-session-summary"
              >
                <div className="flex items-start gap-2.5 font-extrabold text-base text-on-surface">
                  {sessionStatus === 'insufficient_evidence' ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span>Chưa đủ bằng chứng đánh giá (Insufficient Evidence)</span>
                        <p className="text-xs font-normal text-on-surface-variant mt-1">
                          Phiên đã dừng trước khi hoàn thành đủ 2 bước kiểm chứng. Mức hiểu hiện tại của bạn được bảo lưu nguyên vẹn.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span>
                          {sessionStatus === 'ceiling_reached'
                            ? 'Đã xác lập Trần Hiểu biết Hiện tại'
                            : isSpacedReview
                              ? 'Hoàn tất Ôn tập Củng cố Trí nhớ!'
                              : 'Hoàn tất Phiên Kiểm tra Đào sâu 5 Tầng!'}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-xl border border-outline-variant/40">
                    <span className="text-on-surface-variant block">Mức hiểu xác lập</span>
                    <strong className="text-primary flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      {updatedComp.depth_label} ({Math.round(updatedComp.depth_level_norm * 100)}%)
                    </strong>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-outline-variant/40">
                    <span className="text-on-surface-variant block">Độ bền ghi nhớ</span>
                    <strong className="text-secondary block mt-1 font-mono">
                      {Math.round(updatedComp.retention_ebbinghaus * 100)}%
                    </strong>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-outline-variant/40">
                    <span className="text-on-surface-variant block">Chu kỳ nhớ bền vững</span>
                    <strong className="text-primary block mt-1 font-mono">
                      {updatedComp.stability_s.toFixed(1)} ngày
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onBackToRoadmap}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-dim cursor-pointer transition-colors"
                >
                  Quay về Bản đồ Lộ trình
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Rubric Criteria & Step History */}
        <aside className="lg:col-span-4 flex flex-col gap-5">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                <h2 className="text-xs font-bold text-on-surface">
                  Tiêu chí Đánh giá {stepItem ? `(Tầng ${stepItem.depth_tier})` : ''}
                </h2>
              </div>
              {stepItem?.rubric_summary && (
                <span className="text-[10px] font-bold text-primary bg-primary-container px-2 py-0.5 rounded-full">
                  {stepItem.rubric_summary.length} tiêu chí
                </span>
              )}
            </div>

            {stepItem?.rubric_summary && stepItem.rubric_summary.length > 0 ? (
              <div className="space-y-2.5">
                {stepItem.rubric_summary.map((c, idx) => {
                  const weightPct = Math.round(c.weight * 100)
                  return (
                    <div
                      key={`${c.name}-${idx}`}
                      className="p-3 rounded-xl bg-surface-container-low space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface">
                          {idx + 1}. {c.name}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-primary px-1.5 py-0.5 rounded bg-primary-container shrink-0">
                          {weightPct}%
                        </span>
                      </div>
                      <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(15, weightPct))}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {isMcq
                  ? 'Câu hỏi trắc nghiệm giúp kiểm tra nhanh nền tảng để mở khóa các câu hỏi tình huống chuyên sâu.'
                  : 'Nhận xét chi tiết từng tiêu chí từ Gia sư AI sẽ hiển thị ngay sau khi bạn nộp bài.'}
              </p>
            )}

            <div className="p-3 rounded-xl bg-primary-container/30 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-on-surface-variant uppercase font-bold block">
                  Điểm bước gần nhất
                </span>
                <span className="text-base font-extrabold text-primary font-mono">
                  {completedTiers.length > 0 ? `${Math.round(lastScore * 100)} / 100` : '-- / 100'}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-primary">Đạt &ge; 75</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-outline-variant/50 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-surface-container">
              <Clock className="w-4 h-4 text-secondary" aria-hidden="true" />
              <h2 className="text-xs font-bold text-on-surface">Tiến trình Phiên này</h2>
            </div>

            {completedTiers.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Chưa có bước nào hoàn tất trong phiên hiện tại.
              </p>
            ) : (
              <div className="space-y-2">
                {completedTiers.map((item, idx) => {
                  const passedStep = item.score >= 0.75
                  return (
                    <div
                      key={`${item.tier}-${idx}`}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface-container-low text-xs"
                    >
                      <span className="flex items-center gap-2 font-semibold text-on-surface">
                        {passedStep ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-error shrink-0" aria-hidden="true" />
                        )}
                        <span>Tầng {item.tier}</span>
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          passedStep ? 'text-primary' : 'text-error'
                        }`}
                      >
                        {Math.round(item.score * 100)}%
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {tutorFeedback && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-full inline-flex items-center justify-between p-2.5 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-tertiary" aria-hidden="true" />
                  <span>Mở lại Nhận xét Gia sư AI</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* Drawers & Modals */}
      <PlaybookQuickDrawer
        isOpen={isPlaybookOpen}
        onClose={() => setIsPlaybookOpen(false)}
        domainSlug={domainSlug}
        conceptSlug={conceptSlug}
      />

      <AiTutorRubricDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conceptTitle={conceptSlug}
        graderSource={graderSource}
        stepScore={lastScore}
        tutorFeedback={tutorFeedback}
        updatedCompetency={updatedComp}
        hasNextStep={Boolean(stepItem)}
        nextTierNumber={stepItem?.depth_tier ?? null}
        onCompleteAndReturn={() => {
          setIsDrawerOpen(false)
          if (!stepItem) onBackToRoadmap()
        }}
      />

      <SafetyConfirmModal
        isOpen={showAbandonModal}
        title="Dừng phiên đánh giá sớm?"
        description={
          completedTiers.length < 2
            ? 'Bạn mới hoàn thành dưới 2 bước kiểm chứng nên hệ thống sẽ ghi nhận trạng thái Chưa đủ bằng chứng và giữ nguyên mức hiểu trước đó.'
            : 'Hệ thống sẽ chốt kết quả tại tầng cao nhất bạn vừa vượt qua trong phiên này.'
        }
        confirmLabel="Xác nhận dừng phiên"
        cancelLabel="Tiếp tục làm bài"
        variant="warning"
        isSubmitting={abandoning}
        onConfirm={() => void handleConfirmAbandon()}
        onCancel={() => setShowAbandonModal(false)}
      />
    </section>
  )
}
