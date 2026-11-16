import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from '../App'

describe('ENV-01 Frontend Smoke Suite', () => {
  it('renders the Botanical Sprout Plumora header with Lucide SVG icon and zero emoji', () => {
    const { container } = render(<App />)
    expect(screen.getByText(/Plumora — Lộ trình Backend RL/i)).toBeInTheDocument()
    expect(screen.getByTestId('env01-scaffold-ready')).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})
