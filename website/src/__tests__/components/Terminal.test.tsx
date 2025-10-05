import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { Terminal } from '../../components/Terminal'

describe('Terminal Component', () => {
  beforeEach(() => {
    // Mock scrollTo function for DOM elements
    HTMLElement.prototype.scrollTo = vi.fn()
  })

  it('should render terminal component', () => {
    const { container } = render(<Terminal />)

    // Terminal should render with rounded border styling
    expect(container.querySelector('[class*="rounded"]')).toBeInTheDocument()
  })

  it('should render terminal header with control buttons', () => {
    const { container } = render(<Terminal />)

    // Terminal header should have three colored buttons (red, yellow, green)
    const buttons = container.querySelectorAll('[class*="rounded-full"]')
    expect(buttons.length).toBeGreaterThanOrEqual(3)
  })

  it('should render with styling', () => {
    const { container } = render(<Terminal />)

    // Terminal should have styled elements
    const styledElements = container.querySelectorAll('[class]')
    expect(styledElements.length).toBeGreaterThan(0)
  })
})
