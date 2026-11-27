import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MultiDomainKgNodeCard } from '../components/MultiDomainKgNodeCard'
import type { DomainRoadmapNode } from '../types'

function makeNode(overrides: Partial<DomainRoadmapNode> = {}): DomainRoadmapNode {
  return {
    node_idx: 0,
    slug: 'net-internet',
    title: 'Internet & Mô hình Mạng cơ bản',
    tier: 1,
    is_shared: true,
    prerequisites: [],
    prerequisite_titles: [],
    lesson_markdown: '## 1. Mô hình Tư duy',
    depth_level_norm: 0,
    depth_label: 'Untested / Below Surface',
    confidence: 0,
    stability_s: 3.0,
    retention_ebbinghaus: 1.0,
    is_eligible: true,
    needs_review: false,
    code_practice_score: 0,
    has_code_challenge: true,
    playbook_completed: false,
    last_practiced_at: null,
    next_review_due_at: null,
    ...overrides,
  }
}

describe('Plumora v4.0 Explicit Sequential UX Gate (D-36)', () => {
  it('disables 5-Depth Probe and Code Sandbox buttons until Playbook is completed (INV-SEQ-01)', () => {
    render(
      <MultiDomainKgNodeCard
        node={makeNode({ is_eligible: true, playbook_completed: false, depth_level_norm: 0 })}
        onOpenPlaybook={vi.fn()}
        onStartDepthProbe={vi.fn()}
        onStartCodeSandbox={vi.fn()}
        onStartReview={vi.fn()}
      />,
    )

    const playbookBtn = screen.getByTestId('open-playbook-net-internet')
    const probeBtn = screen.getByRole('button', { name: /Kiểm tra 5 tầng/i })
    const codeBtn = screen.getByRole('button', { name: /Thực hành Code/i })

    expect(playbookBtn).not.toBeDisabled()
    expect(probeBtn).toBeDisabled()
    expect(codeBtn).toBeDisabled()
  })

  it('unlocks 5-Depth Probe and Code Sandbox buttons once Playbook is completed', () => {
    render(
      <MultiDomainKgNodeCard
        node={makeNode({ is_eligible: true, playbook_completed: true, depth_level_norm: 0.25 })}
        onOpenPlaybook={vi.fn()}
        onStartDepthProbe={vi.fn()}
        onStartCodeSandbox={vi.fn()}
        onStartReview={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: /Kiểm tra 5 tầng/i })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Thực hành Code/i })).not.toBeDisabled()
  })
})
