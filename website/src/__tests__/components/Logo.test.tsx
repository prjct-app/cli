import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrjctLogo } from '../../components/Logo'

describe('PrjctLogo Component', () => {
  it('should render logo with text by default', () => {
    render(<PrjctLogo />)

    expect(screen.getByTestId('prjct-logo')).toBeInTheDocument()
    expect(screen.getByTestId('prjct-logo-icon')).toBeInTheDocument()
    expect(screen.getByText('prjct')).toBeInTheDocument()
    expect(screen.getByText('p/')).toBeInTheDocument()
  })

  it('should render logo without text when showText is false', () => {
    render(<PrjctLogo showText={false} />)

    expect(screen.getByTestId('prjct-logo')).toBeInTheDocument()
    expect(screen.getByTestId('prjct-logo-icon')).toBeInTheDocument()
    expect(screen.queryByText('prjct')).not.toBeInTheDocument()
  })

  it('should render logo with text when showText is true', () => {
    render(<PrjctLogo showText={true} />)

    expect(screen.getByText('prjct')).toBeInTheDocument()
  })

  it('should apply small size correctly', () => {
    render(<PrjctLogo size="sm" />)

    const icon = screen.getByTestId('prjct-logo-icon')
    expect(icon).toHaveClass('size-10')
  })

  it('should apply medium size correctly', () => {
    render(<PrjctLogo size="md" />)

    const icon = screen.getByTestId('prjct-logo-icon')
    expect(icon).toHaveClass('size-12')
  })

  it('should apply large size correctly', () => {
    render(<PrjctLogo size="lg" />)

    const icon = screen.getByTestId('prjct-logo-icon')
    expect(icon).toHaveClass('size-14')
  })

  it('should apply extra large size correctly', () => {
    render(<PrjctLogo size="xl" />)

    const icon = screen.getByTestId('prjct-logo-icon')
    expect(icon).toHaveClass('size-16')
  })

  it('should render p/ text inside icon', () => {
    render(<PrjctLogo />)

    const pSlash = screen.getByText('p/')
    expect(pSlash).toBeInTheDocument()
    expect(pSlash.closest('[data-testid="prjct-logo-icon"]')).toBeInTheDocument()
  })

  it('should have correct structure', () => {
    render(<PrjctLogo />)

    const logo = screen.getByTestId('prjct-logo')
    const icon = screen.getByTestId('prjct-logo-icon')

    // Logo container should contain the icon
    expect(logo).toContainElement(icon)

    // Icon should have the p/ text
    expect(icon).toHaveTextContent('p/')
  })

  it('should apply different text sizes for different logo sizes', () => {
    const { rerender } = render(<PrjctLogo size="sm" showText />)
    let brandText = screen.getByText('prjct')
    expect(brandText).toHaveClass('text-sm')

    rerender(<PrjctLogo size="md" showText />)
    brandText = screen.getByText('prjct')
    expect(brandText).toHaveClass('text-lg')

    rerender(<PrjctLogo size="lg" showText />)
    brandText = screen.getByText('prjct')
    expect(brandText).toHaveClass('text-xl')

    rerender(<PrjctLogo size="xl" showText />)
    brandText = screen.getByText('prjct')
    expect(brandText).toHaveClass('text-2xl')
  })
})
