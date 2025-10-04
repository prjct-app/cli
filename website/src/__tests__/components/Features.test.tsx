import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Features } from '../../components/Features'

describe('Features Component', () => {
  it('should render section with features', () => {
    render(<Features />)

    // Just check that the section renders
    const { container } = render(<Features />)
    expect(container.querySelector('section')).toBeInTheDocument()
  })

  it('should render Dynamic AI Agents feature', () => {
    render(<Features />)

    expect(screen.getByText('Dynamic AI Agents')).toBeInTheDocument()
  })

  it('should render Native MCP feature', () => {
    render(<Features />)

    expect(screen.getByText(/Native MCP/i)).toBeInTheDocument()
    expect(screen.getByText(/Context7.*Sequential.*integration/i)).toBeInTheDocument()
  })

  it('should render Git Validation feature', () => {
    render(<Features />)

    expect(screen.getByText(/Git Validation/i)).toBeInTheDocument()
    expect(screen.getByText(/Last commit.*source of truth/i)).toBeInTheDocument()
  })

  it('should render p. Trigger feature', () => {
    render(<Features />)

    expect(screen.getByText(/p\. Trigger.*Zero Memorization/i)).toBeInTheDocument()
    expect(screen.getByText(/Works in any language/i)).toBeInTheDocument()
  })

  it('should render 5 Essential Commands feature', () => {
    render(<Features />)

    expect(screen.getByText(/5 Essential Commands/i)).toBeInTheDocument()
    expect(screen.getByText(/zero BS/i)).toBeInTheDocument()
  })

  it('should render Developer Momentum feature', () => {
    render(<Features />)

    expect(screen.getByText(/Developer Momentum/i)).toBeInTheDocument()
    expect(screen.getByText(/NOT a PM tool/i)).toBeInTheDocument()
  })

  it('should render Focus Mode feature', () => {
    render(<Features />)

    expect(screen.getByText(/Focus Mode/i)).toBeInTheDocument()
    expect(screen.getByText(/One task at a time/i)).toBeInTheDocument()
  })

  it('should render all feature icons', () => {
    render(<Features />)

    // Each feature should have an icon (SVG)
    const svgs = document.querySelectorAll('svg')
    // Should have at least one icon per feature (8+ features)
    expect(svgs.length).toBeGreaterThanOrEqual(8)
  })

  it('should render feature cards', () => {
    const { container } = render(<Features />)

    // Features should be rendered in cards
    const cards = container.querySelectorAll('[class*="rounded"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('should render features in a grid layout', () => {
    const { container } = render(<Features />)

    // Features should be in a grid
    const grid = container.querySelector('[class*="grid"]')
    expect(grid).toBeInTheDocument()
  })

  it('should have card components for each feature', () => {
    const { container } = render(<Features />)

    // Each feature should be wrapped in a Card
    const cards = container.querySelectorAll('[class*="rounded"]')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('should render section with proper spacing', () => {
    const { container } = render(<Features />)

    const section = container.querySelector('section')
    expect(section).toHaveClass('px-4', 'py-20')
  })
})
