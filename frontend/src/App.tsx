import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  FALLBACK_CONCEPT_DETAIL,
  apiApplyPreset,
  apiGetConceptDetail,
  apiGetMe,
  apiGetRecommendation,
  apiGetRoadmap,
  apiLogin,
  apiLogout,
  apiRegister,
  apiSubmitAttempt,
} from './api'
import { LockedAlert } from './components/alert/LockedAlert'
import { Header } from './components/common/Header'
import { Toast } from './components/common/Toast'
import { ProvenanceDrawer } from './components/drawer/ProvenanceDrawer'
import { AttemptHistoryModal } from './components/history/AttemptHistoryModal'
import { PresetModal } from './components/modal/PresetModal'
import { AuthPage } from './pages/AuthPage'
import { LessonPage } from './pages/LessonPage'
import { QuizPage } from './pages/QuizPage'
import { RoadmapPage } from './pages/RoadmapPage'
import type {
  ActiveView,
  AttemptResult,
  ConceptDetail,
  DagNode,
  LearnerUser,
  RecommendationPayload,
  ToastNotification,
  ToastType,
} from './types'
import { generateSubmissionId } from './utils/submission'

interface AppProps {
  initialUser?: LearnerUser | null
  initialView?: ActiveView
  initialNodes?: DagNode[]
  initialRecommendation?: RecommendationPayload | null
}

