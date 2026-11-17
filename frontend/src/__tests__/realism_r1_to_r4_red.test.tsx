import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'
import * as api from '../api'

const mockAuthUser = {
  id: '00000000-0000-4000-8000-000000000099',
  username: 'test_learner',
  display_name: 'Test Learner',
  state_version: 1,
}

const mockRoadmap = {
  mastered_count: 0,
  total_concepts: 1,
  nodes: [
    {
      action_id: 1,
      slug: 'os-basics',
      title: 'Hệ điều hành, Process/Thread & I/O cơ bản',
      tier: 1,
      prerequisites: [],
      mastery_score: 0.0,
      status: 'unlocked' as const,
    },
  ],
  state_version: 1,
}

const mockRec = {
  status: 'active' as const,
  policy_source: 'dqn' as const,
  state_source: 'redis_cache' as const,
  recommended_concept: {
    action_id: 1,
    slug: 'os-basics',
    title: 'Hệ điều hành, Process/Thread & I/O cơ bản',
    tier: 1,
    mastery_score: 0.0,
  },
  checkpoint_sha256: 'e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b',
  degraded: false,
  guardrail_applied: false,
  state_version: 1,
  observation_24d: Array(24).fill(0),
}

describe('R2 Error Handling & Network Resilience', () => {
  it('R2: catches concept fetch error gracefully, displays error notice with retry action, and does NOT crash with unhandled rejection', async () => {
    vi.spyOn(api, 'apiGetMe').mockResolvedValue(mockAuthUser)
    vi.spyOn(api, 'apiGetRoadmap').mockResolvedValue(mockRoadmap)
    vi.spyOn(api, 'apiGetRecommendation').mockResolvedValue(mockRec)

    // Simulate network error / abort on concept fetch
    const getConceptSpy = vi
      .spyOn(api, 'apiGetConceptDetail')
      .mockRejectedValue(new Error('Failed to fetch: Connection timeout'))

    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    // Wait for roadmap to load
    await waitFor(() => {
      expect(screen.getByTestId('dag-node-os-basics')).toBeInTheDocument()
    })

    // Click to open the lesson
    const openBtn = screen.getByTestId('open-lesson-os-basics')
    fireEvent.click(openBtn)

    // Verify error is captured and displayed in an accessible alert banner with a Retry action
    await waitFor(() => {
      const errorNotice = screen.getByTestId('concept-fetch-error-banner')
      expect(errorNotice).toBeInTheDocument()
      expect(errorNotice).toHaveTextContent(/Không thể tải bài học/i)
      expect(screen.getByTestId('retry-fetch-concept-btn')).toBeInTheDocument()
    })

    // Now clicking Retry should attempt fetch again
    getConceptSpy.mockResolvedValueOnce({
      ok: true,
      data: {
        action_id: 1,
        slug: 'os-basics',
        title: 'Hệ điều hành, Process/Thread & I/O cơ bản',
        tier: 1,
        prerequisites: [],
        lesson_markdown: '# OS Basics',
        mastery_score: 0.0,
        status: 'unlocked',
        questions: [],
      },
    })

    fireEvent.click(screen.getByTestId('retry-fetch-concept-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('scr03-lesson-section')).toBeInTheDocument()
    })
  })
})
