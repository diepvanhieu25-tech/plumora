import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { Header } from '../components/common/Header'
import { AuthPage } from '../pages/AuthPage'
import { parseRoute } from '../router'

describe('Portal Separation, URL Routing & RBAC Enforcement', () => {
  it('parses learner, expert, and admin portal routes accurately', () => {
    expect(parseRoute('/admin/login')).toMatchObject({ portal: 'admin', isLoginPath: true })
    expect(parseRoute('/admin/model-registry')).toMatchObject({
      portal: 'admin',
      view: 'admin_registry',
    })
    expect(parseRoute('/expert/login')).toMatchObject({ portal: 'expert', isLoginPath: true })
    expect(parseRoute('/expert/questions')).toMatchObject({
      portal: 'expert',
      view: 'expert_questions',
    })
    expect(parseRoute('/domains/frontend/roadmap')).toMatchObject({
      portal: 'learner',
      view: 'domain_roadmap',
      domainSlug: 'frontend',
    })
  })

  it('hides public registration tab on /admin/login and /expert/login', () => {
    const noop = async () => {}
    const { rerender } = render(
      <AuthPage
        portal="admin"
        authMode="login"
        setAuthMode={() => {}}
        usernameInput=""
        setUsernameInput={() => {}}
        displayNameInput=""
        setDisplayNameInput={() => {}}
        passwordInput=""
        setPasswordInput={() => {}}
        authError={null}
        isLoading={false}
        onSubmit={noop}
      />,
    )
    expect(screen.queryByTestId('tab-register-btn')).toBeNull()
    expect(screen.getByTestId('staff-portal-notice')).toBeInTheDocument()

    rerender(
      <AuthPage
        portal="learner"
        authMode="login"
        setAuthMode={() => {}}
        usernameInput=""
        setUsernameInput={() => {}}
        displayNameInput=""
        setDisplayNameInput={() => {}}
        passwordInput=""
        setPasswordInput={() => {}}
        authError={null}
        isLoading={false}
        onSubmit={noop}
      />,
    )
    expect(screen.getByTestId('tab-register-btn')).toBeInTheDocument()
  })

  it('renders 403 Forbidden page if Learner navigates to /admin/* or /expert/*', () => {
    window.history.pushState({}, '', '/admin/online-rl')
    const { unmount } = render(
      <App
        initialUser={{
          id: 'u1',
          username: 'learner_new',
          display_name: 'Learner New',
          role: 'learner',
          state_version: 1,
        }}
      />,
    )
    expect(screen.getByTestId('forbidden-403-page')).toBeInTheDocument()
    unmount()

    window.history.pushState({}, '', '/expert/domains')
    render(
      <App
        initialUser={{
          id: 'u1',
          username: 'learner_new',
          display_name: 'Learner New',
          role: 'learner',
          state_version: 1,
        }}
      />,
    )
    expect(screen.getByTestId('forbidden-403-page')).toBeInTheDocument()
    window.history.pushState({}, '', '/')
  })

  it('separates Header navigation strictly per role', () => {
    const noop = async () => {}
    const { rerender } = render(
      <Header
        user={{ id: '1', username: 'l1', display_name: 'L1', role: 'learner', state_version: 1 }}
        activeView="domains"
        onNavigate={() => {}}
        onLogout={noop}
      />,
    )
    expect(screen.getByTestId('nav-multi-domain-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('nav-admin-online-rl-btn')).toBeNull()
    expect(screen.queryByTestId('nav-expert-domains-btn')).toBeNull()

    rerender(
      <Header
        user={{ id: '2', username: 'a1', display_name: 'A1', role: 'admin', state_version: 1 }}
        activeView="admin_online_rl"
        onNavigate={() => {}}
        onLogout={noop}
      />,
    )
    expect(screen.queryByTestId('nav-multi-domain-btn')).toBeNull()
    expect(screen.getByTestId('nav-admin-online-rl-btn')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-registry-btn')).toBeInTheDocument()
    expect(screen.getByTestId('nav-admin-health-btn')).toBeInTheDocument()

    rerender(
      <Header
        user={{ id: '3', username: 'e1', display_name: 'E1', role: 'expert', state_version: 1 }}
        activeView="expert_domains"
        onNavigate={() => {}}
        onLogout={noop}
      />,
    )
    expect(screen.queryByTestId('nav-multi-domain-btn')).toBeNull()
    expect(screen.getByTestId('nav-expert-domains-btn')).toBeInTheDocument()
    expect(screen.getByTestId('nav-expert-questions-btn')).toBeInTheDocument()
    expect(screen.getByTestId('nav-expert-code-btn')).toBeInTheDocument()
  })
})
