import { describe, it, expect } from 'vitest'
import promptBuilder from '../../agentic/prompt-builder.js'

describe('Prompt Builder', () => {
  const mockTemplate = {
    frontmatter: {
      'allowed-tools': ['Read', 'Write', 'Bash'],
    },
    content: '# Command: Test\n\nExecute test command.',
  }

  const mockContext = {
    projectId: 'test-project-123',
    projectPath: '/test/path',
    globalPath: '/global/path',
    timestamp: '2025-10-04T12:00:00Z',
    date: '2025-10-04',
    params: {},
    paths: {
      now: '/global/path/core/now.md',
      next: '/global/path/core/next.md',
    },
  }

  const mockState = {
    now: '# Current Task\n\nTest task in progress',
    next: '# Priority Queue\n\nTask 1, Task 2',
    context: null, // Simulate non-existent file
  }

  describe('build()', () => {
    it('should build a complete prompt', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toBeDefined()
      expect(typeof prompt).toBe('string')
      expect(prompt.length).toBeGreaterThan(0)
    })

    it('should include command instructions', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('# Command Instructions')
      expect(prompt).toContain('Execute test command')
    })

    it('should include allowed tools', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('## Allowed Tools')
      expect(prompt).toContain('Read, Write, Bash')
    })

    it('should include project context', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('## Project Context')
      expect(prompt).toContain('Project ID: test-project-123')
      expect(prompt).toContain('Timestamp: 2025-10-04T12:00:00Z')
    })

    it('should include current state', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('## Current State')
      expect(prompt).toContain('### now')
      expect(prompt).toContain('Test task in progress')
      expect(prompt).toContain('### next')
      expect(prompt).toContain('Task 1, Task 2')
    })

    it('should exclude null or empty state values', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should not include 'context' since it's null
      expect(prompt).not.toContain('### context')
    })

    it('should include parameters when present', () => {
      const contextWithParams = {
        ...mockContext,
        params: {
          taskName: 'Test Task',
          feature: 'Test Feature',
        },
      }

      const prompt = promptBuilder.build(mockTemplate, contextWithParams, mockState)

      expect(prompt).toContain('## Parameters')
      expect(prompt).toContain('taskName: Test Task')
      expect(prompt).toContain('feature: Test Feature')
    })

    it('should exclude parameters section when empty', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should not include Parameters section since params is empty
      const hasParametersSection = prompt.includes('## Parameters')
      expect(hasParametersSection).toBe(false)
    })

    it('should include final execution instructions', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('## Execute')
      expect(prompt).toContain('execute the command')
      expect(prompt).toContain('Use ONLY the allowed tools')
      expect(prompt).toContain('do not follow rigid if/else rules')
    })

    it('should handle template without allowed-tools', () => {
      const templateNoTools = {
        frontmatter: {},
        content: 'Simple command',
      }

      const prompt = promptBuilder.build(templateNoTools, mockContext, mockState)

      expect(prompt).toBeDefined()
      expect(prompt).toContain('Simple command')
      // Should not have Allowed Tools section
      expect(prompt).not.toContain('## Allowed Tools')
    })

    it('should handle empty state', () => {
      const emptyState = {}

      const prompt = promptBuilder.build(mockTemplate, mockContext, emptyState)

      expect(prompt).toBeDefined()
      expect(prompt).toContain('## Current State')
      // But no actual state entries
    })

    it('should format state content in code blocks', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('```')
      expect(prompt).toMatch(/```\n# Current Task/)
    })
  })

  describe('buildAnalysis()', () => {
    it('should build analysis prompt', () => {
      const prompt = promptBuilder.buildAnalysis('repository', mockContext)

      expect(prompt).toBeDefined()
      expect(typeof prompt).toBe('string')
    })

    it('should include analysis type', () => {
      const prompt = promptBuilder.buildAnalysis('repository', mockContext)

      expect(prompt).toContain('# Analyze: repository')
    })

    it('should include project context', () => {
      const prompt = promptBuilder.buildAnalysis('repository', mockContext)

      expect(prompt).toContain('## Project Context')
      expect(prompt).toContain('Path: /test/path')
      expect(prompt).toContain('ID: test-project-123')
    })

    it('should include analysis instructions', () => {
      const prompt = promptBuilder.buildAnalysis('repository', mockContext)

      expect(prompt).toContain('Read the project context')
      expect(prompt).toContain('provide your analysis')
      expect(prompt).toContain('No predetermined patterns')
    })

    it('should work with different analysis types', () => {
      const types = ['repository', 'feature', 'bug', 'performance']

      types.forEach((type) => {
        const prompt = promptBuilder.buildAnalysis(type, mockContext)
        expect(prompt).toContain(`# Analyze: ${type}`)
      })
    })
  })

  describe('Prompt Structure', () => {
    it('should have clear sections in order', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      const instructionsIndex = prompt.indexOf('# Command Instructions')
      const toolsIndex = prompt.indexOf('## Allowed Tools')
      const contextIndex = prompt.indexOf('## Project Context')
      const stateIndex = prompt.indexOf('## Current State')
      const executeIndex = prompt.indexOf('## Execute')

      expect(instructionsIndex).toBeGreaterThan(-1)
      expect(toolsIndex).toBeGreaterThan(instructionsIndex)
      expect(contextIndex).toBeGreaterThan(toolsIndex)
      expect(stateIndex).toBeGreaterThan(contextIndex)
      expect(executeIndex).toBeGreaterThan(stateIndex)
    })

    it('should use proper markdown formatting', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should have proper headings
      expect(prompt).toMatch(/^# /m)
      expect(prompt).toMatch(/^## /m)

      // Should have code blocks
      expect(prompt).toContain('```')
    })
  })
})
