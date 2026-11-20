import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  GitBranch,
  Layers,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react'
import { apiStartPlacement, apiSubmitPlacementAnswer } from '../api'
import type { PlacementInitializedNode, PlacementQuestionItem } from '../types'
import { generateSubmissionId } from '../utils/submission'

interface AdaptivePlacementPageProps {
  domainSlug: string
  onFinished: (domainSlug: string) => void
  onBack: () => void
}

const TIER_DESCRIPTIONS: Record<number, { title: string; desc: string }> = {
  1: { title: 'Tầng 1: Nền tảng Cốt lõi', desc: 'Khái niệm gốc & mô hình hệ thống' },
  2: { title: 'Tầng 2: Giao thức & Dữ liệu', desc: 'Cơ chế vận hành & lưu trữ' },
  3: { title: 'Tầng 3: Kiến trúc & Tích hợp', desc: 'Thiết kế API, caching & đồng bộ' },
  4: { title: 'Tầng 4: Bảo mật & Vận hành', desc: 'An toàn, giám sát & chịu tải' },
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
  const [initializedNodes, setInitializedNodes] = useState<PlacementInitializedNode[]>([])
  const [completed, setCompleted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)

  const initPlacement = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiStartPlacement(domainSlug)
      if (!mountedRef.current) return
      setSessionId(res.session_id)
      setMaxQuestions(res.max_questions)
      setQuestion(res.current_question)
      setPendingSubmissionId(generateSubmissionId())
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Lỗi khởi tạo chẩn đoán đầu vào')
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

  async function handleSubmitAnswer() {
    if (!sessionId || !question || !selectedOpt) return
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
      setInitializedNodes(res.initialized_nodes)
      setSelectedOpt('')
      setPendingSubmissionId(generateSubmissionId())
      if (res.placement_status === 'completed' || !res.next_question) {
        setCompleted(true)
        setQuestion(null)
      } else {
        setStepCount((c) => c + 1)
        setQuestion(res.next_question)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể nộp câu trả lời')
    } finally {
      setSubmitting(false)
    }
  }

  const progressPct = completed
    ? 100
    : Math.min(100, Math.round((stepCount / Math.max(1, maxQuestions)) * 100))
  const remainingQuestions = completed ? 0 : Math.max(0, maxQuestions - stepCount + 1)

  return (
    <section className="w-full pb-8 space-y-6" data-testid="scr10-adaptive-placement">
      {/* Top Sub-header Bar */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-on-primary-container px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Quay về Trung tâm Đa lĩnh vực</span>
          </button>
          <span className="text-outline-variant text-xs hidden sm:inline">•</span>
          <nav
            aria-label="Breadcrumb"
            className="hidden sm:flex items-center gap-2 text-xs text-on-surface-variant font-medium"
          >
            <span>Trung tâm Lĩnh vực</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" aria-hidden="true" />
            <span className="font-mono text-primary font-semibold">{domainSlug}</span>
            <ChevronRight className="w-3.5 h-3.5 text-outline" aria-hidden="true" />
            <span className="text-on-surface font-semibold">Chẩn đoán Đầu vào Thích ứng</span>
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container text-on-surface-variant text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>Đánh giá năng lực đầu vào thích ứng</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high text-xs font-mono font-medium text-on-surface">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-tertiary font-semibold">
              {completed
                ? 'Hoàn tất phân tầng'
                : question
                  ? `Đang chẩn đoán Tầng ${question.tier}`
                  : 'Khởi tạo phiên'}
            </span>
          </div>
        </div>
      </div>

      {/* Adaptive Diagnostic Progress Banner */}
      <div className="bg-surface-container-lowest p-5 rounded-xl shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5">
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container/30 text-on-tertiary-container font-headline font-bold text-xs uppercase tracking-wider">
                Khảo sát CAT
              </span>
              <span className="text-sm font-semibold text-on-surface truncate">
                {completed
                  ? `Hoàn tất chẩn đoán ${domainSlug}`
                  : question
                    ? `Bước ${stepCount} / ${maxQuestions} — Đang lấy mẫu Tầng ${question.tier} (${question.concept_slug})`
                    : 'Đang chuẩn bị câu hỏi chẩn đoán...'}
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-primary shrink-0">
              {progressPct}%
            </span>
          </div>
          <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-container-low shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="flex flex-col text-xs">
            <span className="font-semibold text-primary">
              Trần khởi tạo: 75% (Confidence 0.60)
            </span>
            <span className="font-mono text-on-surface-variant text-[11px]">
              Độ bền trí nhớ ban đầu S₀ = 3.0 ngày
            </span>
          </div>
        </div>
      </div>

      {/* Two-Column Diagnostic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 sm:p-8 flex flex-col gap-6">
            {loading && (
              <div className="space-y-4">
                <div className="h-6 w-1/3 rounded-lg bg-surface-container-low animate-pulse" />
                <div className="h-20 rounded-xl bg-surface-container-low animate-pulse" />
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className="h-14 rounded-xl bg-surface-container-low animate-pulse"
                    />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-error-container/15 border border-error/30 flex flex-wrap items-center justify-between gap-3 text-sm text-error"
              >
                <span className="inline-flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {error}
                </span>
                {!question && !completed ? (
                  <button
                    type="button"
                    onClick={() => void initPlacement()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-error/30 text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Thử lại
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleSubmitAnswer()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest border border-error/30 text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                    Gửi lại an toàn
                  </button>
                )}
              </div>
            )}

            {!loading && !error && !completed && !question && (
              <div className="p-6 rounded-xl bg-surface-container-low text-center space-y-3">
                <p className="text-sm font-bold text-on-surface">
                  Chưa có câu hỏi chẩn đoán khả dụng cho lĩnh vực này.
                </p>
                <button
                  type="button"
                  onClick={onBack}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold cursor-pointer"
                >
                  Quay về Trung tâm Đa lĩnh vực
                </button>
              </div>
            )}

            {!loading && !completed && question && (
              <div className="flex flex-col gap-6">
                {/* Metadata Pills Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary font-mono text-xs font-semibold">
                    <Target className="w-3.5 h-3.5" aria-hidden="true" />
                    Node: {question.concept_slug} (Tầng {question.tier})
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-tertiary text-xs font-medium">
                    <Layers className="w-3.5 h-3.5 text-tertiary" aria-hidden="true" />
                    Bước {stepCount} / {maxQuestions}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container text-xs font-medium">
                    <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                    Chẩn đoán Thích ứng DAG
                  </span>
                </div>

                {/* Scenario Question Prompt */}
                <h1 className="text-lg sm:text-xl font-headline font-bold text-on-surface leading-snug">
                  {question.prompt}
                </h1>

                {/* Structured Single Choice Options */}
                <div
                  className="flex flex-col gap-3"
                  role="radiogroup"
                  aria-label="Đáp án lựa chọn"
                >
                  {Object.entries(question.options).map(([key, text]) => {
                    const isSelected = selectedOpt === key
                    return (
                      <label
                        key={key}
                        className={`group relative flex items-start gap-3.5 p-4 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-primary-container/20 border-2 border-primary shadow-sm'
                            : 'bg-surface-container-low hover:bg-surface-container border-2 border-transparent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="placement-opt"
                          value={key}
                          checked={isSelected}
                          onChange={() => setSelectedOpt(key)}
                          className="mt-1 h-4 w-4 accent-primary cursor-pointer shrink-0"
                        />
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-surface-container-lowest text-on-surface shrink-0">
                          {key}
                        </span>
                        <span className="text-sm text-on-surface leading-relaxed flex-1 font-medium">
                          {text}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary text-on-primary uppercase tracking-wide shrink-0">
                            Đã chọn
                          </span>
                        )}
                      </label>
                    )
                  })}
                </div>

                {/* Action Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-4 border-t border-surface-container">
                  <span className="text-xs text-on-surface-variant">
                    Chọn 1 đáp án chính xác nhất để thuật toán xác định điểm xuất phát trên đồ thị.
                  </span>
                  <button
                    type="button"
                    disabled={!selectedOpt || submitting}
                    onClick={() => void handleSubmitAnswer()}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-primary hover:bg-primary-dim text-on-primary shadow-sm disabled:opacity-45 cursor-pointer transition-all shrink-0"
                  >
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {submitting
                        ? 'Đang suy diễn nhánh DAG...'
                        : 'Nộp câu trả lời & Xác định Điểm xuất phát'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {!loading && completed && (
              <div className="space-y-5">
                {initializedNodes.length > 0 ? (
                  <div className="p-4 rounded-xl bg-primary-container/25 border border-primary/30 flex items-start gap-3">
                    <CheckCircle2
                      className="w-5 h-5 text-primary shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <h2 className="text-base font-headline font-bold text-on-primary-fixed">
                        Hoàn tất Chẩn đoán Đầu vào!
                      </h2>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Các khái niệm đạt chuẩn được khởi tạo tối đa ở mức Hiểu bản chất (75%), độ
                        tin cậy 60% và độ bền trí nhớ S₀ = 3.0 ngày.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-tertiary-fixed/15 border border-tertiary/30 flex items-start gap-3">
                    <AlertTriangle
                      className="w-5 h-5 text-tertiary shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                      <h2 className="text-base font-headline font-bold text-on-tertiary-container">
                        Chưa đủ bằng chứng khởi tạo nâng bậc
                      </h2>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        Bạn sẽ bắt đầu lộ trình từ các khái niệm gốc Tầng 1 để xây dựng nền tảng
                        vững chắc.
                      </p>
                    </div>
                  </div>
                )}

                {initializedNodes.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant font-label">
                      Các Node đã được Khởi tạo ({initializedNodes.length})
                    </h3>
                    {initializedNodes.map((n) => (
                      <div
                        key={n.concept_slug}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-surface-container-low text-xs"
                      >
                        <span className="font-mono font-bold text-on-surface flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
                          {n.concept_slug}
                        </span>
                        <span className="font-mono font-bold text-primary">
                          Mức hiểu: {Math.round(n.depth_level_norm * 100)}% (Conf{' '}
                          {n.confidence.toFixed(2)})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => onFinished(domainSlug)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-dim text-on-primary font-headline font-bold text-sm cursor-pointer shadow-sm transition-all"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>Mở Bản đồ Knowledge Graph {domainSlug}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols) — Live DAG Placement Preview */}
        <aside className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                <Compass className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="flex flex-col">
                <h2 className="font-headline font-bold text-sm text-on-surface leading-tight">
                  Dự kiến Mở khóa Đồ thị ({domainSlug})
                </h2>
                <span className="text-xs text-on-surface-variant mt-0.5">
                  Theo kết quả Adaptive Testing
                </span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant leading-relaxed">
              Thuật toán Adaptive Testing sử dụng đồ thị phụ thuộc (DAG) để xác định điểm xuất phát
              tối ưu, giúp bạn không cần học lại các khái niệm đã nắm vững.
            </p>

            {/* DAG Tiers Stack */}
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((t) => {
                const activeTier = question?.tier ?? (completed ? 5 : 1)
                const isDone = completed || activeTier > t
                const isCurrent = !completed && activeTier === t
                const info = TIER_DESCRIPTIONS[t]
                return (
                  <div
                    key={t}
                    className={`p-3.5 rounded-xl flex flex-col gap-2 transition-colors ${
                      isCurrent
                        ? 'bg-surface-container shadow-sm border border-tertiary/40'
                        : isDone
                          ? 'bg-surface-container-low border border-primary/20'
                          : 'bg-surface-container-low/60 opacity-75'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isDone ? (
                          <CheckCircle2
                            className="w-4 h-4 text-primary shrink-0"
                            aria-hidden="true"
                          />
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
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          isCurrent
                            ? 'bg-tertiary-container/40 text-on-tertiary-container'
                            : isDone
                              ? 'bg-primary-container text-on-primary-container'
                              : 'bg-surface-container text-on-surface-variant'
                        }`}
                      >
                        {isCurrent ? 'Đang chẩn đoán' : isDone ? 'Đã qua' : 'Chờ mở khóa'}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-normal">
                      {info.desc}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Bottom Diagnostics Metadata Box */}
            <div className="p-3.5 rounded-lg bg-surface-container flex flex-col gap-2 text-xs font-mono">
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Thuật toán:</span>
                <span className="font-bold text-on-surface">CAT + DAG Placement</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Trần khởi tạo:</span>
                <span className="font-bold text-primary">75% (Conf 0.60)</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Độ bền Ebbinghaus:</span>
                <span className="font-bold text-on-surface">S₀ = 3.0 ngày</span>
              </div>
              <div className="flex items-center justify-between text-on-surface-variant">
                <span>Số câu còn lại:</span>
                <span className="font-bold text-on-surface">{remainingQuestions} câu</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
