import { useEffect, useState } from 'react'
import { apiGetMe, apiLogin, apiLogout, apiRegister } from './api'
import { Toast } from './components/common/Toast'
import { useRouter } from './hooks/useRouter'
import { BackOfficeLoginPage } from './pages/BackOfficeLoginPage'
import { Forbidden403Page } from './pages/Forbidden403Page'
import { LearnerAuthPage } from './pages/LearnerAuthPage'
import { defaultPathForRole, loginPathForPortal } from './router'
import { BackOfficeAppShell } from './shells/BackOfficeAppShell'
import { LearnerAppShell } from './shells/LearnerAppShell'
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
    if (initialUser) return
    let mounted = true
    ;(async () => {
      const me = await apiGetMe()
      if (!mounted || !me) return
      setUser(me)
      const role = me.role ?? 'learner'
      if (route.isLoginPath || route.isRegisterPath || window.location.pathname === '/') {
        pushPath(defaultPathForRole(role))
      }
    })()
    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUser])

  const isBackOfficeRoute = route.portal === 'admin' || route.portal === 'expert'

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

  // 1. UNAUTHENTICATED: Strict Dual-Portal Login Separation
  if (!user) {
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
