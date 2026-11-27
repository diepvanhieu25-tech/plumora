import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Lock,
  ShieldCheck,
  Sparkles,
  Target,
  XCircle,
} from 'lucide-react'
import { apiStartPlacement, apiSubmitPlacementAnswer } from '../../api'
import { AdaptiveNextStepCard } from '../../components/learner/AdaptiveNextStepCard'
import { PageContextBar } from '../../components/ui/PageContextBar'
import { SafetyConfirmModal } from '../../components/ui/SafetyConfirmModal'
import { StatusAlertBanner } from '../../components/ui/StatusAlertBanner'
import type { PlacementInitializedNode, PlacementQuestionItem } from '../../types'
import { generateSubmissionId } from '../../utils/submission'

interface AdaptivePlacementPageProps {
  domainSlug: string
  onFinished: (domainSlug: string) => void
  onBack: () => void
}

const TIER_DESCRIPTIONS: Record<number, { title: string; desc: string }> = {
  1: { title: 'Tầng 1: Nền tảng Cốt lõi', desc: 'Kiến thức gốc và mô hình hệ thống' },
  2: { title: 'Tầng 2: Giao thức & Dữ liệu', desc: 'Cơ chế vận hành và lưu trữ' },
  3: { title: 'Tầng 3: Kiến trúc & Tích hợp', desc: 'Thiết kế API, tối ưu và đồng bộ' },
  4: { title: 'Tầng 4: Bảo mật & Vận hành', desc: 'An toàn hệ thống và chịu tải thực tế' },
}

