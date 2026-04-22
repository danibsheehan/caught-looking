import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Leaders from './Leaders'

describe('Leaders', () => {
  it('renders placeholder heading and copy', () => {
    render(<Leaders />)
    expect(screen.getByRole('heading', { level: 1, name: 'Leaders' })).toBeInTheDocument()
    expect(screen.getByText(/Coming in a later phase/i)).toBeInTheDocument()
  })
})
