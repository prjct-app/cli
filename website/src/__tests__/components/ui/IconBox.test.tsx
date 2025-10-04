import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IconBox } from '../../../components/ui/IconBox'

describe('IconBox Component', () => {
  it('should render with default props', () => {
    render(
      <IconBox>
        <span data-testid="icon">★</span>
      </IconBox>
    )

    const icon = screen.getByTestId('icon')
    expect(icon).toBeInTheDocument()
  })

  it('should render with different variants', () => {
    const { rerender } = render(
      <IconBox variant="default">
        <span>Default</span>
      </IconBox>
    )
    expect(screen.getByText('Default')).toBeInTheDocument()

    rerender(
      <IconBox variant="primary">
        <span>Primary</span>
      </IconBox>
    )
    expect(screen.getByText('Primary')).toBeInTheDocument()

    rerender(
      <IconBox variant="gradient">
        <span>Gradient</span>
      </IconBox>
    )
    expect(screen.getByText('Gradient')).toBeInTheDocument()

    rerender(
      <IconBox variant="outline">
        <span>Outline</span>
      </IconBox>
    )
    expect(screen.getByText('Outline')).toBeInTheDocument()

    rerender(
      <IconBox variant="muted">
        <span>Muted</span>
      </IconBox>
    )
    expect(screen.getByText('Muted')).toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { rerender } = render(
      <IconBox size="sm">
        <span>Small</span>
      </IconBox>
    )
    let container = screen.getByText('Small').parentElement
    expect(container).toHaveClass('w-8', 'h-8', 'p-1.5')

    rerender(
      <IconBox size="md">
        <span>Medium</span>
      </IconBox>
    )
    container = screen.getByText('Medium').parentElement
    expect(container).toHaveClass('w-12', 'h-12', 'p-2.5')

    rerender(
      <IconBox size="lg">
        <span>Large</span>
      </IconBox>
    )
    container = screen.getByText('Large').parentElement
    expect(container).toHaveClass('w-16', 'h-16', 'p-3')
  })

  it('should render with different rounded values', () => {
    const { rerender } = render(
      <IconBox rounded="md">
        <span>MD</span>
      </IconBox>
    )
    let container = screen.getByText('MD').parentElement
    expect(container).toHaveClass('rounded-md')

    rerender(
      <IconBox rounded="lg">
        <span>LG</span>
      </IconBox>
    )
    container = screen.getByText('LG').parentElement
    expect(container).toHaveClass('rounded-lg')

    rerender(
      <IconBox rounded="xl">
        <span>XL</span>
      </IconBox>
    )
    container = screen.getByText('XL').parentElement
    expect(container).toHaveClass('rounded-xl')

    rerender(
      <IconBox rounded="full">
        <span>Full</span>
      </IconBox>
    )
    container = screen.getByText('Full').parentElement
    expect(container).toHaveClass('rounded-full')
  })

  it('should apply custom className', () => {
    render(
      <IconBox className="custom-class">
        <span>Custom</span>
      </IconBox>
    )

    const container = screen.getByText('Custom').parentElement
    expect(container).toHaveClass('custom-class')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement>
    render(
      <IconBox ref={ref}>
        <span>Ref Test</span>
      </IconBox>
    )

    expect(ref.current).toBeInstanceOf(HTMLDivElement)
  })

  it('should accept custom motion props', () => {
    render(
      <IconBox whileHover={{ scale: 1.1 }} transition={{ duration: 0.5 }}>
        <span data-testid="motion-icon">Motion</span>
      </IconBox>
    )

    expect(screen.getByTestId('motion-icon')).toBeInTheDocument()
  })

  it('should have correct display name', () => {
    expect(IconBox.displayName).toBe('IconBox')
  })
})
