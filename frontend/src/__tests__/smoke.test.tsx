import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

describe('Plumora Web Client Smoke Suite', () => {
  it('renders the clean LearnerAuthPage with zero demo buttons and SVG icons', () => {
    window.history.pushState({}, '', '/login')
    const { container } = render(<App />)
    expect(screen.getByTestId('learner-auth-page')).toBeInTheDocument()
    expect(screen.getByText(/Plumora Learning/i)).toBeInTheDocument()
    expect(screen.queryByText(/PlumoraDemo#2026/i)).toBeNull()
    expect(screen.queryByText(/learner_new/i)).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
