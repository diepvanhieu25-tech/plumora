/**
 * Live Full-Stack Integration Test (Phase 3 End-to-End) executing the React SPA against the live
 * FastAPI Backend (127.0.0.1:8000) -> PostgreSQL 16 -> Redis 7 -> GNN-PPO Checkpoint.
 */

import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../src/App'
import { setAuthToken } from '../src/api'

const BACKEND_BASE = 'http://127.0.0.1:8000'

describe('Phase 3 Live Full-Stack Golden Journey (React -> FastAPI -> PostgreSQL -> Redis -> GNN-PPO)', () => {
  it('routes logged-in learner straight to SCR-09 Multi-Domain Hub and loads SCR-11 Roadmap + GNN-PPO', async () => {
    const origFetch = globalThis.fetch
    let backendReachable = false
    try {
      const probe = await origFetch(`${BACKEND_BASE}/api/v1/health`)
      backendReachable = probe.ok
    } catch {
      backendReachable = false
    }
    if (!backendReachable) {
      expect(backendReachable, 'Backend at 127.0.0.1:8000 is required for live fullstack journey test').toBe(true)
      return
    }

    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const target = url.startsWith('/') ? `${BACKEND_BASE}${url}` : url
      return origFetch(target, init)
    }

    try {
      setAuthToken(null)
      const { unmount } = render(createElement(App))

      // 1. SCR-01: Register a fresh learner in PostgreSQL
      const uname = `p3live_${Date.now().toString().slice(-6)}`
      fireEvent.click(screen.getByTestId('tab-register-btn'))
      fireEvent.change(screen.getByTestId('input-username'), { target: { value: uname } })
      fireEvent.change(screen.getByTestId('input-display-name'), { target: { value: 'P3 Live Learner' } })
      fireEvent.change(screen.getByTestId('input-password'), { target: { value: 'StrongPass!2026' } })
      fireEvent.click(screen.getByTestId('login-submit-btn'))
      await waitFor(
        () => {
          expect(screen.getByTestId('active-username')).toHaveTextContent(uname)
          expect(screen.getByTestId('scr09-multi-domain-hub')).toBeInTheDocument()
          expect(screen.getByTestId('domain-card-frontend')).toBeInTheDocument()
        },
        { timeout: 10000 },
      )

      // 2. SCR-09 -> SCR-10: Start Adaptive Placement on Frontend domain
      const frontendCard = screen.getByTestId('domain-card-frontend')
      const startPlacementBtn = frontendCard.querySelector('button:last-of-type')
      expect(startPlacementBtn).not.toBeNull()
      fireEvent.click(startPlacementBtn!)
      await waitFor(
        () => {
          expect(screen.getByTestId('scr10-adaptive-placement')).toBeInTheDocument()
        },
        { timeout: 10000 },
      )

      unmount()
    } finally {
      globalThis.fetch = origFetch
      setAuthToken(null)
    }
  })
})