export function App({
  initialUser = null,
  initialView,
  initialNodes = [],
  initialRecommendation = null,
}: AppProps = {}) {
  const [user, setUser] = useState<LearnerUser | null>(initialUser)
  const [activeView, setActiveView] = useState<ActiveView>(
    initialView ?? (initialUser ? 'roadmap' : 'roadmap'),
  )
  const [nodes, setNodes] = useState<DagNode[]>(initialNodes)
  const [recommendation, setRecommendation] =
    useState<RecommendationPayload | null>(initialRecommendation)
  const [currentConcept, setCurrentConcept] =
    useState<ConceptDetail>(FALLBACK_CONCEPT_DETAIL)
  const [roadmapError, setRoadmapError] = useState<string | null>(null)
  const [lockedErrorInfo, setLockedErrorInfo] = useState<{
    slug: string
    message: string
    missingPrerequisites: string[]
  } | null>(null)
  const [conceptFetchError, setConceptFetchError] = useState<{
    slug: string
    targetScreen: 'scr03_lesson' | 'scr04_quiz'
    message: string
  } | null>(null)

  // Auth form state (SCR-01)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [usernameInput, setUsernameInput] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<ToastNotification | null>(null)

  // Modals & Drawers
  const [pendingPreset, setPendingPreset] = useState<{
    key: string
    title: string
  } | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  function showToast(message: string, type: ToastType = 'info'): void {
    setToast({ message, type })
  }

  // Quiz state (SCR-04)
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, 'A' | 'B' | 'C' | 'D'>
  >({})
  const [submissionId, setSubmissionId] = useState<string>(() =>
    generateSubmissionId(),
  )
  const [attemptResult, setAttemptResult] = useState<AttemptResult | null>(null)
  const [quizError, setQuizError] = useState<string | null>(null)

  const masteredCount = useMemo(
    () => nodes.filter((n) => n.status === 'mastered').length,
    [nodes],
  )

  async function refreshRoadmapAndRecommendation(): Promise<void> {
    setRoadmapError(null)
    try {
      const [rm, rec] = await Promise.all([
        apiGetRoadmap(),
        apiGetRecommendation(),
      ])
      setNodes(rm.nodes)
      setRecommendation(rec)
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ khi tải lộ trình học tập'
      setRoadmapError(msg)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const me = await apiGetMe()
      if (mounted) {
        if (me) {
          setUser(me)
          await refreshRoadmapAndRecommendation()
        } else if (initialUser) {
          await refreshRoadmapAndRecommendation()
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [initialUser])

  async function handleLoginSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setAuthError(null)
    setIsLoading(true)
    try {
      if (authMode === 'login') {
        const res = await apiLogin(usernameInput.trim(), passwordInput)
        setUser(res.user)
        showToast(`Đăng nhập thành công với tài khoản ${res.user.username}`, 'success')
      } else {
        const res = await apiRegister(
          usernameInput.trim(),
          displayNameInput.trim(),
          passwordInput,
        )
        setUser(res.user)
        showToast(`Đăng ký thành công! Chào mừng ${res.user.username} đến với Plumora.`, 'success')
      }
      await refreshRoadmapAndRecommendation()
      setActiveView('roadmap')
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Xác thực không thành công',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleQuickPickSeedAccount(username: string): Promise<void> {
    setUsernameInput(username)
    setPasswordInput('PlumoraDemo#2026')
    setAuthError(null)
    setIsLoading(true)
    try {
      const res = await apiLogin(username, 'PlumoraDemo#2026')
      setUser(res.user)
      showToast(`Đã đăng nhập tài khoản ${res.user.username}`, 'info')
      await refreshRoadmapAndRecommendation()
      setActiveView('roadmap')
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Đăng nhập thất bại',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogout(): Promise<void> {
    try {
      await apiLogout()
    } finally {
      setUser(null)
      setNodes([])
      setRecommendation(null)
      setCurrentConcept(FALLBACK_CONCEPT_DETAIL)
      setSelectedAnswers({})
      setSubmissionId(generateSubmissionId())
      setAttemptResult(null)
      setQuizError(null)
      setRoadmapError(null)
      setLockedErrorInfo(null)
      setActiveView('roadmap')
      showToast('Đã đăng xuất an toàn khỏi hệ thống', 'info')
    }
  }

  async function handleOpenConcept(
    slug: string,
    targetScreen: 'scr03_lesson' | 'scr04_quiz' = 'scr03_lesson',
  ): Promise<void> {
    setIsLoading(true)
    setQuizError(null)
    setAttemptResult(null)
    setSelectedAnswers({})
    setSubmissionId(generateSubmissionId())
    setConceptFetchError(null)
    try {
      const result = await apiGetConceptDetail(slug)
      if (!result.ok) {
        if (result.locked) {
          setLockedErrorInfo({
            slug,
            message: result.message,
            missingPrerequisites: result.missingPrerequisites,
          })
          setActiveView('locked')
        } else {
          showToast(result.message, 'warning')
        }
        return
      }
      setCurrentConcept(result.data)
      setLockedErrorInfo(null)
      setActiveView(targetScreen === 'scr04_quiz' ? 'quiz' : 'lesson')
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Lỗi kết nối khi tải nội dung bài học'
      setConceptFetchError({
        slug,
        targetScreen,
        message: msg,
      })
      showToast(`Không thể tải bài học '${slug}': ${msg}`, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleConfirmApplyPreset(): Promise<void> {
    if (!pendingPreset) return
    setIsLoading(true)
    try {
      await apiApplyPreset(pendingPreset.key)
      showToast(`Đã áp dụng thành công hồ sơ ${pendingPreset.title}`, 'info')
      await refreshRoadmapAndRecommendation()
      setActiveView('roadmap')
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Không thể áp dụng hồ sơ mẫu',
        'error',
      )
    } finally {
      setIsLoading(false)
      setPendingPreset(null)
    }
  }

  async function handleQuizSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setQuizError(null)
    setIsLoading(true)
    try {
      const formattedAnswers = currentConcept.questions.map((q) => ({
        question_id: q.id,
        selected_option: selectedAnswers[q.id],
      }))
      const res = await apiSubmitAttempt(
        currentConcept.slug,
        submissionId,
        formattedAnswers,
      )
      setAttemptResult(res)
      if (res.passed) {
        showToast('Chúc mừng! Bạn đã đạt chuẩn thông thạo khái niệm (≥ 75%).', 'success')
      } else {
        showToast('Chưa đạt ngưỡng 75%. Bạn có thể xem lại bài học hoặc làm lại quiz bất cứ lúc nào.', 'warning')
      }
      await refreshRoadmapAndRecommendation()
    } catch (err) {
      setQuizError(
        err instanceof Error ? err.message : 'Lỗi khi gửi kết quả làm bài',
      )
    } finally {
      setIsLoading(false)
    }
  }

  // ==========================================
  // 1. UNAUTHENTICATED APP (Stitch SCR-01 Guard)
  // ==========================================
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAF7] text-[#14241B] font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
        <Header
          user={null}
          activeView="roadmap"
          onNavigate={() => {}}
          onLogout={handleLogout}
          isDrawerOpen={false}
          setIsDrawerOpen={() => {}}
          masteredCount={0}
        />

        <Toast toast={toast} onClose={() => setToast(null)} />

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-10">
          <AuthPage
            authMode={authMode}
            setAuthMode={setAuthMode}
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            displayNameInput={displayNameInput}
            setDisplayNameInput={setDisplayNameInput}
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            authError={authError}
            isLoading={isLoading}
            onSubmit={handleLoginSubmit}
            onQuickPickSeedAccount={handleQuickPickSeedAccount}
          />
        </main>

        {/* Global Botanical Footer Bar (Stitch SCR-01) */}
        <footer className="w-full bg-white border-t border-[#D8E2D8] py-3.5 px-6 text-xs text-[#57534E] font-mono">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
              <span>Plumora Backend RL Engine v1.0.0 • SHA-256 Verified Checkpoints</span>
            </div>
            <div className="flex items-center gap-4 text-[#78716C] text-[11px]">
              <span>Idempotency Engine Active</span>
            </div>
          </div>
        </footer>
      </div>
    )
  }

  // ==========================================
  // 2. AUTHENTICATED APP (Stitch SCR-02..06 Multi-view Router)
  // ==========================================
  return (
    <div className="min-h-screen bg-[#F8FAF7] text-[#14241B] font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
      <Header
        user={user}
        activeView={activeView}
        onNavigate={setActiveView}
        onLogout={handleLogout}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        masteredCount={masteredCount}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      {conceptFetchError && (
        <div
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3 w-full"
          data-testid="concept-fetch-error-banner"
          role="alert"
        >
          <div className="bg-[#FEF2F2] border-2 border-[#EF4444] rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#991B1B]">
                  Không thể tải bài học & bài kiểm tra
                </h3>
                <p className="text-xs text-[#B91C1C] mt-0.5">
                  {conceptFetchError.message}. Vui lòng thử lại.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  handleOpenConcept(
                    conceptFetchError.slug,
                    conceptFetchError.targetScreen,
                  )
                }
                data-testid="retry-fetch-concept-btn"
                className="px-3.5 py-1.5 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Thử lại
              </button>
              <button
                type="button"
                onClick={() => setConceptFetchError(null)}
                className="px-2.5 py-1.5 text-xs text-[#7F1D1D] hover:bg-[#FEE2E2] rounded-lg transition-colors cursor-pointer"
              >
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace (Strictly 1 view rendered at a time) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeView === 'roadmap' ? (
          <RoadmapPage
            nodes={nodes}
            recommendation={recommendation}
            roadmapError={roadmapError}
            onRetryRoadmap={refreshRoadmapAndRecommendation}
            masteredCount={masteredCount}
            isLoading={isLoading}
            currentUsername={user.username}
            onSelectPreset={setPendingPreset}
            onOpenConcept={handleOpenConcept}
          />
        ) : null}

        {activeView === 'lesson' ? (
          <LessonPage
            currentConcept={currentConcept}
            lockedErrorInfo={lockedErrorInfo}
            onGoToQuiz={() => setActiveView('quiz')}
            onBackToRoadmap={() => setActiveView('roadmap')}
          />
        ) : null}

        {activeView === 'quiz' ? (
          <QuizPage
            currentConcept={currentConcept}
            submissionId={submissionId}
            selectedAnswers={selectedAnswers}
            onSelectAnswer={(qid, opt) =>
              setSelectedAnswers((prev) => ({ ...prev, [qid]: opt }))
            }
            onSubmit={handleQuizSubmit}
            isLoading={isLoading}
            quizError={quizError}
            attemptResult={attemptResult}
            onRetry={() => {
              setSelectedAnswers({})
              setAttemptResult(null)
              setSubmissionId(generateSubmissionId())
            }}
            onBackToRoadmap={() => setActiveView('roadmap')}
            onBackToLesson={() => setActiveView('lesson')}
          />
        ) : null}

        {activeView === 'locked' && lockedErrorInfo ? (
          <LockedAlert
            lockedErrorInfo={lockedErrorInfo}
            onBackToRoadmap={() => setActiveView('roadmap')}
          />
        ) : null}
      </main>

      {/* Preset Modal (SCR-05) */}
      <PresetModal
        pendingPreset={pendingPreset}
        onCancel={() => setPendingPreset(null)}
        onConfirm={handleConfirmApplyPreset}
      />

      {/* Attempt History Modal */}
      <AttemptHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Provenance Drawer (SCR-06) */}
      <ProvenanceDrawer
        isDrawerOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        recommendation={recommendation}
        nodes={nodes}
      />

      {/* Global Botanical Footer Bar */}
      <footer className="w-full bg-white border-t border-[#D8E2D8] py-3.5 px-6 text-xs text-[#57534E] font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
            <span>Plumora Backend RL Engine v1.0.0 • SHA-256 Verified Checkpoints</span>
          </div>
          <div className="flex items-center gap-4 text-[#78716C] text-[11px]">
            <span>Idempotency Engine Active</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
