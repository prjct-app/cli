import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Terminal } from '../../components/Terminal'

describe('Terminal Component', () => {
  it('should render terminal component', () => {
    const { container } = render(<Terminal />)

    // Terminal should render with some content
    expect(container.querySelector('[class*="rounded"]')).toBeInTheDocument()
  })

  it('should show terminal title', () => {
    render(<Terminal />)

    // Terminal should show the flow title
    expect(screen.getByText(/Complete Flow/i)).toBeInTheDocument()
  })

  it('should render with styling', () => {
    const { container } = render(<Terminal />)

    // Terminal should have styled elements
    const styledElements = container.querySelectorAll('[class]')
    expect(styledElements.length).toBeGreaterThan(0)
  })
})
