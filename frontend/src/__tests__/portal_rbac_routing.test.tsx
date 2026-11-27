import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { parseRoute } from '../core/router'
import { BackOfficeLoginPage } from '../pages/auth/BackOfficeLoginPage'
import { LearnerAuthPage } from '../pages/auth/LearnerAuthPage'
import { BackOfficeAppShell } from '../shells/BackOfficeAppShell'

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

  it('separates BackOfficeAppShell sidebar navigation strictly per staff role', () => {
    const noop = async () => {}
    const { rerender } = render(
      <BackOfficeAppShell
        user={{ id: '2', username: 'a1', display_name: 'A1', role: 'admin', state_version: 1 }}
        activeView="admin_online_rl"
        onNavigate={() => {}}
        onLogout={noop}
      />,
    )
    expect(screen.getByTestId('bo-nav-online-rl')).toBeInTheDocument()
    expect(screen.getByTestId('bo-nav-registry')).toBeInTheDocument()
    expect(screen.getByTestId('bo-nav-health')).toBeInTheDocument()

    rerender(
      <BackOfficeAppShell
        user={{ id: '3', username: 'e1', display_name: 'E1', role: 'expert', state_version: 1 }}
        activeView="expert_domains"
        onNavigate={() => {}}
        onLogout={noop}
      />,
    )
    expect(screen.getByTestId('bo-nav-domains')).toBeInTheDocument()
    expect(screen.getByTestId('bo-nav-questions')).toBeInTheDocument()
    expect(screen.getByTestId('bo-nav-code')).toBeInTheDocument()
    expect(screen.queryByTestId('bo-nav-online-rl')).toBeNull()
    expect(screen.queryByTestId('bo-nav-registry')).toBeNull()
  })
})
