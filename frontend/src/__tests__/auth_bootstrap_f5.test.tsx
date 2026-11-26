import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as api from '../api'
import { App } from '../App'
import type { LearnerUser } from '../types'

describe('REM-04 Auth Bootstrap Anti-FOUC on F5 & Orphan Cleanup', () => {
  it('holds auth-bootstrap-loader without flashing Login page on F5 until apiGetMe resolves', async () => {
    let resolveMe!: (u: LearnerUser | null) => void
    const mePromise = new Promise<LearnerUser | null>((r) => {
      resolveMe = r
    })
    const getMeSpy = vi.spyOn(api, 'apiGetMe').mockReturnValue(mePromise)
    const domainsSpy = vi.spyOn(api, 'apiGetDomains').mockResolvedValue({ domains: [] })

    window.history.pushState({}, '', '/domains')
    const { unmount } = render(<App />)

    // While apiGetMe is in flight on /domains (F5 reload), Login page MUST NOT flash!
    expect(screen.getByTestId('auth-bootstrap-loader')).toBeInTheDocument()
    expect(screen.queryByTestId('learner-auth-page')).toBeNull()

    resolveMe({
      id: 'u-f5',
      username: 'learner_f5',
      display_name: 'F5 Learner',
      role: 'learner',
      state_version: 1,
    })

    await waitFor(() => {
      expect(screen.getByTestId('scr09-multi-domain-hub')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('learner-auth-page')).toBeNull()

    unmount()
    getMeSpy.mockRestore()
    domainsSpy.mockRestore()
    window.history.pushState({}, '', '/login')
  })

  it('removes all 4 orphaned pre-v3 UI shell/auth files', () => {
    const modules = import.meta.glob(['../pages/*.tsx', '../shells/*.tsx'])
    const modulePaths = Object.keys(modules)
    for (const rel of [
      '../pages/AuthPage.tsx',
      '../shells/AdminShell.tsx',
      '../shells/ExpertShell.tsx',
      '../shells/LearnerV2Shell.tsx',
    ]) {
      expect(modulePaths).not.toContain(rel)
    }
    expect(modulePaths).toContain('../shells/LearnerAppShell.tsx')
    expect(modulePaths).toContain('../shells/BackOfficeAppShell.tsx')
  })

  it('clears user state and redirects to /login on logout even if network fetch rejects', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.includes('/api/v1/auth/logout')) {
        throw new TypeError('Failed to fetch')
      }
      return new Response(JSON.stringify({ domains: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    window.history.pushState({}, '', '/domains')
    const { unmount } = render(
      <App
        initialUser={{
          id: 'u-logout',
          username: 'learner_logout',
          display_name: 'Logout Learner',
          role: 'learner',
          state_version: 1,
        }}
      />,
    )

    const logoutBtns = await screen.findAllByRole('button', { name: /đăng xuất/i })
    fireEvent.click(logoutBtns[0])

    await waitFor(() => {
      expect(screen.getByTestId('learner-auth-page')).toBeInTheDocument()
    })

    unmount()
    fetchSpy.mockRestore()
  })
})
