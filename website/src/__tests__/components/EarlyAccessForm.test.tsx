import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EarlyAccessForm from '../../components/EarlyAccessForm'

describe('EarlyAccessForm Component', () => {
  beforeEach(() => {
    // Mock window.open
    window.open = vi.fn()
  })

  it('should render form with heading', () => {
    render(<EarlyAccessForm />)

    expect(screen.getByText(/Join the Waitlist/i)).toBeInTheDocument()
  })

  it('should display description text', () => {
    render(<EarlyAccessForm />)

    expect(
      screen.getByText(/Be among the first to experience visual project metrics in your editor/i)
    ).toBeInTheDocument()
  })

  it('should have GitHub icon', () => {
    render(<EarlyAccessForm />)

    // GitHub icon should be rendered
    const githubIcons = document.querySelectorAll('svg')
    expect(githubIcons.length).toBeGreaterThan(0)
  })

  it('should open GitHub issue when button is clicked', async () => {
    const user = userEvent.setup()
    render(<EarlyAccessForm />)

    const requestButton = screen.getByRole('button', { name: /Request Early Access on GitHub/i })
    await user.click(requestButton)

    expect(window.open).toHaveBeenCalledWith(
      expect.stringContaining('github.com'),
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('should include correct GitHub issue parameters in URL', async () => {
    const user = userEvent.setup()
    render(<EarlyAccessForm />)

    const requestButton = screen.getByRole('button', { name: /Request Early Access on GitHub/i })
    await user.click(requestButton)

    const calledUrl = (window.open as any).mock.calls[0][0]
    expect(calledUrl).toContain('labels=Windsurf+Extension')
    expect(calledUrl).toContain('title=Early+Access+Request')
  })

  it('should have accessible button', () => {
    render(<EarlyAccessForm />)

    const button = screen.getByRole('button', { name: /Request Early Access on GitHub/i })
    expect(button).toBeInTheDocument()
    expect(button).toBeEnabled()
  })

  it('should have gradient background decoration', () => {
    const { container } = render(<EarlyAccessForm />)

    // Check for background gradient elements
    const gradients = container.querySelectorAll('[class*="gradient"]')
    expect(gradients.length).toBeGreaterThan(0)
  })

  it('should display call to action button text', () => {
    render(<EarlyAccessForm />)

    const button = screen.getByRole('button', { name: /Request Early Access on GitHub/i })
    expect(button).toBeInTheDocument()
  })

  it('should display early access benefits', () => {
    render(<EarlyAccessForm />)

    // Check for the three benefits displayed
    expect(screen.getByText(/Beta Access/i)).toBeInTheDocument()
    expect(screen.getByText(/Shape Features/i)).toBeInTheDocument()
    expect(screen.getByText(/Lifetime Updates/i)).toBeInTheDocument()
  })

  it('should show description for each benefit', () => {
    render(<EarlyAccessForm />)

    expect(screen.getByText(/Try before public launch/i)).toBeInTheDocument()
    expect(screen.getByText(/Your feedback matters/i)).toBeInTheDocument()
    expect(screen.getByText(/All future improvements/i)).toBeInTheDocument()
  })
})
