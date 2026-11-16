import { useEffect, useMemo, useState } from 'react'
import {
  FALLBACK_CONCEPTS_DAG,
  FALLBACK_CONCEPT_DETAIL,
  FALLBACK_RECOMMENDATION,
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
import { Header, type ActiveScreen } from './components/common/Header'
import { Toast } from './components/common/Toast'
import { ProvenanceDrawer } from './components/drawer/ProvenanceDrawer'
import { PresetModal } from './components/modal/PresetModal'
import { AuthPage } from './pages/AuthPage'
import { LessonPage } from './pages/LessonPage'
import { QuizPage } from './pages/QuizPage'
import { RoadmapPage } from './pages/RoadmapPage'
import type {
  AttemptResult,
  ConceptDetail,
  DagNode,
  LearnerUser,
  RecommendationPayload,
} from './types'

function generateSubmissionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-000000009999'
}

export function App() {
  const [user, setUser] = useState<LearnerUser | null>(null)
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('scr01_auth')
  const [nodes, setNodes] = useState<DagNode[]>(FALLBACK_CONCEPTS_DAG)
  const [recommendation, setRecommendation] =
    useState<RecommendationPayload>(FALLBACK_RECOMMENDATION)
  const [currentConcept, setCurrentConcept] =
    useState<ConceptDetail>(FALLBACK_CONCEPT_DETAIL)
  const [lockedErrorInfo, setLockedErrorInfo] = useState<{
    slug: string
    message: string
    missingPrerequisites: string[]
  } | null>(null)

  // Auth form state (SCR-01)
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [usernameInput, setUsernameInput] = useState('learner_foundation')
  const [displayNameInput, setDisplayNameInput] = useState('Học viên Thực nghiệm')
  const [passwordInput, setPasswordInput] = useState('PlumoraDemo#2026')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Preset Modal (SCR-05) & Provenance Drawer (SCR-06)
  const [pendingPreset, setPendingPreset] = useState<{
    key: string
    title: string
  } | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

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
    try {
      const [rm, rec] = await Promise.all([
        apiGetRoadmap(),
        apiGetRecommendation(),
      ])
      setNodes(rm.nodes)
      setRecommendation(rec)
    } catch {
      // Keep fallback data in unit test environments without live HTTP server
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const me = await apiGetMe()
      if (mounted && me) {
        setUser(me)
        setActiveScreen('scr02_roadmap')
        await refreshRoadmapAndRecommendation()
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function handleLoginSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setAuthError(null)
    setIsLoading(true)
    try {
      if (authMode === 'login') {
        const res = await apiLogin(usernameInput.trim(), passwordInput)
        setUser(res.user)
        setToastMessage(`Đã đăng nhập tài khoản ${res.user.username}`)
      } else {
        const res = await apiRegister(
          usernameInput.trim(),
          displayNameInput.trim(),
          passwordInput,
        )
        setUser(res.user)
        setToastMessage(`Đã đăng ký và đăng nhập ${res.user.username}`)
      }
      await refreshRoadmapAndRecommendation()
      setActiveScreen('scr02_roadmap')
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
      setToastMessage(`Đã đăng nhập tài khoản mẫu ${res.user.username}`)
      await refreshRoadmapAndRecommendation()
      setActiveScreen('scr02_roadmap')
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Đăng nhập tài khoản mẫu thất bại',
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
      setActiveScreen('scr01_auth')
      setToastMessage('Đã đăng xuất khỏi hệ thống')
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
    try {
      const result = await apiGetConceptDetail(slug)
      if (!result.ok) {
        if (result.locked) {
          setLockedErrorInfo({
            slug,
            message: result.message,
            missingPrerequisites: result.missingPrerequisites,
          })
          setActiveScreen('scr08_locked')
        } else {
          setToastMessage(result.message)
        }
        return
      }
      setCurrentConcept(result.data)
      setLockedErrorInfo(null)
      setActiveScreen(targetScreen)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleConfirmApplyPreset(): Promise<void> {
    if (!pendingPreset) return
    setIsLoading(true)
    try {
      await apiApplyPreset(pendingPreset.key)
      setToastMessage(`Đã áp dụng thành công hồ sơ ${pendingPreset.title}`)
      await refreshRoadmapAndRecommendation()
      setActiveScreen('scr02_roadmap')
    } catch (err) {
      setToastMessage(
        err instanceof Error ? err.message : 'Không thể áp dụng hồ sơ mẫu',
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
      await refreshRoadmapAndRecommendation()
    } catch (err) {
      setQuizError(
        err instanceof Error ? err.message : 'Lỗi khi gửi kết quả làm bài',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F6F8F5] text-[#14241B] font-sans antialiased">
      <Header
        user={user}
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        onLogout={handleLogout}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        masteredCount={masteredCount}
      />

      <Toast
        message={toastMessage}
        onClose={() => setToastMessage(null)}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* SCR-01: Authentication */}
        <div className={activeScreen === 'scr01_auth' ? 'block' : 'hidden'}>
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
        </div>

        {/* SCR-02 & SCR-07: Roadmap DAG & Recommendation */}
        <div
          className={
            activeScreen === 'scr02_roadmap' || activeScreen === 'scr08_locked'
              ? 'block'
              : 'hidden'
          }
        >
          <RoadmapPage
            nodes={nodes}
            recommendation={recommendation}
            masteredCount={masteredCount}
            isLoading={isLoading}
            onSelectPreset={setPendingPreset}
            onOpenConcept={handleOpenConcept}
          />
          {activeScreen === 'scr08_locked' ? (
            <div className="mt-4">
              <LessonPage
                currentConcept={currentConcept}
                lockedErrorInfo={lockedErrorInfo}
                onGoToQuiz={() => setActiveScreen('scr04_quiz')}
                onBackToRoadmap={() => setActiveScreen('scr02_roadmap')}
              />
            </div>
          ) : null}
        </div>

        {/* SCR-03: Lesson Reader & SCR-04: MCQ Quiz */}
        <div
          className={
            activeScreen === 'scr03_lesson' || activeScreen === 'scr04_quiz'
              ? 'block'
              : 'hidden'
          }
        >
          <LessonPage
            currentConcept={currentConcept}
            lockedErrorInfo={null}
            onGoToQuiz={() => setActiveScreen('scr04_quiz')}
            onBackToRoadmap={() => setActiveScreen('scr02_roadmap')}
          />
          <div className="mt-6">
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
              onBackToRoadmap={() => setActiveScreen('scr02_roadmap')}
            />
          </div>
        </div>
      </div>

      <PresetModal
        pendingPreset={pendingPreset}
        onCancel={() => setPendingPreset(null)}
        onConfirm={handleConfirmApplyPreset}
      />

      <ProvenanceDrawer
        isDrawerOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        recommendation={recommendation}
        nodes={nodes}
      />
    </main>
  )
}

export default App
