import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { App } from '../App'
import { generateSubmissionId } from '../utils/submission'
import { AiRecommendationBanner } from '../components/roadmap/AiRecommendationBanner'
import { LessonReader } from '../components/lesson/LessonReader'
import { ProvenanceDrawer } from '../components/drawer/ProvenanceDrawer'
import * as api from '../api'

const mockAuthUser = {
  id: '00000000-0000-4000-8000-000000000099',
  username: 'test_user',
  display_name: 'Test Learner',
  state_version: 1,
}

describe('Quality Hardening Tests (F1, F5, F8)', () => {
  it('F8: generateSubmissionId generates unique valid v4 UUIDs even when crypto.randomUUID is not present', () => {
    const origRandomUUID = crypto.randomUUID
    try {
      // Mock missing randomUUID to exercise RFC4122 v4 crypto.getRandomValues fallback
      Object.defineProperty(crypto, 'randomUUID', {
        value: undefined,
        configurable: true,
      })
      const id1 = generateSubmissionId()
      const id2 = generateSubmissionId()
      expect(id1).not.toBe('00000000-0000-4000-8000-000000009999')
      expect(id2).not.toBe('00000000-0000-4000-8000-000000009999')
      expect(id1).not.toBe(id2)
      // Check RFC4122 v4 format
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      expect(id1).toMatch(uuidV4Regex)
      expect(id2).toMatch(uuidV4Regex)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', {
        value: origRandomUUID,
        configurable: true,
      })
    }
  })

  it('F1: does NOT show fake 4/12 fixture data or fake DQN recommendation when API fails', async () => {
    vi.spyOn(api, 'apiGetMe').mockResolvedValue(mockAuthUser)
    vi.spyOn(api, 'apiGetRoadmap').mockRejectedValue(new Error('Network error loading roadmap'))
    vi.spyOn(api, 'apiGetRecommendation').mockRejectedValue(new Error('Network error loading recommendation'))

    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    // Wait for effect to settle
    await waitFor(() => {
      // Must NOT display fake 4/12 completed concepts
      const masteryCounter = screen.queryByTestId('global-mastery-counter')
      if (masteryCounter) {
        expect(masteryCounter.textContent).not.toContain('4 / 12')
      }
      expect(screen.getByTestId('roadmap-api-error-banner')).toBeInTheDocument()
    })

    // Must show clear error banner and a retry button
    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument()
  })

  it('F1: clears user state on logout and does not leave user data in memory', async () => {
    vi.spyOn(api, 'apiLogout').mockResolvedValue(undefined)
    vi.spyOn(api, 'apiGetMe').mockResolvedValue(null)
    vi.spyOn(api, 'apiGetRoadmap').mockResolvedValue({
      state_version: 1,
      mastered_count: 0,
      total_concepts: 12,
      nodes: [],
    })
    vi.spyOn(api, 'apiGetRecommendation').mockResolvedValue({
      status: 'active',
      recommended_concept: null,
      policy_source: 'dqn',
      state_source: 'redis_cache',
      guardrail_applied: false,
      degraded: false,
      checkpoint_sha256: null,
      state_version: 1,
      observation_24d: new Array(24).fill(0),
    })

    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    const logoutBtn = screen.getByTestId('logout-btn')
    fireEvent.click(logoutBtn)

    await waitFor(() => {
      expect(screen.getByTestId('scr01-auth-section')).toBeInTheDocument()
      expect(screen.queryByTestId('active-username')).not.toBeInTheDocument()
    })
  })

  it('F5: closes Provenance Drawer and Preset Modal on Escape key press', async () => {
    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    // Open drawer
    const openDrawerBtn = screen.getByTestId('open-provenance-drawer-btn')
    fireEvent.click(openDrawerBtn)
    expect(screen.getByTestId('scr06-provenance-drawer')).toBeInTheDocument()

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('scr06-provenance-drawer')).not.toBeInTheDocument()
    })
  })

  it('H4: truthfully renders fallback_rule without DQN headline or claiming optimal', async () => {
    vi.spyOn(api, 'apiGetMe').mockResolvedValue(mockAuthUser)
    vi.spyOn(api, 'apiGetRoadmap').mockResolvedValue({
      state_version: 1,
      mastered_count: 0,
      total_concepts: 12,
      nodes: [
        {
          action_id: 0,
          slug: 'net-internet',
          title: 'Internet & Mô hình Mạng cơ bản',
          tier: 1,
          status: 'unlocked',
          mastery_score: 0.0,
          prerequisites: [],
        },
      ],
    })
    vi.spyOn(api, 'apiGetRecommendation').mockResolvedValue({
      status: 'active',
      recommended_concept: {
        action_id: 0,
        slug: 'net-internet',
        title: 'Internet & Mô hình Mạng cơ bản',
        tier: 1,
        mastery_score: 0.0,
      },
      policy_source: 'fallback_rule',
      state_source: 'postgres_fallback',
      guardrail_applied: true,
      degraded: true,
      checkpoint_sha256: null,
      state_version: 1,
      observation_24d: new Array(24).fill(0),
    })

    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    await waitFor(() => {
      const banner = screen.getByTestId('ai-recommendation-banner')
      expect(banner).toBeInTheDocument()
      // Headline must reflect fallback rule, NOT DQN
      expect(banner).toHaveTextContent(/KHUYẾN NGHỊ THEO QUY TẮC ĐỒ THỊ \(TOPO FALLBACK\)/i)
      expect(banner).not.toHaveTextContent(/KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG \(DQN POLICY\)/i)
      // Must NOT claim "tối ưu nhất"
      expect(banner).not.toHaveTextContent(/tối ưu nhất/i)
      // Must indicate degraded state
      expect(banner).toHaveTextContent(/Chế độ dự phòng/i)
      // Model chip
      expect(banner).toHaveTextContent(/Mô hình: Quy tắc thứ tự Topo/i)
    })
  })

  it('H4: truthfully renders dqn_masked_q recommendation with masked action filter label', async () => {
    vi.spyOn(api, 'apiGetMe').mockResolvedValue(mockAuthUser)
    vi.spyOn(api, 'apiGetRoadmap').mockResolvedValue({
      state_version: 1,
      mastered_count: 0,
      total_concepts: 12,
      nodes: [
        {
          action_id: 0,
          slug: 'net-internet',
          title: 'Internet & Mô hình Mạng cơ bản',
          tier: 1,
          status: 'unlocked',
          mastery_score: 0.0,
          prerequisites: [],
        },
      ],
    })
    vi.spyOn(api, 'apiGetRecommendation').mockResolvedValue({
      status: 'active',
      recommended_concept: {
        action_id: 0,
        slug: 'net-internet',
        title: 'Internet & Mô hình Mạng cơ bản',
        tier: 1,
        mastery_score: 0.0,
      },
      policy_source: 'dqn_masked_q',
      state_source: 'redis_cache',
      guardrail_applied: false,
      degraded: false,
      checkpoint_sha256: 'e464fa638cee04fda6a386ffb6cdf24d9190d0f1167feb56d4da0063499a6b6b',
      state_version: 2,
      observation_24d: new Array(24).fill(0),
    })

    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    await waitFor(() => {
      const banner = screen.getByTestId('ai-recommendation-banner')
      expect(banner).toHaveTextContent(/KHUYẾN NGHỊ TỪ MÔ HÌNH DQN \(MASKED Q\)/i)
      expect(banner).toHaveTextContent(/DQN \(Lọc hành động hợp lệ\)/i)
      // Must NOT claim "tối ưu nhất"
      expect(banner).not.toHaveTextContent(/tối ưu nhất/i)
    })
  })

  it('H6: transfers initial focus inside drawer and modal on open and restores on close', async () => {
    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    // Open Provenance Drawer
    const openDrawerBtn = screen.getByTestId('open-provenance-drawer-btn')
    openDrawerBtn.focus()
    expect(document.activeElement).toBe(openDrawerBtn)

    fireEvent.click(openDrawerBtn)
    const drawer = screen.getByTestId('scr06-provenance-drawer')
    expect(drawer).toBeInTheDocument()

    // Focus must now be INSIDE drawer
    expect(drawer.contains(document.activeElement)).toBe(true)

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('scr06-provenance-drawer')).not.toBeInTheDocument()
    })

    // Focus restored back to button
    expect(document.activeElement).toBe(openDrawerBtn)

    // Open Preset Modal
    const openPresetBtn = screen.getByTestId('preset-btn-foundation_ready')
    openPresetBtn.focus()
    expect(document.activeElement).toBe(openPresetBtn)

    fireEvent.click(openPresetBtn)
    const modal = screen.getByTestId('scr05-preset-modal')
    expect(modal).toBeInTheDocument()

    // Focus must now be INSIDE modal
    expect(modal.contains(document.activeElement)).toBe(true)

    // Press Escape to close
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByTestId('scr05-preset-modal')).not.toBeInTheDocument()
    })

    // Focus restored back to preset button
    expect(document.activeElement).toBe(openPresetBtn)
  })

  it('H4: renders truthful completed state banner without attributing confirmation to DQN', () => {
    render(
      <AiRecommendationBanner
        recommendation={{
          status: 'completed',
          recommended_concept: null,
          policy_source: 'completed',
          state_source: 'redis_cache',
          guardrail_applied: false,
          degraded: false,
          checkpoint_sha256: null,
          state_version: 12,
          observation_24d: new Array(24).fill(1),
        }}
        masteredCount={12}
        onStartRecommended={() => {}}
      />
    )
    const banner = screen.getByTestId('ai-recommendation-banner')
    expect(banner).toHaveTextContent(/Chúc mừng! Bạn đã hoàn thành trọn vẹn 12\/12 khái niệm Backend!/i)
    // Must NOT falsely state "Mô hình DQN xác nhận"
    expect(banner).not.toHaveTextContent(/Mô hình DQN xác nhận/i)
    expect(banner).toHaveTextContent(/Hệ thống xác nhận trạng thái hoàn tất lộ trình/i)
  })

  it('H4: LessonReader does not hardcode DQN proposal badge', () => {
    const mockConcept = {
      action_id: 1,
      slug: 'os-basics',
      title: 'Hệ Điều Hành & Quản Lý Tiến Trình',
      tier: 1,
      lesson_markdown: '# OS Basics\n\nNội dung bài học lý thuyết.',
      mastery_score: 0.0,
      status: 'unlocked' as const,
      prerequisites: [],
      questions: [],
    }

    render(
      <LessonReader
        currentConcept={mockConcept}
        onGoToQuiz={() => {}}
        onBackToRoadmap={() => {}}
      />
    )
    const section = screen.getByTestId('scr03-lesson-section')
    // Must NOT blindly claim "AI ĐỀ XUẤT TIẾP THEO (DQN POLICY)"
    expect(section).not.toHaveTextContent(/AI ĐỀ XUẤT TIẾP THEO \(DQN POLICY\)/i)
    expect(section).toHaveTextContent(/KHÁI NIỆM TRONG LỘ TRÌNH HỌC/i)
  })

  it('H4: ProvenanceDrawer maps all policy sources and renders degraded indicator', () => {
    const mockNodes = [
      {
        action_id: 0,
        slug: 'net-internet',
        title: 'Internet & Mạng',
        tier: 1,
        prerequisites: [],
        mastery_score: 0.0,
        status: 'unlocked' as const,
      },
    ]

    const { rerender } = render(
      <ProvenanceDrawer
        isDrawerOpen={true}
        onClose={() => {}}
        recommendation={{
          status: 'active',
          recommended_concept: null,
          policy_source: 'fallback_rule',
          state_source: 'postgres_fallback',
          guardrail_applied: true,
          degraded: true,
          checkpoint_sha256: null,
          state_version: 3,
          observation_24d: new Array(24).fill(0),
        }}
        nodes={mockNodes}
      />
    )

    expect(screen.getByText(/Quy tắc thứ tự Topo \(Topo Fallback\)/i)).toBeInTheDocument()
    expect(screen.getByText(/Chế độ dự phòng \(Degraded\)/i)).toBeInTheDocument()

    // Test dqn_masked_q mapping
    rerender(
      <ProvenanceDrawer
        isDrawerOpen={true}
        onClose={() => {}}
        recommendation={{
          status: 'active',
          recommended_concept: null,
          policy_source: 'dqn_masked_q',
          state_source: 'redis_cache',
          guardrail_applied: false,
          degraded: false,
          checkpoint_sha256: 'abc123456789',
          state_version: 4,
          observation_24d: new Array(24).fill(0),
        }}
        nodes={mockNodes}
      />
    )
    expect(screen.getByText(/Mô hình DQN \(Lọc hành động hợp lệ Masked-Q\)/i)).toBeInTheDocument()
    expect(screen.getByText('Bình thường')).toBeInTheDocument()
  })

  it('H6: traps Tab key focus inside dialog and loops correctly', () => {
    render(<App initialUser={mockAuthUser} initialView="roadmap" />)

    const openPresetBtn = screen.getByTestId('preset-btn-foundation_ready')
    fireEvent.click(openPresetBtn)

    const modal = screen.getByTestId('scr05-preset-modal')
    expect(modal).toBeInTheDocument()

    const focusable = modal.querySelectorAll<HTMLElement>('button:not([disabled])')
    expect(focusable.length).toBeGreaterThanOrEqual(2)
    const firstBtn = focusable[0]
    const lastBtn = focusable[focusable.length - 1]

    // Focus first button
    firstBtn.focus()
    expect(document.activeElement).toBe(firstBtn)

    // Press Shift+Tab on first element -> should loop to last button
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastBtn)

    // Press Tab on last element -> should loop to first button
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', shiftKey: false })
    expect(document.activeElement).toBe(firstBtn)
  })
})
