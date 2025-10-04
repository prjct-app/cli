import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '../../../components/ui/Card'

describe('Card Component', () => {
  it('should render with default props', () => {
    render(<Card>Test Card Content</Card>)

    const card = screen.getByText('Test Card Content')
    expect(card).toBeInTheDocument()
  })

  it('should render with different variants', () => {
    const { rerender } = render(<Card variant="default">Default</Card>)
    expect(screen.getByText('Default')).toBeInTheDocument()

    rerender(<Card variant="feature">Feature</Card>)
    expect(screen.getByText('Feature')).toBeInTheDocument()

    rerender(<Card variant="highlight">Highlight</Card>)
    expect(screen.getByText('Highlight')).toBeInTheDocument()

    rerender(<Card variant="gradient">Gradient</Card>)
    expect(screen.getByText('Gradient')).toBeInTheDocument()

    rerender(<Card variant="interactive">Interactive</Card>)
    expect(screen.getByText('Interactive')).toBeInTheDocument()
  })

  it('should apply hover styles when hover is true', () => {
    render(<Card hover={true}>Hover Card</Card>)

    const card = screen.getByText('Hover Card')
    expect(card).toHaveClass('hover:shadow-lg')
  })

  it('should not apply hover styles when hover is false', () => {
    render(<Card hover={false}>No Hover</Card>)

    const card = screen.getByText('No Hover')
    expect(card).not.toHaveClass('hover:shadow-lg')
  })

  it('should apply custom className', () => {
    render(<Card className="custom-class">Custom Card</Card>)

    const card = screen.getByText('Custom Card')
    expect(card).toHaveClass('custom-class')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement>
    render(<Card ref={ref}>Ref Test</Card>)

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('should render children correctly', () => {
    render(
      <Card>
        <h2>Card Title</h2>
        <p>Card description</p>
      </Card>
    )

    expect(screen.getByText('Card Title')).toBeInTheDocument()
    expect(screen.getByText('Card description')).toBeInTheDocument()
  })

  it('should accept custom motion props', () => {
    render(
      <Card
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
      >
        Motion Card
      </Card>
    )

    expect(screen.getByText('Motion Card')).toBeInTheDocument()
  })

  it('should have correct display name', () => {
    expect(Card.displayName).toBe('Card')
  })
})
