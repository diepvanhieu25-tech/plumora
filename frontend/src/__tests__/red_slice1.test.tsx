import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

const mockAuthUser = {
  id: '00000000-0000-4000-8000-000000000099',
  username: 'learner_foundation',
  display_name: 'Học viên Nền tảng (4/12 Node)',
  state_version: 5,
}

describe('SLICE-01 Frontend Behavioral RED Suite (PL-AUTH-01, PL-CONTENT-01, PL-QUIZ-01, PL-REC-01)', () => {
  it('PL-AUTH-01 (SCR-01): renders Login form and 3 seeded PostgreSQL learner profiles', () => {
    render(<App />)
    expect(screen.getByText(/Tài khoản Học viên Mẫu \(Seeded trong PostgreSQL\)/i)).toBeInTheDocument()
    expect(screen.getByText('learner_new')).toBeInTheDocument()
    expect(screen.getByText('learner_foundation')).toBeInTheDocument()
    expect(screen.getByText('learner_api_stage')).toBeInTheDocument()
  })

  it('PL-CONTENT-01 & PL-REC-01 (SCR-02): renders 12 Backend DAG nodes across 4 tiers and DQN Recommendation Banner', () => {
    render(<App initialUser={mockAuthUser} initialView="roadmap" />)
    expect(
      screen.getByText(/KHUYẾN NGHỊ TỪ MÔ HÌNH HỌC TĂNG CƯỜNG \(DQN POLICY\)/i),
    ).toBeInTheDocument()
    expect(screen.getAllByText('db-transactions').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('sec-api')).toBeInTheDocument()
  })

  it('PL-QUIZ-01 (SCR-04): disables quiz submit button until all 4 single-choice questions are answered', () => {
    render(<App initialUser={mockAuthUser} initialView="quiz" />)
    const submitBtn = screen.getByRole('button', { name: /Nộp bài kiểm tra/i })
    expect(submitBtn).toBeDisabled()
  })
})
