import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Terminal } from '../../components/Terminal'

// Mock WorkflowMap component since it might have complex dependencies
vi.mock('../../components/WorkflowMap', () => ({
  default: () => <div data-testid="workflow-map">Workflow Map</div>,
}))

describe('Terminal Component', () => {
  it('should render terminal component', () => {
    const { container } = render(<Terminal />)

    // Terminal should render with some content
    expect(container.querySelector('[class*="rounded"]')).toBeInTheDocument()
  })

  it('should show workflow visualization', () => {
    render(<Terminal />)

    // WorkflowMap should be rendered (mocked)
    expect(screen.getByTestId('workflow-map')).toBeInTheDocument()
  })

  it('should render with styling', () => {
    const { container } = render(<Terminal />)

    // Terminal should have styled elements
    const styledElements = container.querySelectorAll('[class]')
    expect(styledElements.length).toBeGreaterThan(0)
  })
})
