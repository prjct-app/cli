import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../../../components/ui/Button'

describe('Button Component', () => {
  it('should render as button by default', () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('should render with different variants', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>)
    expect(screen.getByText('Primary')).toBeInTheDocument()

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByText('Secondary')).toBeInTheDocument()

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByText('Ghost')).toBeInTheDocument()

    rerender(<Button variant="icon">Icon</Button>)
    expect(screen.getByText('Icon')).toBeInTheDocument()

    rerender(<Button variant="gradient">Gradient</Button>)
    expect(screen.getByText('Gradient')).toBeInTheDocument()
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    expect(screen.getByText('Small')).toHaveClass('px-3', 'py-1.5', 'text-sm')

    rerender(<Button size="md">Medium</Button>)
    expect(screen.getByText('Medium')).toHaveClass('px-4', 'py-2')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByText('Large')).toHaveClass('px-8', 'py-4')
  })

  it('should render with left icon', () => {
    const icon = <span data-testid="left-icon">←</span>
    render(<Button leftIcon={icon}>With Left Icon</Button>)

    expect(screen.getByTestId('left-icon')).toBeInTheDocument()
    expect(screen.getByText('With Left Icon')).toBeInTheDocument()
  })

  it('should render with right icon', () => {
    const icon = <span data-testid="right-icon">→</span>
    render(<Button rightIcon={icon}>With Right Icon</Button>)

    expect(screen.getByTestId('right-icon')).toBeInTheDocument()
    expect(screen.getByText('With Right Icon')).toBeInTheDocument()
  })

  it('should show loading spinner when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)

    const spinner = screen.getByRole('button').querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
    expect(screen.queryByText('Loading')).not.toBeInTheDocument()
  })

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')
  })

  it('should be disabled when isLoading is true', () => {
    render(<Button isLoading>Loading</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    )

    const button = screen.getByRole('button')
    await user.click(button)

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should render as anchor when as="a"', () => {
    render(
      <Button as="a" href="https://example.com">
        Link Button
      </Button>
    )

    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('should render anchor with target and rel', () => {
    render(
      <Button as="a" href="https://example.com" target="_blank" rel="noopener">
        External Link
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener')
  })

  it('should apply custom className', () => {
    render(<Button className="custom-class">Custom</Button>)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('should have correct display name', () => {
    expect(Button.displayName).toBe('Button')
  })
})
