import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../App'
import { parseRoute } from '../core/router'

const EMOJI_REGEX = /\p{Extended_Pictographic}/u

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api')>()
  return {
    ...actual,
    apiGetMe: vi.fn().mockResolvedValue(null),
  }
})

describe('Public Showcase Pages (PUB-01..PUB-04 — D-42)', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('parses all 4 public showcase routes without colliding with auth or back-office routes', () => {
    expect(parseRoute('/')).toMatchObject({ publicPage: 'home', isLoginPath: false })
    expect(parseRoute('/how-it-works')).toMatchObject({ publicPage: 'how_it_works' })
    expect(parseRoute('/curriculum')).toMatchObject({ publicPage: 'curriculum' })
    expect(parseRoute('/about')).toMatchObject({ publicPage: 'about' })
    expect(parseRoute('/login')).toMatchObject({ isLoginPath: true })
    expect(parseRoute('/login').publicPage).toBeUndefined()
    expect(parseRoute('/register')).toMatchObject({ isRegisterPath: true })
    expect(parseRoute('/register').publicPage).toBeUndefined()
    expect(parseRoute('/backoffice/login')).toMatchObject({
      portal: 'expert',
      isLoginPath: true,
    })
    expect(parseRoute('/backoffice/login').publicPage).toBeUndefined()
  })

  it('renders PUB-01 Home Page on / with zero emoji, zero demo credentials, and navigates to /login', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    const home = screen.getByTestId('pub01-home-page')
    expect(home).toBeInTheDocument()
    expect(EMOJI_REGEX.test(home.textContent || '')).toBe(false)
    expect(home.textContent).not.toContain('PlumoraDemo#2026')
    expect(home.textContent).not.toContain('learner_new')
    expect(home.textContent).toContain('GNN-PPO')

    // Click Header login button -> transitions to LearnerAuthPage
    fireEvent.click(screen.getByTestId('pub-nav-login-btn'))
    expect(screen.getByTestId('learner-auth-page')).toBeInTheDocument()

    // Click "Quay về Trang chủ" -> returns to PUB-01 Home Page
    fireEvent.click(screen.getByTestId('auth-back-home-btn'))
    expect(screen.getByTestId('pub01-home-page')).toBeInTheDocument()
  })

  it('navigates across PUB-02 (/how-it-works), PUB-03 (/curriculum), and PUB-04 (/about)', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    fireEvent.click(screen.getByTestId('pub-nav-how-it-works'))
    const howItWorks = screen.getByTestId('pub02-how-it-works-page')
    expect(howItWorks).toBeInTheDocument()
    expect(EMOJI_REGEX.test(howItWorks.textContent || '')).toBe(false)
    expect(howItWorks.textContent).toContain('Ebbinghaus')
    expect(howItWorks.textContent).toContain('Policy Guardrail')

    fireEvent.click(screen.getByTestId('pub-nav-curriculum'))
    const curriculum = screen.getByTestId('pub03-curriculum-page')
    expect(curriculum).toBeInTheDocument()
    expect(EMOJI_REGEX.test(curriculum.textContent || '')).toBe(false)
    // Interactive domain tab switching
    expect(curriculum.textContent).toContain('net-internet')
    fireEvent.click(screen.getByTestId('pub-curriculum-tab-frontend'))
    expect(curriculum.textContent).toContain('fe-dom-events')
    fireEvent.click(screen.getByTestId('pub-curriculum-tab-devops'))
    expect(curriculum.textContent).toContain('docker-containers')

    fireEvent.click(screen.getByTestId('pub-nav-about'))
    const about = screen.getByTestId('pub04-about-page')
    expect(about).toBeInTheDocument()
    expect(EMOJI_REGEX.test(about.textContent || '')).toBe(false)
    expect(about.textContent).toContain('API Gateway')
    expect(about.textContent).toContain('Microservices')
  })

  it('toggles mobile navigation menu cleanly', () => {
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(screen.queryByTestId('pub-mobile-menu')).toBeNull()
    fireEvent.click(screen.getByTestId('pub-mobile-menu-toggle'))
    expect(screen.getByTestId('pub-mobile-menu')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pub-mobile-menu-toggle'))
    expect(screen.queryByTestId('pub-mobile-menu')).toBeNull()
  })
})
