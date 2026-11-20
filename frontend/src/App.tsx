import { useCallback, useEffect, useState } from 'react'
import { apiGetMe, apiLogout, apiLogin, apiRegister } from './api'
import { Header } from './components/common/Header'
import { Toast } from './components/common/Toast'
import { AuthPage } from './pages/AuthPage'
import { Forbidden403Page } from './pages/Forbidden403Page'
import {
  defaultPathForRole,
  loginPathForPortal,
  parseRoute,
  pathForView,
} from './router'
import { AdminShell } from './shells/AdminShell'
import { ExpertShell } from './shells/ExpertShell'
import { LearnerV2Shell } from './shells/LearnerV2Shell'
import { defaultViewForRole } from './types'
import type { ActiveView, LearnerUser, PortalKind, ToastNotification, ToastType } from './types'

interface AppProps {
  initialUser?: LearnerUser | null
  initialView?: ActiveView
}

function getInitialPathname(): string {
  if (typeof window === 'undefined') return '/'
  return window.location.pathname || '/'
}

export function App({ initialUser = null, initialView }: AppProps = {}) {
  const initialParsed = parseRoute(getInitialPathname())
  const [user, setUser] = useState<LearnerUser | null>(initialUser)
  const [portal, setPortal] = useState<PortalKind>(initialParsed.portal)
  const [activeView, setActiveView] = useState<ActiveView>(
    initialView ?? (initialUser ? defaultViewForRole(initialUser.role) : initialParsed.view),
  )
  const [routeDomainSlug, setRouteDomainSlug] = useState<string | undefined>(initialParsed.domainSlug)
  const [routeConceptSlug, setRouteConceptSlug] = useState<string | undefined>(initialParsed.conceptSlug)

  const [authMode, setAuthMode] = useState<'login' | 'register'>(
    initialParsed.isRegisterPath ? 'register' : 'login',
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

  const pushPath = useCallback((nextPath: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath)
    }
  }, [])

  const navigateToView = useCallback(
    (view: ActiveView, params?: { domainSlug?: string; conceptSlug?: string }) => {
      setActiveView(view)
      if (params?.domainSlug) setRouteDomainSlug(params.domainSlug)
      if (params?.conceptSlug) setRouteConceptSlug(params.conceptSlug)
      const nextPath = pathForView(view, {
        domainSlug: params?.domainSlug ?? routeDomainSlug,
        conceptSlug: params?.conceptSlug ?? routeConceptSlug,
      })
      const parsed = parseRoute(nextPath)
      setPortal(parsed.portal)
      pushPath(nextPath)
    },
    [pushPath, routeConceptSlug, routeDomainSlug],
  )

  const handleSwitchPortal = useCallback(
    (nextPortal: PortalKind) => {
      setPortal(nextPortal)
      setAuthError(null)
      if (nextPortal !== 'learner') {
        setAuthMode('login')
      }
      pushPath(loginPathForPortal(nextPortal))
    },
    [pushPath],
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onPopState = () => {
      const parsed = parseRoute(window.location.pathname)
      setPortal(parsed.portal)
      setActiveView(parsed.view)
      setRouteDomainSlug(parsed.domainSlug)
      setRouteConceptSlug(parsed.conceptSlug)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const me = await apiGetMe()
      if (mounted && me) {
        setUser(me)
        if (!initialView) {
          const parsed = parseRoute(getInitialPathname())
          const role = me.role ?? 'learner'
          if (parsed.isLoginPath || parsed.isRegisterPath || getInitialPathname() === '/') {
            const targetView = defaultViewForRole(role)
            setActiveView(targetView)
            setPortal(role)
            pushPath(defaultPathForRole(role))
          } else {
            setPortal(parsed.portal)
            setActiveView(parsed.view)
            setRouteDomainSlug(parsed.domainSlug)
            setRouteConceptSlug(parsed.conceptSlug)
          }
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [initialView, pushPath])

  async function handleAuthSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setAuthError(null)
    setIsLoading(true)
    try {
      const authRes =
        authMode === 'login' || portal !== 'learner'
          ? await apiLogin(usernameInput.trim(), passwordInput, portal)
          : await apiRegister(
              usernameInput.trim(),
              displayNameInput.trim() || usernameInput.trim(),
              passwordInput,
            )
      const role = authRes.user.role ?? 'learner'
      setUser(authRes.user)
      setPortal(role)
      const targetView = defaultViewForRole(role)
      setActiveView(targetView)
      pushPath(defaultPathForRole(role))
      showToast(`Chào mừng ${authRes.user.display_name}!`, 'success')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Xác thực thất bại')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogout(): Promise<void> {
    const currentPortal = portal
    await apiLogout()
    setUser(null)
    setActiveView('domains')
    setUsernameInput('')
    setDisplayNameInput('')
    setPasswordInput('')
    setAuthError(null)
    setAuthMode('login')
    pushPath(currentPortal === 'learner' ? '/' : loginPathForPortal(currentPortal))
    showToast('Đã đăng xuất an toàn.', 'info')
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAF7] text-[#14241B] font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
        <Header
          user={null}
          portal={portal}
          activeView={activeView}
          onNavigate={navigateToView}
          onLogout={handleLogout}
        />

        <Toast toast={toast} onClose={() => setToast(null)} />

        <AuthPage
          portal={portal}
          onSwitchPortal={handleSwitchPortal}
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

        <footer className="w-full bg-white border-t border-[#D8E2D8] py-3 px-6 text-xs text-[#57534E] font-mono">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Plumora Adaptive Learning Platform v2.0.0</span>
            <span>Xác thực Bảo mật Phiên HTTP-Only Cookie</span>
          </div>
        </footer>
      </div>
    )
  }

  const role = user.role ?? 'learner'
  const isForbidden =
    (portal === 'admin' && role !== 'admin') ||
    (portal === 'expert' && role !== 'expert' && role !== 'admin') ||
    (portal === 'learner' && role !== 'learner')

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-[#14241B] font-sans antialiased flex flex-col justify-between overflow-x-hidden w-full">
      <Header
        user={user}
        portal={role}
        activeView={activeView}
        onNavigate={navigateToView}
        onLogout={handleLogout}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isForbidden ? (
          <Forbidden403Page
            userRole={role}
            attemptedPortal={portal}
            onReturnToPortal={() => navigateToView(defaultViewForRole(role))}
          />
        ) : (
          <>
            <LearnerV2Shell
              activeView={activeView}
              routeDomainSlug={routeDomainSlug}
              routeConceptSlug={routeConceptSlug}
              onNavigate={navigateToView}
            />
            <ExpertShell activeView={activeView} userRole={role} onNavigate={navigateToView} />
            <AdminShell activeView={activeView} userRole={role} onNavigate={navigateToView} />
          </>
        )}
      </main>

      <footer className="w-full bg-white border-t border-[#D8E2D8] py-3.5 px-6 text-xs text-[#57534E] font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#15803D]"></span>
            <span>Plumora Adaptive Learning v2.0.0 • GNN-PPO Verified Checkpoints</span>
          </div>
          <div className="flex items-center gap-4 text-[#78716C] text-[11px]">
            <span>5-Depth Assessment &amp; Ebbinghaus Memory Active</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
