import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Layers,
  Lock,
  MessageSquare,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { apiStartAssessmentV2, apiSubmitAssessmentV2 } from '../api'
import { AiTutorRubricDrawer } from '../components/AiTutorRubricDrawer'
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
    short: 'What',
    label: 'Tầng 1: Khái niệm (What)',
    desc: 'Khái niệm & Mô hình',
    depthTarget: 'Surface 25%',
  },
  2: {
    short: 'How',
    label: 'Tầng 2: Cơ chế (How)',
    desc: 'Cơ chế Vận hành',
    depthTarget: 'Applied 50%',
  },
  3: {
    short: 'When',
    label: 'Tầng 3: Tình huống & Cạm bẫy',
    desc: 'Tình huống & Cạm bẫy',
    depthTarget: 'Deep 75%',
  },
  4: {
    short: 'Trade-offs',
    label: 'Tầng 4: Đánh đổi Kiến trúc (Trade-offs)',
    desc: 'Thay đổi Ràng buộc',
    depthTarget: 'Deep+ 85%',
  },
  5: {
    short: 'Internals',
    label: 'Tầng 5: Nội tại Hệ thống (Internals)',
    desc: 'Nội tại & Teach-back',
    depthTarget: 'Mastery 100%',
  },
}

const TASK_TYPE_LABELS: Record<string, string> = {
  mcq: 'Trắc nghiệm Tất định (Deterministic MCQ)',
  troubleshooting: 'Dạng 1: Xử lý sự cố (Troubleshooting)',
  code_review: 'Dạng 2: Đọc & Sửa code (Code Review)',
  constraint_shifting: 'Dạng 3: Thay đổi Ràng buộc (Constraint Shifting)',
  teach_back: 'Dạng 4: Giải thích ngược (Feynman Teach-back)',
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
  const [writtenExplanation, setWrittenExplanation] = useState<string>('')
  const [pendingSubmissionId, setPendingSubmissionId] = useState<string>(() =>
    generateSubmissionId(),
  )
  const [sessionStatus, setSessionStatus] = useState<string>('active')
  const [updatedComp, setUpdatedComp] = useState<UpdatedCompetencyOut | null>(null)
  const [tutorFeedback, setTutorFeedback] = useState<TutorFeedbackOut | null>(null)
  const [graderSource, setGraderSource] = useState<string>('deterministic_mcq')
  const [lastScore, setLastScore] = useState<number>(0)
  const [completedTiers, setCompletedTiers] = useState<Array<{ tier: number; score: number }>>([])
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  const initSession = useCallback(async () => {
    setLoading(true)
    setError(null)
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

  async function handleSubmit() {
    if (!sessionId || !stepItem) return
    setSubmitting(true)
    setError(null)
    try {
      const submittedTier = stepItem.depth_tier
      const res = await apiSubmitAssessmentV2(sessionId, {
        submission_id: pendingSubmissionId,
        question_id: stepItem.question_id,
        selected_option: stepItem.task_type === 'mcq' ? selectedOption : null,
        written_explanation: stepItem.task_type !== 'mcq' ? writtenExplanation : null,
      })

      setSessionStatus(res.session_status)
      setUpdatedComp(res.updated_competency)
      setGraderSource(res.grader_source)
      setLastScore(res.step_score)
      setCompletedTiers((prev) => [...prev, { tier: submittedTier, score: res.step_score }])
      setPendingSubmissionId(generateSubmissionId())

      if (res.tutor_feedback) {
        setTutorFeedback(res.tutor_feedback)
        setIsDrawerOpen(true)
      }

      if (res.next_step_item) {
        setStepItem(res.next_step_item)
        setSelectedOption('')
        setWrittenExplanation('')
      } else {
        setStepItem(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi nộp câu trả lời')
    } finally {
      setSubmitting(false)
    }
  }

  const isMcq = stepItem?.task_type === 'mcq'
  const canSubmit = isMcq ? Boolean(selectedOption) : writtenExplanation.trim().length >= 10
  const shortSubmissionHash = pendingSubmissionId.slice(0, 8)
  const shortSessionId = sessionId ? sessionId.slice(0, 6).toUpperCase() : 'INIT'

  return (
    <section
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 space-y-6 text-on-surface"
      data-testid="scr12-depth-probe"
    >
      {/* 1. CONTEXTUAL BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/30">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBackToRoadmap}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay về Bản đồ Knowledge Graph ({domainSlug})</span>
          </button>
          <span className="text-outline-variant/60 hidden sm:inline">&bull;</span>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium flex-wrap"
          >
            <span>{domainSlug}</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span className="font-mono text-secondary font-semibold">
              {stepItem ? `Tầng ${stepItem.depth_tier}: ` : ''}
              {conceptSlug}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" aria-hidden="true" />
            <span className="text-on-surface font-semibold">
              {sessionMode === 'spaced_review'
                ? 'Trạm Ôn tập Ebbinghaus'
                : 'Phòng Đào sâu 5 Tầng'}
            </span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-secondary font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
            <span>5-Depth Probing State Machine v2</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-mono">
            <Shield className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
            <span>Idempotency: #{shortSubmissionHash}</span>
          </div>
          {tutorFeedback && (
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/60 text-on-primary-container font-bold cursor-pointer hover:bg-primary-container transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>Xem Giải thích AI Tutor (SCR-14)</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. 5-DEPTH STEPPER BAR */}
      <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm border border-outline-variant/30 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-1">
          {[1, 2, 3, 4, 5].map((t) => {
            const active = stepItem?.depth_tier === t
            // Gate 3 invariant: preserve ceiling_reached logic so failed tier is red CHƯA ĐẠT, not green ĐÃ QUA
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
                className={`relative flex flex-col p-3 rounded-lg space-y-1 transition-all ${
                  active
                    ? 'bg-tertiary-container/10 border-2 border-tertiary shadow-sm'
                    : passed
                      ? 'bg-surface-container-low border border-primary/25'
                      : stoppedAtCeiling
                        ? 'bg-error-container/15 border border-error/40'
                        : 'bg-surface-container border border-outline-variant/30 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      active
                        ? 'text-tertiary'
                        : passed
                          ? 'text-primary'
                          : stoppedAtCeiling
                            ? 'text-error'
                            : 'text-on-surface-variant'
                    }`}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-tertiary animate-ping" />}
                    <span>
                      Tầng {t} &bull; {info.short}
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

                <p
                  className={`text-xs truncate ${
                    active
                      ? 'font-bold text-on-surface'
                      : passed
                        ? 'font-semibold text-on-surface'
                        : stoppedAtCeiling
                          ? 'font-semibold text-error'
                          : 'font-semibold text-on-surface-variant'
                  }`}
                >
                  {info.desc}
                </p>

                <span
                  className={`text-[10px] font-mono self-start px-1.5 py-0.5 rounded ${
                    active
                      ? 'font-bold text-on-tertiary bg-tertiary uppercase tracking-wider px-2'
                      : passed
                        ? 'font-semibold text-primary bg-surface-container'
                        : stoppedAtCeiling
                          ? 'font-bold text-error bg-error-container/25'
                          : 'text-outline bg-surface'
                  }`}
                >
                  {active
                    ? 'ĐANG ĐÀO SÂU'
                    : passed
                      ? `ĐÃ QUA (${info.depthTarget})`
                      : stoppedAtCeiling
                        ? 'CHƯA ĐẠT'
                        : 'CHỜ MỞ KHÓA'}
                </span>
              </div>
            )
          })}
        </div>

        {/* Ceiling Sticky Pill */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container border border-primary/30 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Layers className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
              Trần hiểu biết hiện tại
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary font-headline">
                {updatedComp
                  ? `${updatedComp.depth_label} (${Math.round(updatedComp.depth_level_norm * 100)}%)`
                  : stepItem
                    ? `Đang thẩm định Tầng ${stepItem.depth_tier}`
                    : 'Đang xác lập'}
              </span>
              {updatedComp && (
                <span className="text-[10px] font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-on-surface-variant font-semibold">
                  conf = {updatedComp.confidence.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MAIN ASSESSMENT WORKSPACE: 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: PROGRESSIVE SCENARIO & RESPONSE WORKSPACE */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-sm border border-outline-variant/30 flex flex-col space-y-5">
            {loading && (
              <div className="space-y-4">
                <div className="h-6 w-1/3 rounded-lg bg-surface-container-low animate-pulse" />
                <div className="h-24 rounded-xl bg-surface-container-low animate-pulse" />
                <div className="h-36 rounded-xl bg-surface-container-low animate-pulse" />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-error-container/15 border border-error/30 flex flex-wrap items-center justify-between gap-2 text-sm text-error"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {error}
                </span>
                {!stepItem && !updatedComp && (
                  <button
                    type="button"
                    onClick={() => void initSession()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-error/30 text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Thử lại
                  </button>
                )}
              </div>
            )}

            {!loading && stepItem && (
              <div className="space-y-5">
                {/* Badges Bar */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-tertiary-container/15 text-tertiary border border-tertiary/20">
                    <Target className="w-3.5 h-3.5" aria-hidden="true" />
                    {TIER_NAMES[stepItem.depth_tier]?.label ?? `Tầng ${stepItem.depth_tier}`}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-secondary/10 text-secondary border border-secondary/20">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    {TASK_TYPE_LABELS[stepItem.task_type] ?? `Dạng bài: ${stepItem.task_type}`}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-surface-container text-on-surface-variant">
                    Node: {conceptSlug}
                  </span>
                </div>

                {/* Progressive Context Box */}
                <div className="space-y-3">
                  {completedTiers.length > 0 && (
                    <div className="p-3.5 rounded-lg bg-surface-container-low border border-primary/20 flex items-start gap-3">
                      <CheckCircle2
                        className="w-5 h-5 text-primary shrink-0 mt-0.5"
                        aria-hidden="true"
                      />
                      <div className="text-xs leading-relaxed text-on-surface">
                        <span className="font-bold text-primary font-mono">
                          Bằng chứng đã xác thực (Tầng 1..{completedTiers[completedTiers.length - 1]?.tier}):
                        </span>{' '}
                        Đã vượt qua {completedTiers.length} bước kiểm chứng trước đó trong phiên{' '}
                        <code className="font-mono bg-surface-container px-1 py-0.5 rounded text-primary">
                          #{shortSessionId}
                        </code>
                        . Hệ thống nâng độ khó lên Tầng {stepItem.depth_tier}.
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-surface-container-lowest border-2 border-tertiary/40 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-tertiary font-mono flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-tertiary" aria-hidden="true" />
                        Thách thức Đào sâu Tầng {stepItem.depth_tier}:
                      </span>
                      <span className="text-[11px] font-mono text-tertiary font-semibold px-2 py-0.5 bg-tertiary/10 rounded">
                        Ngưỡng vượt tầng &ge; 75%
                      </span>
                    </div>
                    <h1 className="text-sm sm:text-base font-bold text-on-surface leading-relaxed">
                      {stepItem.prompt}
                    </h1>
                  </div>
                </div>

                {/* Input Area: MCQ vs Written Rubric Explanation */}
                {isMcq && stepItem.options ? (
                  <div className="space-y-2.5">
                    <span className="block text-xs font-bold font-headline text-on-surface uppercase tracking-wider">
                      Lựa chọn Phương án Kỹ thuật:
                    </span>
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
                            className={`cursor-pointer flex flex-col p-3.5 rounded-lg border transition-all ${
                              isSelected
                                ? 'border-2 border-primary bg-primary/5 shadow-xs'
                                : 'border-outline-variant/30 hover:border-outline bg-surface-container-low'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="depth-mcq"
                                  value={k}
                                  checked={isSelected}
                                  onChange={() => setSelectedOption(k)}
                                  className="accent-primary"
                                />
                                <span
                                  className={`text-xs font-bold font-mono ${
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
                                    : 'bg-surface-container text-on-surface-variant'
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
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label
                        htmlFor="depth-essay"
                        className="text-xs font-bold text-on-surface flex items-center gap-1.5"
                      >
                        <span>Bài phân tích kỹ thuật của Học viên</span>
                        <span className="text-[10px] font-mono font-normal text-on-surface-variant">
                          (Chấm tự động theo tiêu chí Rubric bên phải)
                        </span>
                      </label>
                      <span className="text-[11px] font-mono text-secondary font-semibold">
                        {writtenExplanation.trim().length} ký tự (tối thiểu 10)
                      </span>
                    </div>
                    <textarea
                      id="depth-essay"
                      rows={8}
                      value={writtenExplanation}
                      onChange={(e) => setWrittenExplanation(e.target.value)}
                      placeholder="Nhập phân tích kỹ thuật chi tiết theo các tiêu chí Rubric bên phải (tối thiểu 10 ký tự)..."
                      className="w-full p-4 rounded-lg bg-surface border border-outline-variant/40 font-mono text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary leading-relaxed shadow-inner"
                    />
                  </div>
                )}

                {/* Action Buttons Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onBackToRoadmap}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4 text-outline" aria-hidden="true" />
                    <span>Dừng tại Trần hiểu biết hiện tại</span>
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={() => void handleSubmit()}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-dim disabled:opacity-45 text-on-primary text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>
                      {submitting
                        ? 'Đang chấm theo Rubric qua AI Tutor...'
                        : 'Nộp & Đào sâu Tầng tiếp theo'}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Session Completed / Ceiling Reached Summary */}
            {!loading && !stepItem && updatedComp && (
              <div
                className={`rounded-xl border p-5 space-y-4 ${
                  sessionStatus === 'insufficient_evidence'
                    ? 'border-tertiary/40 bg-tertiary-container/10'
                    : 'border-primary/30 bg-primary-container/20'
                }`}
              >
                <div className="flex items-center gap-2 font-extrabold text-base text-on-surface">
                  {sessionStatus === 'insufficient_evidence' ? (
                    <>
                      <AlertTriangle className="w-5 h-5 text-tertiary" aria-hidden="true" />
                      <span>Insufficient Evidence — Bảo lưu mức hiểu cũ</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />
                      <span>
                        {sessionStatus === 'ceiling_reached'
                          ? 'Đã chạm Trần Hiểu Biết (Knowledge Ceiling)'
                          : 'Hoàn tất Phiên Đánh giá Chiều sâu'}
                      </span>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30">
                    <span className="text-on-surface-variant block">Mức hiểu xác lập</span>
                    <strong className="text-primary flex items-center gap-1 mt-1">
                      <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                      {updatedComp.depth_label} ({Math.round(updatedComp.depth_level_norm * 100)}%)
                    </strong>
                  </div>
                  <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30">
                    <span className="text-on-surface-variant block">Độ tin cậy</span>
                    <strong className="text-on-surface block mt-1 font-mono">
                      {Math.round(updatedComp.confidence * 100)}%
                    </strong>
                  </div>
                  <div className="bg-surface-container-lowest p-3.5 rounded-xl border border-outline-variant/30">
                    <span className="text-on-surface-variant block">Độ bền Ebbinghaus</span>
                    <strong className="text-primary block mt-1 font-mono">
                      S = {updatedComp.stability_s.toFixed(1)} ngày
                    </strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onBackToRoadmap}
                  className="w-full py-2.5 px-4 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-dim cursor-pointer transition-colors"
                >
                  Quay về Bản đồ Knowledge Graph
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: STRUCTURED RUBRIC & OBSERVATION PROVENANCE */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col space-y-6">
          {/* Card 1: Structured Rubric Evaluation */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-secondary/10 flex items-center justify-center text-secondary">
                  <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-bold font-headline text-on-surface">
                  Tiêu chí Chấm điểm Rubric (
                  {stepItem ? `Tầng ${stepItem.depth_tier}` : 'Hoàn tất'})
                </h2>
              </div>
              {stepItem?.rubric_summary && (
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {stepItem.rubric_summary.length} Tiêu chí
                </span>
              )}
            </div>

            {stepItem?.rubric_summary && stepItem.rubric_summary.length > 0 ? (
              <div className="space-y-2.5">
                {stepItem.rubric_summary.map((c, idx) => {
                  const weightPct = Math.round(c.weight * 100)
                  return (
                    <div
                      key={c.name}
                      className="p-3 rounded-lg bg-surface-container-low space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface">
                          {idx + 1}. {c.name}
                        </span>
                        <span className="text-[10px] font-mono font-semibold text-primary px-1.5 py-0.5 rounded bg-primary/15 shrink-0">
                          Trọng số &bull; {weightPct}%
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
                  ? 'Câu hỏi trắc nghiệm khách quan Tầng 1–2 được chấm tất định tức thì để mở khóa nhanh sang các tầng tình huống.'
                  : 'Phản hồi chi tiết từng tiêu chí Rubric và giải thích từ AI Tutor sẽ hiển thị ngay sau khi bạn nộp bài.'}
              </p>
            )}

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-mono text-outline uppercase">
                  Điểm bước gần nhất
                </span>
                <span className="text-base font-extrabold font-headline text-primary">
                  {completedTiers.length > 0 ? `${Math.round(lastScore * 100)} / 100` : '-- / 100'}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                Ngưỡng đạt &ge; 75 / 100
              </span>
            </div>
          </div>

          {/* Card 2: Session Provenance & Evidence History */}
          <div className="bg-surface-container-lowest rounded-xl p-5 shadow-sm border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-secondary/10 flex items-center justify-center text-secondary">
                  <Clock className="w-4 h-4" aria-hidden="true" />
                </div>
                <h2 className="text-xs font-bold font-headline text-on-surface">
                  Lịch sử Quan sát Bằng chứng
                </h2>
              </div>
              <span className="text-[10px] font-mono text-on-surface-variant">
                Session #{shortSessionId}
              </span>
            </div>

            {completedTiers.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Chưa có bước đánh giá nào hoàn tất trong phiên hiện tại.
              </p>
            ) : (
              <div className="space-y-3">
                {completedTiers.map((item, idx) => {
                  const passedStep = item.score >= 0.75
                  return (
                    <div
                      key={`${item.tier}-${idx}`}
                      className="flex items-start justify-between gap-2.5 p-2.5 rounded-lg bg-surface-container-low text-xs"
                    >
                      <div className="flex items-start gap-2">
                        {passedStep ? (
                          <CheckCircle2
                            className="w-4 h-4 text-primary shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <AlertTriangle
                            className="w-4 h-4 text-error shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="font-bold text-on-surface">
                            {TIER_NAMES[item.tier]?.label ?? `Tầng ${item.tier}`}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {passedStep
                              ? 'Đạt chuẩn mở khóa tầng kế tiếp'
                              : 'Chạm trần hiểu biết hiện tại'}
                          </span>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold shrink-0 ${
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
              <div className="pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="w-full inline-flex items-center justify-between p-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-tertiary" aria-hidden="true" />
                    <span>Trợ lý Gia sư AI Socratic (SCR-14)</span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-outline" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* 4. STATUS FOOTER CONTINUITY */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-xs text-on-surface-variant">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
          <span className="font-semibold text-on-surface">Đánh giá Thích ứng Hoạt động:</span>
          <span>
            Hệ thống phân tích ma trận Bloom 5 tầng ({graderSource})
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>Status: {sessionStatus}</span>
          <span className="text-outline-variant">&bull;</span>
          <span className="text-primary font-semibold">SHA-256 Validated</span>
        </div>
      </div>

      <AiTutorRubricDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        conceptSlug={conceptSlug}
        graderSource={graderSource}
        stepScore={lastScore}
        tutorFeedback={tutorFeedback}
        updatedCompetency={updatedComp}
        onCompleteAndReturn={() => {
          setIsDrawerOpen(false)
          if (!stepItem) onBackToRoadmap()
        }}
      />
    </section>
  )
}
