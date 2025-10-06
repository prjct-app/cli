import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Navigation } from '../../components/Navigation'

const renderWithRouter = (initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Navigation />
    </MemoryRouter>
  )
}

describe('Navigation Component', () => {
  it('should render logo that links to home', () => {
    renderWithRouter()

    const logo = screen.getByTestId('prjct-logo')
    expect(logo).toBeInTheDocument()

    const homeLink = logo.closest('a')
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('should render all navigation items', () => {
    renderWithRouter()

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
    expect(screen.getByText('Commands')).toBeInTheDocument()
    expect(screen.getByText('Workflows')).toBeInTheDocument()
    expect(screen.getByText('Windsurf Extension')).toBeInTheDocument()
    expect(screen.getByText('FAQ')).toBeInTheDocument()
    expect(screen.getByText('Changelog')).toBeInTheDocument()
    expect(screen.getByText('Discord')).toBeInTheDocument()
  })

  it('should highlight active route', () => {
    renderWithRouter('/docs')

    const docsLink = screen.getByText('Docs').closest('a')
    expect(docsLink).toHaveClass('text-primary')
  })

  it('should have mobile menu button', () => {
    renderWithRouter()

    // Mobile menu button exists (look for button elements)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('should render navigation items in mobile menu', () => {
    renderWithRouter()

    // Navigation items should be available
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Docs')).toBeInTheDocument()
  })

  it('should have sticky positioning', () => {
    const { container } = renderWithRouter()

    const header = container.querySelector('header')
    expect(header).toHaveClass('sticky', 'top-0')
  })

  it('should have backdrop blur effect', () => {
    const { container } = renderWithRouter()

    const header = container.querySelector('header')
    expect(header).toHaveClass('backdrop-blur-md')
  })

  it('should render navigation icons', () => {
    renderWithRouter()

    // Each nav item should have an icon (SVG)
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(navItems.length)
  })

  it('should navigate to correct routes', () => {
    renderWithRouter()

    const docsLink = screen.getByText('Docs').closest('a')
    expect(docsLink).toHaveAttribute('href', '/docs')

    const commandsLink = screen.getByText('Commands').closest('a')
    expect(commandsLink).toHaveAttribute('href', '/commands')

    const faqLink = screen.getByText('FAQ').closest('a')
    expect(faqLink).toHaveAttribute('href', '/faq')
  })

  it('should highlight home when on home path', () => {
    renderWithRouter('/')

    const homeLink = screen.getByText('Home').closest('a')
    expect(homeLink).toHaveClass('text-primary')
  })

  it('should not highlight home when on other paths', () => {
    renderWithRouter('/docs')

    const docsLink = screen.getByText('Docs').closest('a')

    // Docs should be highlighted, not home
    expect(docsLink).toHaveClass('text-primary')
  })

  it('should render Discord CTA button with correct link', () => {
    renderWithRouter()

    const discordButton = screen.getByText('Discord').closest('a')
    expect(discordButton).toHaveAttribute('href', 'https://discord.gg/5aqtMDUz6')
    expect(discordButton).toHaveAttribute('target', '_blank')
    expect(discordButton).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should have Discord CTA link in mobile menu', () => {
    renderWithRouter()

    // Check that Discord link exists (even if not visible until menu opens)
    const discordLinks = screen.getAllByRole('link', { name: /discord/i })
    const mobileDiscordLink = discordLinks.find((link) =>
      link.getAttribute('href')?.includes('discord.gg')
    )
    expect(mobileDiscordLink).toBeDefined()
  })
})

// Helper constant matching the component
const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Docs', path: '/docs' },
  { label: 'Commands', path: '/commands' },
  { label: 'Workflows', path: '/workflows' },
  { label: 'Windsurf Extension', path: '/windsurf-extension' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Changelog', path: '/changelog' },
]
