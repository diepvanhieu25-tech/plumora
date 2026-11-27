import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownRenderer } from '../components/ui/MarkdownRenderer'
import { LessonPlaybookPage } from '../pages/LessonPlaybookPage'
import type { DomainRoadmapNode } from '../types'

const SAMPLE_PLAYBOOK = `## 1. Mô hình Tư duy & Bài toán Thực tế

Khi hệ thống chạy từ $S_0 = 3.0$ $\\rightarrow$ $O(\\log N)$ và $\\Delta t \\ge 0.25$.

## 2. Cơ chế Hoạt động Tầng sâu

- Mục cấp 1:
  - Mục con cấp 2
- Mục cấp 1 khác

## 3. Thực hành Chuẩn Production & Anti-patterns

> [!TIP] Luôn giữ transaction ngắn.

## 4. Đánh đổi Kiến trúc (Trade-offs)

| Tiêu chí | A | B |
| :--- | :--- | :--- |
| Tốc độ | Nhanh | Chậm |

## 5. Câu hỏi Phản tư & Kiểm chứng Nhanh

1. Tại sao phải dùng Index?
2. Khi nào cần Outbox?`

function makeNode(): DomainRoadmapNode {
  return {
    node_idx: 0,
    slug: 'db-relational',
    title: 'CSDL Quan hệ & Index',
    tier: 2,
    is_shared: false,
    prerequisites: [],
    prerequisite_titles: [],
    lesson_markdown: SAMPLE_PLAYBOOK,
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
  }
}

describe('Plumora v4.1 Playbook & MarkdownRenderer (D-38)', () => {
  it('cleans raw LaTeX symbols, preserves nested lists, and attaches section anchors', () => {
    const { container } = render(<MarkdownRenderer markdown={SAMPLE_PLAYBOOK} />)
    expect(container.textContent).not.toContain('$\\rightarrow$')
    expect(container.textContent).toContain('→')
    expect(container.querySelector('#playbook-sec-1')).not.toBeNull()
    expect(container.querySelector('#playbook-sec-5')).not.toBeNull()
    // Nested bullet item should be rendered inside an indented sub-list
    expect(container.querySelector('[data-nested-list="true"]')).not.toBeNull()
  })

  it('renders sticky 5-section TOC and interactive reflection cards on LessonPlaybookPage', () => {
    render(
      <LessonPlaybookPage
        domainSlug="backend"
        conceptSlug="db-relational"
        initialNode={makeNode()}
        onBackToRoadmap={vi.fn()}
        onStartDepthProbe={vi.fn()}
        onStartCodeSandbox={vi.fn()}
      />,
    )
    expect(screen.getByTestId('playbook-toc')).toBeInTheDocument()
    expect(screen.getAllByTestId('playbook-reflection-card').length).toBeGreaterThanOrEqual(2)
  })
})
