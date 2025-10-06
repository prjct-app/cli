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

  it('should display workflow commands with natural language trigger', () => {
    render(<Hero />)

    // The component shows natural language with commands
    expect(screen.getByText(/\/p:done/)).toBeInTheDocument()
  })
})
