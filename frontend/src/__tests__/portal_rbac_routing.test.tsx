import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { Header } from '../components/common/Header'
import { BackOfficeLoginPage } from '../pages/BackOfficeLoginPage'
import { LearnerAuthPage } from '../pages/LearnerAuthPage'
import { parseRoute } from '../router'

describe('Portal Separation, URL Routing & RBAC Enforcement', () => {
  it('parses canonical learner and back-office routes accurately', () => {
    expect(parseRoute('/backoffice/login')).toMatchObject({ portal: 'expert', isLoginPath: true })
    expect(parseRoute('/admin/login')).toMatchObject({ portal: 'admin', isLoginPath: true })
    expect(parseRoute('/backoffice/mlops/model-registry')).toMatchObject({
      portal: 'admin',
      view: 'admin_registry',
    })
    expect(parseRoute('/backoffice/studio/questions')).toMatchObject({
      portal: 'expert',
      view: 'expert_questions',
    })
    expect(parseRoute('/backoffice/cohort')).toMatchObject({
      portal: 'expert',
      view: 'cohort_analytics',
    })
    expect(parseRoute('/domains/frontend/roadmap')).toMatchObject({
      portal: 'learner',
      view: 'domain_roadmap',
      domainSlug: 'frontend',
    })
    expect(parseRoute('/domains/frontend/concepts/fe-dom-events/depth-probe', '?mode=spaced_review')).toMatchObject({
      portal: 'learner',
      view: 'depth_probe',
      domainSlug: 'frontend',
      conceptSlug: 'fe-dom-events',
      sessionMode: 'spaced_review',
    })
  })

  it('strictly separates LearnerAuthPage and BackOfficeLoginPage with zero demo buttons', () => {
    const noop = async () => {}
    const { unmount } = render(
      <BackOfficeLoginPage
        usernameInput=""
        setUsernameInput={() => {}}
        passwordInput=""
        setPasswordInput={() => {}}
        authError={null}
        isLoading={false}
        onSubmit={noop}
      />,
    )
    expect(screen.queryByTestId('tab-register-btn')).toBeNull()
    expect(screen.getByTestId('staff-portal-notice')).toBeInTheDocument()
    expect(screen.queryByText(/admin_demo/i)).toBeNull()
    unmount()

    render(
      <LearnerAuthPage
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
    expect(screen.queryByText(/learner_new/i)).toBeNull()
  })

  it('renders 403 Forbidden page if Learner navigates to /backoffice/* or /admin/*', () => {
    window.history.pushState({}, '', '/backoffice/mlops/online-rl')
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

    window.history.pushState({}, '', '/backoffice/studio/domains')
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
