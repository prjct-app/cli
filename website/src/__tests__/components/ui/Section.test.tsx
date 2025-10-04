import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Section } from '../../../components/ui/Section'

describe('Section Component', () => {
  it('should render with children only', () => {
    render(
      <Section>
        <p>Section content</p>
      </Section>
    )

    expect(screen.getByText('Section content')).toBeInTheDocument()
  })

  it('should render with title', () => {
    render(<Section title="Test Title">Content</Section>)

    expect(screen.getByRole('heading', { name: /test title/i })).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('should render with subtitle', () => {
    render(
      <Section title="Title" subtitle="Test subtitle">
        Content
      </Section>
    )

    expect(screen.getByText('Test subtitle')).toBeInTheDocument()
  })

  it('should render with badge', () => {
    render(
      <Section badge={<span data-testid="badge">Badge</span>}>Content</Section>
    )

    expect(screen.getByTestId('badge')).toBeInTheDocument()
  })

  it('should render all header elements together', () => {
    render(
      <Section
        badge={<span>Badge</span>}
        title="Title"
        subtitle="Subtitle"
      >
        Content
      </Section>
    )

    expect(screen.getByText('Badge')).toBeInTheDocument()
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Subtitle')).toBeInTheDocument()
  })

  it('should center content when centered is true', () => {
    render(
      <Section title="Centered Title" centered={true}>
        Content
      </Section>
    )

    const header = screen.getByText('Centered Title').closest('div')
    expect(header).toHaveClass('text-center')
  })

  it('should not center content by default', () => {
    render(<Section title="Default Title">Content</Section>)

    const header = screen.getByText('Default Title').closest('div')
    expect(header).not.toHaveClass('text-center')
  })

  it('should apply different maxWidth values', () => {
    const { rerender } = render(<Section maxWidth="sm">Small</Section>)
    let section = screen.getByText('Small').closest('section')
    let container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-sm')

    rerender(<Section maxWidth="md">Medium</Section>)
    section = screen.getByText('Medium').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-md')

    rerender(<Section maxWidth="lg">Large</Section>)
    section = screen.getByText('Large').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-lg')

    rerender(<Section maxWidth="xl">XL</Section>)
    section = screen.getByText('XL').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-xl')

    rerender(<Section maxWidth="2xl">2XL</Section>)
    section = screen.getByText('2XL').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-2xl')

    rerender(<Section maxWidth="6xl">6XL</Section>)
    section = screen.getByText('6XL').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-6xl')

    rerender(<Section maxWidth="7xl">7XL</Section>)
    section = screen.getByText('7XL').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-7xl')

    rerender(<Section maxWidth="full">Full</Section>)
    section = screen.getByText('Full').closest('section')
    container = section?.querySelector('div')
    expect(container).toHaveClass('max-w-full')
  })

  it('should apply custom className', () => {
    render(<Section className="custom-section">Content</Section>)

    const section = screen.getByText('Content').closest('section')
    expect(section).toHaveClass('custom-section')
  })

  it('should forward ref correctly', () => {
    const ref = { current: null } as React.RefObject<HTMLDivElement>
    render(<Section ref={ref}>Content</Section>)

    expect(ref.current).toBeInstanceOf(HTMLElement)
  })

  it('should accept custom motion props', () => {
    render(
      <Section
        initial={{ opacity: 0, x: -50 }}
        whileInView={{ opacity: 1, x: 0 }}
      >
        Motion Section
      </Section>
    )

    expect(screen.getByText('Motion Section')).toBeInTheDocument()
  })

  it('should have correct display name', () => {
    expect(Section.displayName).toBe('Section')
  })
})
