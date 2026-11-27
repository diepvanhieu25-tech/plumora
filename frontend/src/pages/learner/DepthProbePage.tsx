import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  apiAbandonAssessmentV2,
  apiStartAssessmentV2,
  apiSubmitAssessmentV2,
} from '../../api'
import { AdaptiveNextStepCard } from '../../components/learner/AdaptiveNextStepCard'
import { AiTutorRubricDrawer } from '../../components/learner/AiTutorRubricDrawer'
import { DepthProbeQuestionCard } from '../../components/assessment/DepthProbeQuestionCard'
import { DepthProbeSidebar } from '../../components/assessment/DepthProbeSidebar'
import { DepthProbeStepperBar } from '../../components/assessment/DepthProbeStepperBar'
import { PlaybookQuickDrawer } from '../../components/learner/PlaybookQuickDrawer'
import { PageContextBar } from '../../components/ui/PageContextBar'
import { SafetyConfirmModal } from '../../components/ui/SafetyConfirmModal'
import { StatusAlertBanner } from '../../components/ui/StatusAlertBanner'
import { useDraftStorage } from '../../hooks/useDraftStorage'
import type {
  DepthStepItem,
  TutorFeedbackOut,
  UpdatedCompetencyOut,
} from '../../types'
import { generateSubmissionId } from '../../utils/submission'

interface DepthProbePageProps {
  domainSlug: string
  conceptSlug: string
  sessionMode: 'depth_probe' | 'spaced_review'
  onBackToRoadmap: () => void
  onStartCodeSandbox?: (conceptSlug: string) => void
}

export function DepthProbePage({
  domainSlug,
  conceptSlug,
  sessionMode,
  onBackToRoadmap,
  onStartCodeSandbox,
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
      <DepthProbeStepperBar
        isSpacedReview={isSpacedReview}
        sessionStatus={sessionStatus}
        stepItem={stepItem}
        completedTiers={completedTiers}
        updatedComp={updatedComp}
      />

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
              <DepthProbeQuestionCard
                stepItem={stepItem}
                isSpacedReview={isSpacedReview}
                isMcq={isMcq}
                selectedOption={selectedOption}
                onSelectOption={setSelectedOption}
                writtenExplanation={writtenExplanation}
                onWrittenExplanationChange={setWrittenExplanation}
                mcqFeedback={mcqFeedback}
                canSubmit={canSubmit}
                submitting={submitting}
                onContinueAfterMcq={handleContinueAfterMcq}
                onRequestAbandon={() => setShowAbandonModal(true)}
                onSubmit={() => void handleSubmit()}
              />
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
                            ? 'Đã xác lập Mốc Năng lực Hiện tại — Điểm xuất phát tối ưu tiếp theo'
                            : isSpacedReview
                              ? 'Hoàn tất Ôn tập Củng cố Trí nhớ!'
                              : 'Hoàn tất Phiên Luyện tập Đào sâu 5 Cấp độ!'}
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

                <AdaptiveNextStepCard domainSlug={domainSlug} />

                <div className="flex flex-col sm:flex-row gap-2.5">
                  {updatedComp.depth_level_norm >= 0.75 &&
                    updatedComp.depth_level_norm < 1.0 &&
                    onStartCodeSandbox && (
                      <button
                        type="button"
                        onClick={() => onStartCodeSandbox(conceptSlug)}
                        className="flex-1 py-3 px-4 rounded-xl bg-secondary text-on-secondary font-bold text-sm hover:opacity-90 cursor-pointer transition-opacity"
                      >
                        Sang Phòng Thực hành Code để đạt Làm chủ (100%)
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={onBackToRoadmap}
                    className="flex-1 py-3 px-4 rounded-xl bg-primary text-on-primary font-bold text-sm hover:bg-primary-dim cursor-pointer transition-colors"
                  >
                    Quay về Bản đồ Lộ trình
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Rubric Criteria & Step History */}
        <DepthProbeSidebar
          stepItem={stepItem}
          isMcq={isMcq}
          completedTiers={completedTiers}
          lastScore={lastScore}
          tutorFeedback={tutorFeedback}
          onOpenTutorDrawer={() => setIsDrawerOpen(true)}
        />
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
