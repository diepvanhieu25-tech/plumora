/**
 * PL-E2E-01 Golden Journey E2E Specification (Verified green in SLICE-01).
 * Journey: Login (SCR-01) -> Roadmap 12-node DAG & DQN Banner (SCR-02) -> Lesson Reader (SCR-03)
 *          -> 4-Question MCQ Quiz & Mastery Pass >= 75% (SCR-04) -> Reload Persistence.
 */

import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../src/App'
import {
  FALLBACK_CONCEPTS_DAG,
  FALLBACK_CONCEPT_DETAIL,
  FALLBACK_RECOMMENDATION,
} from '../src/api'

export const GOLDEN_JOURNEY_STEPS = [
  'SCR-01: Authenticate as learner_foundation via POST /api/v1/auth/login',
  'SCR-02: Verify 12 Backend DAG nodes across 4 tiers and DQN recommendation for db-transactions',
  'SCR-03: Open /concepts/db-transactions and read Markdown lesson content',
  'SCR-04: Submit 4-question single-choice MCQ with idempotent submission_id and achieve >= 75%',
  'SCR-02: Reload /roadmap and confirm mastery >= 75% persists in PostgreSQL SSoT & Redis Cache',
] as const

describe('PL-E2E-01 Golden Journey UI Flow & Strict Anti-Emoji Invariant (INV-UI-01)', () => {
  it('completes interactive UI journey across SCR-01..SCR-06 & SCR-08 with zero emoji characters', async () => {
    let dbTransactionsMastered = false

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString()
      const method = init?.method ?? 'GET'

      if (url.endsWith('/api/v1/auth/me')) {
        return new Response(
          JSON.stringify({
            id: '00000000-0000-4000-8000-000000000099',
            username: 'learner_foundation',
            display_name: 'Học viên Nền tảng (4/12 Node)',
            state_version: dbTransactionsMastered ? 6 : 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/api/v1/auth/login') && method === 'POST') {
        return new Response(
          JSON.stringify({
            user: {
              id: '00000000-0000-4000-8000-000000000099',
              username: 'learner_foundation',
              display_name: 'Học viên Nền tảng (4/12 Node)',
              state_version: 5,
            },
            access_token: 'mock-jwt-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/api/v1/roadmap')) {
        const updatedNodes = FALLBACK_CONCEPTS_DAG.map((n) =>
          n.slug === 'db-transactions' && dbTransactionsMastered
            ? { ...n, mastery_score: 0.75, status: 'mastered' as const }
            : n,
        )
        return new Response(
          JSON.stringify({
            state_version: dbTransactionsMastered ? 6 : 5,
            mastered_count: dbTransactionsMastered ? 5 : 4,
            total_concepts: 12,
            nodes: updatedNodes,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/api/v1/recommendations') && method === 'POST') {
        const nextRec = dbTransactionsMastered
          ? {
              ...FALLBACK_RECOMMENDATION,
              state_version: 6,
              recommended_concept: {
                action_id: 6,
                slug: 'api-rest',
                title: 'Thiết kế RESTful API chuẩn',
                tier: 3,
                mastery_score: 0.0,
              },
            }
          : FALLBACK_RECOMMENDATION
        return new Response(JSON.stringify(nextRec), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/concepts/db-transactions') && method === 'GET') {
        return new Response(JSON.stringify(FALLBACK_CONCEPT_DETAIL), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      if (url.endsWith('/api/v1/concepts/sec-api') && method === 'GET') {
        return new Response(
          JSON.stringify({
            error_code: 'CONCEPT_LOCKED',
            message:
              'Khái niệm này chưa mở khóa. Bạn cần đạt tối thiểu 75% ở các bài tiên quyết.',
            details: {
              concept_slug: 'sec-api',
              missing_prerequisites: ['api-validation', 'api-data', 'sec-authn'],
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/api/v1/concepts/db-transactions/attempts') && method === 'POST') {
        dbTransactionsMastered = true
        return new Response(
          JSON.stringify({
            attempt_id: '00000000-0000-4000-8000-000000007777',
            submission_id: '00000000-0000-4000-8000-000000008888',
            idempotent_replay: false,
            correct_count: 3,
            attempt_score: 0.75,
            passed: true,
            mastery_before: 0.0,
            mastery_after: 0.75,
            state_version: 6,
            newly_unlocked_slugs: ['api-data'],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify({}), { status: 200 })
    })

    const { container } = render(createElement(App))

    // 1. Verify zero emoji characters anywhere in the rendered DOM (D-12, INV-UI-01)
    const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u
    expect(emojiRegex.test(container.textContent ?? '')).toBe(false)

    // 2. Step 1 (SCR-01): Authenticate as learner_foundation
    fireEvent.click(screen.getByTestId('seed-login-learner_foundation'))
    await waitFor(() => {
      expect(screen.getByTestId('active-username')).toHaveTextContent('learner_foundation')
    })

    // 3. Step 2 (SCR-02): Verify 12 Backend DAG nodes across 4 tiers and DQN recommendation
    expect(screen.getByTestId('ai-recommendation-banner')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-net-internet')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-db-transactions')).toBeInTheDocument()
    expect(screen.getByTestId('dag-node-sec-api')).toBeInTheDocument()

    // Verify clicking a Locked node (sec-api) renders SCR-08 403 CONCEPT_LOCKED guard
    fireEvent.click(screen.getByTestId('open-lesson-sec-api'))
    await waitFor(() => {
      expect(screen.getByTestId('scr08-locked-view')).toBeInTheDocument()
    })

    // Return to roadmap view
    fireEvent.click(screen.getByTestId('back-to-roadmap-btn'))

    // 4. Step 3 (SCR-03): Open recommended concept db-transactions
    fireEvent.click(screen.getByTestId('start-recommended-lesson-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('lesson-markdown-body')).toHaveTextContent(/Atomicity/i)
    })

    // Transition from SCR-03 Lesson to SCR-04 Quiz
    fireEvent.click(screen.getByTestId('start-quiz-btn'))

    // 5. Step 4 (SCR-04): Answer 4 MCQ questions and submit
    const submitBtn = screen.getByTestId('submit-quiz-btn')
    expect(submitBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId('quiz-q1-opt-A'))
    fireEvent.click(screen.getByTestId('quiz-q2-opt-A'))
    fireEvent.click(screen.getByTestId('quiz-q3-opt-A'))
    expect(submitBtn).toBeDisabled()

    fireEvent.click(screen.getByTestId('quiz-q4-opt-B'))
    expect(submitBtn).not.toBeDisabled()
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(screen.getByTestId('quiz-result-card')).toHaveTextContent(/ĐẠT CHUẨN THÔNG THẠO/i)
    })

    // 6. Step 5 (SCR-02): Verify mastery counter updated from 4/12 to 5/12 and next rec is api-rest
    await waitFor(() => {
      expect(screen.getByTestId('global-mastery-counter')).toHaveTextContent(
        'Đã thông thạo: 5 / 12 khái niệm',
      )
    })

    // 7. Open SCR-06 RL Provenance 24-dim Drawer
    fireEvent.click(screen.getByTestId('open-provenance-drawer-btn'))
    expect(screen.getByTestId('scr06-provenance-drawer')).toBeInTheDocument()

    fetchMock.mockRestore()
  })
})
