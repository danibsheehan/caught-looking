import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import StatCard from './StatCard'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="OPS" value=".850" />)

    expect(screen.getByText('OPS')).toBeInTheDocument()
    expect(screen.getByText('.850')).toBeInTheDocument()
  })

  it('renders numeric values', () => {
    render(<StatCard label="HR" value={42} />)

    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders optional hint', () => {
    render(<StatCard label="ERA" value={2.1} hint="league avg 4.0" />)

    expect(screen.getByText('league avg 4.0')).toBeInTheDocument()
  })

  it('omits hint when not provided', () => {
    const { container } = render(<StatCard label="X" value={1} />)

    expect(container.querySelector('.stat-card-hint')).not.toBeInTheDocument()
  })
})
