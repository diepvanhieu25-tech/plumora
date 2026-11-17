/**
 * Live Full-Stack Integration Test (PL-E2E-01) executing the React SPA against the live
 * Vite Dev Server (127.0.0.1:5173) -> FastAPI Backend (127.0.0.1:8000) -> PostgreSQL 16 -> Redis 7 -> DQN Checkpoint.
 */

import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../src/App'
import { setAuthToken } from '../src/api'

const BACKEND_BASE = 'http://127.0.0.1:8000'

describe('PL-E2E-01 Live Full-Stack Golden Journey (React -> FastAPI -> PostgreSQL -> Redis -> DQN)', () => {
  it('executes complete Golden Journey against live FastAPI, PostgreSQL 16, Redis 7, and DQN checkpoint', async () => {
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
    // Route relative /api/... fetches from jsdom to the live FastAPI server on 127.0.0.1:8000
    globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const target = url.startsWith('/') ? `${BACKEND_BASE}${url}` : url
      return origFetch(target, init)
    }

    try {
      setAuthToken(null)
      const { unmount } = render(createElement(App))

      // 1. SCR-01: Login as real seeded learner_foundation in PostgreSQL
      fireEvent.click(screen.getByTestId('seed-login-learner_foundation'))
      await waitFor(
        () => {
          expect(screen.getByTestId('active-username')).toHaveTextContent('learner_foundation')
          expect(screen.getByTestId('preset-btn-foundation_ready')).not.toBeDisabled()
        },
        { timeout: 5000 },
      )

      // 2. SCR-05: Reset learner_foundation to clean 'foundation_ready' (4/12 mastered) via live ACID tx
      fireEvent.click(screen.getByTestId('preset-btn-foundation_ready'))
      await waitFor(
        () => {
          expect(screen.getByTestId('confirm-preset-btn')).toBeInTheDocument()
        },
        { timeout: 5000 },
      )
      fireEvent.click(screen.getByTestId('confirm-preset-btn'))
      await waitFor(
        () => {
          expect(screen.queryByTestId('scr05-preset-modal')).not.toBeInTheDocument()
          expect(screen.getByTestId('global-mastery-counter')).toHaveTextContent(
            'Đã thông thạo: 4 / 12 khái niệm (33%)',
          )
        },
        { timeout: 5000 },
      )

      // 3. SCR-02: Verify live DQN checkpoint recommends an eligible concept (e.g., db-transactions)
      const banner = screen.getByTestId('ai-recommendation-banner')
      expect(banner).toHaveTextContent(/Học tăng cường DQN|DQN POLICY/i)
      expect(banner).toHaveTextContent(/e464fa638cee/i)

      // 4. SCR-03: Open /concepts/db-transactions to fetch real Markdown lesson & 4 MCQ questions from PostgreSQL
      fireEvent.click(screen.getByTestId('open-lesson-db-transactions'))
      await waitFor(
        () => {
          expect(screen.getByTestId('lesson-markdown-body')).toHaveTextContent(/Atomicity/i)
        },
        { timeout: 8000 },
      )

      // Transition from SCR-03 Lesson to SCR-04 Quiz
      fireEvent.click(screen.getByTestId('start-quiz-btn'))

      // 5. SCR-04: Select 3/4 correct answers (75% pass boundary) and submit to live PostgreSQL + Redis
      fireEvent.click(screen.getByTestId('quiz-q1-opt-B'))
      fireEvent.click(screen.getByTestId('quiz-q2-opt-D'))
      fireEvent.click(screen.getByTestId('quiz-q3-opt-A'))
      fireEvent.click(screen.getByTestId('quiz-q4-opt-B'))
      fireEvent.click(screen.getByTestId('submit-quiz-btn'))

      await waitFor(
        () => {
          expect(screen.getByTestId('quiz-result-card')).toHaveTextContent(
            /ĐẠT CHUẨN THÔNG THẠO/i,
          )
          expect(screen.getByTestId('quiz-result-card')).toHaveTextContent(
            /3 \/ 4 câu đúng/i,
          )
        },
        { timeout: 5000 },
      )

      // 6. Unmount and remount App (simulating full page reload) and verify 5/12 mastery persists in PostgreSQL & Redis
      unmount()
      render(createElement(App))
      await waitFor(
        () => {
          expect(screen.getByTestId('global-mastery-counter')).toHaveTextContent(
            'Đã thông thạo: 5 / 12 khái niệm (42%)',
          )
        },
        { timeout: 5000 },
      )
    } finally {
      globalThis.fetch = origFetch
    }
  }, 15000)
})
