import { Loader2, Sprout } from 'lucide-react'
import { useEffect, useState } from 'react'
import { apiGetMe, apiLogin, apiLogout, apiRegister } from './api'
import { Toast } from './components/ui/Toast'
import { useRouter } from './hooks/useRouter'
import { BackOfficeLoginPage } from './pages/auth/BackOfficeLoginPage'
import { Forbidden403Page } from './pages/auth/Forbidden403Page'
import { LearnerAuthPage } from './pages/auth/LearnerAuthPage'
import { PublicAboutPage } from './pages/public/PublicAboutPage'
import { PublicCurriculumPage } from './pages/public/PublicCurriculumPage'
import { PublicHomePage } from './pages/public/PublicHomePage'
import { PublicHowItWorksPage } from './pages/public/PublicHowItWorksPage'
import { defaultPathForRole, loginPathForPortal } from './core/router'
import { BackOfficeAppShell } from './shells/BackOfficeAppShell'
import { LearnerAppShell } from './shells/LearnerAppShell'
import { PublicShowcaseShell } from './shells/PublicShowcaseShell'
import { defaultViewForRole } from './types'
import type { ActiveView, LearnerUser, ToastNotification, ToastType } from './types'
import type { BackOfficeView } from './types/expert'

interface AppProps {
  initialUser?: LearnerUser | null
  initialView?: ActiveView
}

function mapBackOfficeViewToActiveView(view: BackOfficeView): ActiveView {
  if (view === 'expert_cohort') return 'cohort_analytics'
  return view
}

