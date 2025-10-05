import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '../../components/Hero'

describe('Hero Component', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    })
  })

  it('should render hero section with title', () => {
    render(<Hero />)

    expect(screen.getByText('prjct/')).toBeInTheDocument()
  })

  it('should display "Built for Claude Code" badge', () => {
    render(<Hero />)

    expect(screen.getByText(/Built for Claude Code/i)).toBeInTheDocument()
  })

  it('should display install command', () => {
    render(<Hero />)

    expect(screen.getByText(/npm install -g prjct-cli/i)).toBeInTheDocument()
  })

  it('should have install command button', () => {
    render(<Hero />)

    const button = screen.getByText('npm install -g prjct-cli').closest('button')
    expect(button).toBeInTheDocument()
  })

  it('should have terminal icon', () => {
    render(<Hero />)

    // Terminal component uses lucide-react icons which render as SVG
    const terminalIcons = document.querySelectorAll('svg')
    expect(terminalIcons.length).toBeGreaterThan(0)
  })

  it('should display workflow commands in subtitle', () => {
    render(<Hero />)

    // The subtitle should show natural language examples with p. trigger
    expect(screen.getByText(/p\. I want to add auth/i)).toBeInTheDocument()
    expect(screen.getByText(/p\. I want to add dark mode/i)).toBeInTheDocument()
    expect(screen.getByText(/p\. I'm done/i)).toBeInTheDocument()
    expect(screen.getByText(/p\. help/i)).toBeInTheDocument()
  })
})