export function AdaptivePlacementPage({
  domainSlug,
  onFinished,
  onBack,
}: AdaptivePlacementPageProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [maxQuestions, setMaxQuestions] = useState(6)
  const [question, setQuestion] = useState<PlacementQuestionItem | null>(null)
  const [selectedOpt, setSelectedOpt] = useState<string>('')
  const [pendingSubmissionId, setPendingSubmissionId] = useState<string>(() =>
    generateSubmissionId(),
  )
  const [stepCount, setStepCount] = useState(1)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [lastStepFeedback, setLastStepFeedback] = useState<{
    passed: boolean
    nextQuestion: PlacementQuestionItem | null
    isCompleted: boolean
  } | null>(null)
  const [initializedNodes, setInitializedNodes] = useState<PlacementInitializedNode[]>([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExitWarning, setShowExitWarning] = useState(false)

  const mountedRef = useRef(true)

  const initPlacement = useCallback(async () => {
    setLoading(true)
    setError(null)
    setLastStepFeedback(null)
    try {
      const res = await apiStartPlacement(domainSlug)
      if (!mountedRef.current) return
      setSessionId(res.session_id)
      setMaxQuestions(res.max_questions)
      setQuestion(res.current_question)
      setPendingSubmissionId(generateSubmissionId())
      setStepCount(1)
      setAnsweredCount(0)
      setCompleted(false)
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Lỗi khởi tạo bài định vị đầu vào')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [domainSlug])

  useEffect(() => {
    mountedRef.current = true
    void initPlacement()
    return () => {
      mountedRef.current = false
    }
  }, [initPlacement])

  // Keyboard shortcuts 1-4 for MCQ options
  useEffect(() => {
    if (!question || completed || lastStepFeedback) return
    const keys = Object.keys(question.options)
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const idx = ['1', '2', '3', '4'].indexOf(e.key)
      if (idx >= 0 && keys[idx]) {
        setSelectedOpt(keys[idx])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, completed, lastStepFeedback])

  async function handleSubmitAnswer() {
    if (!sessionId || !question || !selectedOpt || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await apiSubmitPlacementAnswer(
        domainSlug,
        sessionId,
        pendingSubmissionId,
        question.question_id,
        selectedOpt,
      )
      if (!mountedRef.current) return
      setInitializedNodes(res.initialized_nodes)
      setAnsweredCount((c) => c + 1)
      setPendingSubmissionId(generateSubmissionId())
      const isDone = res.placement_status === 'completed' || !res.next_question
      setLastStepFeedback({
        passed: res.step_passed,
        nextQuestion: res.next_question,
        isCompleted: isDone,
      })
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Không thể nộp câu trả lời')
    } finally {
      if (mountedRef.current) setSubmitting(false)
    }
  }

  function handleAdvanceAfterFeedback() {
    if (!lastStepFeedback) return
    setSelectedOpt('')
    if (lastStepFeedback.isCompleted || !lastStepFeedback.nextQuestion) {
      setCompleted(true)
      setQuestion(null)
    } else {
      setStepCount((c) => c + 1)
      setQuestion(lastStepFeedback.nextQuestion)
    }
    setLastStepFeedback(null)
  }

  function handleBackRequest() {
    if (!completed && answeredCount > 0 && answeredCount < 2) {
      setShowExitWarning(true)
      return
    }
    onBack()
  }

  const progressPct = completed
    ? 100
    : Math.min(100, Math.round((stepCount / Math.max(1, maxQuestions)) * 100))
  const remainingQuestions = completed ? 0 : Math.max(0, maxQuestions - stepCount + 1)

  return (
    <section className="w-full pb-8 space-y-6" data-testid="scr10-adaptive-placement">
      <PageContextBar
        backLabel="Quay về Trung tâm Chuyên ngành"
        onBack={handleBackRequest}
        breadcrumbs={[
          { label: 'Chuyên ngành', onClick: handleBackRequest },
          { label: domainSlug },
          { label: 'Định vị Năng lực Đầu vào', isCurrent: true },
        ]}
        rightSlot={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ai-sunlit-bg border border-ai-sunlit-border/40 text-xs font-bold text-ai-sunlit-text">
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            <span>
              {completed
                ? 'Đã hoàn tất định vị'
                : question
                  ? `Đang kiểm tra Tầng ${question.tier}`
                  : 'Đang chuẩn bị'}
            </span>
          </div>
        }
      />

      {/* Progress Banner */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-outline-variant/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-bold text-on-surface truncate">
              {completed
                ? 'Hoàn tất đánh giá định vị đầu vào'
                : question
                  ? `Câu hỏi ${stepCount} / ${maxQuestions} — Tầng ${question.tier}`
                  : 'Đang chuẩn bị câu hỏi...'}
            </span>
            <span className="text-xs font-mono font-bold text-primary shrink-0">
              {progressPct}%
            </span>
          </div>
          <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-low shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <div className="text-xs">
            <span className="font-bold text-on-surface block">Mở khóa tự động phần đã vững</span>
            <span className="text-on-surface-variant text-[11px]">
              Khởi tạo tối đa ở mức Hiểu bản chất (75%)
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/50 p-6 sm:p-8 flex flex-col gap-6">
            {loading && (
              <div className="space-y-4">
                <div className="h-6 w-1/3 rounded-lg bg-surface-container animate-pulse" />
                <div className="h-20 rounded-xl bg-surface-container animate-pulse" />
                {[0, 1, 2, 3].map((idx) => (
                  <div key={idx} className="h-14 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            )}

            {error && (
              <StatusAlertBanner
                variant="error"
                message={error}
                onRetry={!question && !completed ? () => void initPlacement() : () => void handleSubmitAnswer()}
                retryLabel={!question && !completed ? 'Thử lại' : 'Gửi lại an toàn'}
              />
            )}

            {!loading && !error && !completed && !question && (
              <div className="p-6 rounded-xl bg-surface-container-low text-center space-y-3">
                <p className="text-sm font-bold text-on-surface">
                  Chưa có câu hỏi định vị khả dụng cho chuyên ngành này.
                </p>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold cursor-pointer"
                >
                  Quay về Trung tâm Chuyên ngành
                </button>
              </div>
            )}

            {!loading && !completed && question && (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold">
                    <Target className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tầng {question.tier}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium">
                    Câu {stepCount} / {maxQuestions}
                  </span>
                  <span className="text-[11px] text-outline ml-auto hidden sm:inline">
                    Mẹo: Nhấn phím 1–4 để chọn nhanh đáp án
                  </span>
                </div>

                <h1 className="text-lg sm:text-xl font-headline font-bold text-on-surface leading-snug">
                  {question.prompt}
                </h1>

                <div className="flex flex-col gap-3" role="radiogroup" aria-label="Đáp án lựa chọn">
                  {Object.entries(question.options).map(([key, text]) => {
                    const isSelected = selectedOpt === key
                    return (
                      <label
                        key={key}
                        className={`relative flex items-start gap-3.5 p-4 rounded-xl transition-all ${
                          lastStepFeedback ? 'cursor-default opacity-90' : 'cursor-pointer'
                        } ${
                          isSelected
                            ? 'bg-primary-container/30 border-2 border-primary shadow-xs'
                            : 'bg-surface-container-low hover:bg-surface-container border-2 border-transparent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="placement-opt"
                          value={key}
                          disabled={Boolean(lastStepFeedback)}
                          checked={isSelected}
                          onChange={() => setSelectedOpt(key)}
                          className="mt-1 h-4 w-4 accent-primary cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-outline-variant/50 text-on-surface shrink-0">
                          {key}
                        </span>
                        <span className="text-sm text-on-surface leading-relaxed flex-1 font-medium">
                          {text}
                        </span>
                      </label>
                    )
                  })}
                </div>

                {/* Immediate Step Feedback */}
                {lastStepFeedback && (
                  <div
                    role="status"
                    aria-live="polite"
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      lastStepFeedback.passed
                        ? 'bg-primary-container/40 border-primary/30 text-on-primary-container'
                        : 'bg-ai-sunlit-bg border-ai-sunlit-border/50 text-ai-sunlit-text'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {lastStepFeedback.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                      ) : (
                        <XCircle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <div className="text-xs sm:text-sm space-y-0.5">
                        <p className="font-bold">
                          {lastStepFeedback.passed
                            ? 'Chính xác! Bạn đã nắm vững nội dung này.'
                            : 'Chưa chính xác — Hệ thống sẽ giữ chủ đề này trong lộ trình học của bạn.'}
                        </p>
                        <p className="text-xs opacity-90">
                          {lastStepFeedback.isCompleted
                            ? 'Đã đủ dữ liệu để hoàn tất định vị lộ trình cho bạn.'
                            : 'Tiếp tục sang câu hỏi tiếp theo để hoàn thiện hồ sơ đầu vào.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdvanceAfterFeedback}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold shrink-0 cursor-pointer"
                    >
                      <span>{lastStepFeedback.isCompleted ? 'Xem Kết quả Định vị' : 'Câu tiếp theo'}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                )}

                {!lastStepFeedback && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-surface-container">
                    <span className="text-xs text-on-surface-variant">
                      Chọn 1 đáp án chính xác nhất để tiếp tục.
                    </span>
                    <button
                      type="button"
                      disabled={!selectedOpt || submitting}
                      onClick={() => void handleSubmitAnswer()}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-primary hover:bg-primary-dim text-on-primary shadow-sm disabled:opacity-45 cursor-pointer transition-colors shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>{submitting ? 'Đang kiểm tra...' : 'Kiểm tra đáp án'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {!loading && completed && (
              <div className="space-y-5" role="status" aria-live="polite">
                {initializedNodes.some((n) => n.depth_level_norm >= 0.5) ? (
                  <div className="p-4 rounded-xl bg-primary-container/35 border border-primary/30 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <h2 className="text-base font-headline font-bold text-on-primary-container">
                        Hoàn tất Định vị Năng lực Đầu vào!
                      </h2>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Các chủ đề bạn đã nắm vững được khởi tạo tối đa ở mức Hiểu bản chất (75%) để mở khóa ngay các chủ đề tiếp theo trên lộ trình.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-ai-sunlit-bg border border-ai-sunlit-border/40 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-tertiary shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-1">
                      <h2 className="text-base font-headline font-bold text-ai-sunlit-text">
                        Sẵn sàng bắt đầu từ nền tảng Tầng 1
                      </h2>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Bạn sẽ bắt đầu lộ trình từ các chủ đề nền tảng Tầng 1 để xây dựng kiến thức vững chắc ngay từ đầu.
                      </p>
                    </div>
                  </div>
                )}

                {initializedNodes.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Các chủ đề đã được đánh giá ({initializedNodes.length})
                    </h3>
                    {initializedNodes.map((n) => (
                      <div
                        key={n.concept_slug}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low text-xs"
                      >
                        <span className="font-semibold text-on-surface flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                          <span>{n.concept_slug}</span>
                        </span>
                        <span className="font-mono font-bold text-primary">
                          Mức khởi tạo: {Math.round(n.depth_level_norm * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <AdaptiveNextStepCard domainSlug={domainSlug} />

                <button
                  type="button"
                  onClick={() => onFinished(domainSlug)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dim text-on-primary font-bold text-sm cursor-pointer shadow-sm transition-colors"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Mở Bản đồ Lộ trình của Bạn</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live 4-Tier Unlocking Preview */}
        <aside className="lg:col-span-4">
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/50 p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary-container text-primary flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="font-headline font-bold text-sm text-on-surface leading-tight">
                  Tiến trình Định vị 4 Tầng
                </h2>
                <span className="text-xs text-on-surface-variant">
                  Còn lại tối đa {remainingQuestions} câu hỏi
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              {[1, 2, 3, 4].map((t) => {
                const activeTier = question?.tier ?? (completed ? 5 : 1)
                const isDone = completed || activeTier > t
                const isCurrent = !completed && activeTier === t
                const info = TIER_DESCRIPTIONS[t]
                return (
                  <div
                    key={t}
                    className={`p-3.5 rounded-xl flex flex-col gap-1.5 transition-colors ${
                      isCurrent
                        ? 'bg-ai-sunlit-bg border border-ai-sunlit-border/50'
                        : isDone
                          ? 'bg-primary-container/25 border border-primary/20'
                          : 'bg-surface-container-low opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                        ) : isCurrent ? (
                          <Clock className="w-4 h-4 text-tertiary shrink-0" aria-hidden="true" />
                        ) : (
                          <Lock className="w-4 h-4 text-outline shrink-0" aria-hidden="true" />
                        )}
                        <span className="text-xs font-bold text-on-surface truncate">
                          {info.title}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isCurrent
                            ? 'bg-tertiary text-on-tertiary'
                            : isDone
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-container text-outline'
                        }`}
                      >
                        {isCurrent ? 'Đang hỏi' : isDone ? 'Đã qua' : 'Chờ mở'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant">{info.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      <SafetyConfirmModal
        isOpen={showExitWarning}
        title="Rời bài Định vị Đầu vào?"
        description="Bạn mới trả lời 1 câu hỏi nên hệ thống chưa có đủ cơ sở để định vị vượt tầng. Bạn có chắc muốn quay về Trung tâm Chuyên ngành không?"
        confirmLabel="Quay về Trung tâm"
        cancelLabel="Tiếp tục làm bài"
        variant="warning"
        onConfirm={() => {
          setShowExitWarning(false)
          onBack()
        }}
        onCancel={() => setShowExitWarning(false)}
      />
    </section>
  )
}