export function App({ initialUser = null, initialView }: AppProps = {}) {
  const { route, navigate, pushPath } = useRouter()
  const [user, setUser] = useState<LearnerUser | null>(initialUser)
  const [isBootstrappingAuth, setIsBootstrappingAuth] = useState<boolean>(
    () => !initialUser && !route.isLoginPath && !route.isRegisterPath && !route.publicPage,
  )
  const [authMode, setAuthMode] = useState<'login' | 'register'>(
    route.isRegisterPath ? 'register' : 'login',
  )
  const [usernameInput, setUsernameInput] = useState('')
  const [displayNameInput, setDisplayNameInput] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<ToastNotification | null>(null)

  function showToast(message: string, type: ToastType = 'info'): void {
    setToast({ message, type })
  }

  useEffect(() => {
    if (initialUser) {
      setIsBootstrappingAuth(false)
      return
    }
    let mounted = true
    ;(async () => {
      try {
        const me = await apiGetMe()
        if (!mounted || !me) return
        setUser(me)
        const role = me.role ?? 'learner'
        if (route.isLoginPath || route.isRegisterPath || window.location.pathname === '/') {
          pushPath(defaultPathForRole(role))
        }
      } finally {
        if (mounted) {
          setIsBootstrappingAuth(false)
        }
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser])

  const isBackOfficeRoute = route.portal === 'admin' || route.portal === 'expert'

  function handlePublicNavigate(path: string): void {
    if (path === '/register') {
      setAuthMode('register')
    } else if (path === '/login') {
      setAuthMode('login')
    }
    pushPath(path)
  }

  function renderPublicShowcase(currentUser: LearnerUser | null) {
    const activePublic = route.publicPage ?? 'home'
    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <PublicShowcaseShell
          activePage={activePublic}
          user={currentUser}
          onNavigatePath={handlePublicNavigate}
        >
          {activePublic === 'home' && (
            <PublicHomePage onNavigatePath={handlePublicNavigate} />
          )}
          {activePublic === 'how_it_works' && (
            <PublicHowItWorksPage onNavigatePath={handlePublicNavigate} />
          )}
          {activePublic === 'curriculum' && (
            <PublicCurriculumPage onNavigatePath={handlePublicNavigate} />
          )}
          {activePublic === 'about' && (
            <PublicAboutPage onNavigatePath={handlePublicNavigate} />
          )}
        </PublicShowcaseShell>
      </>
    )
  }

  async function handleAuthSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setAuthError(null)
    setIsLoading(true)
    try {
      const authRes =
        authMode === 'login' || isBackOfficeRoute
          ? await apiLogin(
              usernameInput.trim(),
              passwordInput,
              isBackOfficeRoute ? route.portal : 'learner',
            )
          : await apiRegister(
              usernameInput.trim(),
              displayNameInput.trim() || usernameInput.trim(),
              passwordInput,
            )
      const role = authRes.user.role ?? 'learner'
      setUser(authRes.user)
      pushPath(defaultPathForRole(role))
      showToast(`Chào mừng ${authRes.user.display_name}!`, 'success')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Xác thực thất bại')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogout(): Promise<void> {
    const wasBackOffice = isBackOfficeRoute || user?.role === 'admin' || user?.role === 'expert'
    await apiLogout()
    setUser(null)
    setUsernameInput('')
    setDisplayNameInput('')
    setPasswordInput('')
    setAuthError(null)
    setAuthMode('login')
    pushPath(wasBackOffice ? loginPathForPortal('admin') : loginPathForPortal('learner'))
    showToast('Đã đăng xuất an toàn.', 'info')
  }

  // 0. SESSION BOOTSTRAP (Anti-FOUC on F5 reload for protected routes)
  if (isBootstrappingAuth && !user) {
    return (
      <div
        data-testid="auth-bootstrap-loader"
        role="status"
        aria-live="polite"
        className="min-h-screen bg-background text-on-surface font-sans antialiased flex items-center justify-center px-4"
      >
        <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border border-outline-variant/60 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Sprout className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />
            <span>Đang khôi phục phiên học tập...</span>
          </div>
        </div>
      </div>
    )
  }

  // 1. UNAUTHENTICATED: Public Showcase Suite + Strict Dual-Portal Login Separation
  if (!user) {
    if (route.publicPage) {
      return renderPublicShowcase(null)
    }
    if (isBackOfficeRoute) {
      return (
        <>
          <Toast toast={toast} onClose={() => setToast(null)} />
          <BackOfficeLoginPage
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            passwordInput={passwordInput}
            setPasswordInput={setPasswordInput}
            authError={authError}
            isLoading={isLoading}
            onSubmit={handleAuthSubmit}
            portalHint={route.portal === 'expert' ? 'expert' : 'admin'}
            onBackHome={() => handlePublicNavigate('/')}
          />
        </>
      )
    }

    return (
      <div className="min-h-screen bg-background text-on-surface font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <div className="flex-1 flex items-center justify-center px-4 py-6">
          <LearnerAuthPage
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
            onSubmit={handleAuthSubmit}
            onBackHome={() => handlePublicNavigate('/')}
          />
        </div>
        <footer className="w-full bg-white border-t border-outline-variant/50 py-3.5 px-6 text-xs text-outline">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-semibold text-on-surface">
              Plumora — Nền tảng Học tập Thích ứng Cá nhân hóa
            </span>
            <span className="text-[11px] text-on-surface-variant">
              Lộ trình Chuyên môn • Đánh giá 5 Tầng • Thực hành Trực tiếp
            </span>
          </div>
        </footer>
      </div>
    )
  }

  // 1b. AUTHENTICATED ON SECONDARY PUBLIC SHOWCASE PAGES (/how-it-works, /curriculum, /about)
  if (route.publicPage && route.publicPage !== 'home') {
    return renderPublicShowcase(user)
  }

  const role = user.role ?? 'learner'
  const effectiveView = initialView ?? route.view

  // 2. AUTHENTICATED ON BACK-OFFICE ROUTE
  if (isBackOfficeRoute) {
    const isForbidden =
      role === 'learner' || (route.portal === 'admin' && role !== 'admin')

    if (isForbidden) {
      return (
        <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4">
          <Forbidden403Page
            userRole={role}
            attemptedPortal={route.portal}
            onReturnToPortal={() => navigate(defaultViewForRole(role))}
          />
        </div>
      )
    }

    return (
      <>
        <Toast toast={toast} onClose={() => setToast(null)} />
        <BackOfficeAppShell
          user={user}
          activeView={effectiveView}
          initialDomainSlug={route.domainSlug}
          initialConceptSlug={route.conceptSlug}
          onNavigate={(boView, params) =>
            navigate(mapBackOfficeViewToActiveView(boView), params)
          }
          onLogout={handleLogout}
        />
      </>
    )
  }

  // 3. AUTHENTICATED ON WEB CLIENT ROUTE
  if (role === 'admin' || role === 'expert') {
    return (
      <div className="min-h-screen bg-background text-on-surface flex items-center justify-center px-4">
        <Forbidden403Page
          userRole={role}
          attemptedPortal="learner"
          onReturnToPortal={() => navigate(defaultViewForRole(role))}
        />
      </div>
    )
  }

  return (
    <>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <LearnerAppShell
        user={user}
        activeView={effectiveView}
        domainSlug={route.domainSlug}
        conceptSlug={route.conceptSlug}
        sessionMode={route.sessionMode}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
    </>
  )
}

export default App
