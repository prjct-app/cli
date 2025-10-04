import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../../../components/ui/Badge'

describe('Badge Component', () => {
  it('should render with default props', () => {
    render(<Badge>Test Badge</Badge>)

    const badge = screen.getByText('Test Badge')
    expect(badge).toBeInTheDocument()
  })

  it('should render with different variants', () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>)
    expect(screen.getByText('Primary')).toBeInTheDocument()

    rerender(<Badge variant="success">Success</Badge>)
    expect(screen.getByText('Success')).toBeInTheDocument()

    rerender(<Badge variant="warning">Warning</Badge>)
    expect(screen.getByText('Warning')).toBeInTheDocument()

    rerender(<Badge variant="danger">Danger</Badge>)
    expect(screen.getByText('Danger')).toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>)
    expect(screen.getByText('Small')).toBeInTheDocument()

    rerender(<Badge size="md">Medium</Badge>)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('should render with an icon', () => {
    const icon = <span data-testid="badge-icon">★</span>
    render(<Badge icon={icon}>With Icon</Badge>)

    expect(screen.getByText('With Icon')).toBeInTheDocument()
    expect(screen.getByTestId('badge-icon')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    render(<Badge className="custom-class">Custom</Badge>)

    const badge = screen.getByText('Custom')
    expect(badge).toHaveClass('custom-class')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null } as React.RefObject<HTMLSpanElement>
    render(<Badge ref={ref}>Ref Test</Badge>)

    expect(ref.current).toBeInstanceOf(HTMLSpanElement)
  })

  it('should have correct display name', () => {
    expect(Badge.displayName).toBe('Badge')
  })
})
