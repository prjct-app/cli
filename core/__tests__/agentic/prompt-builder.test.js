import { describe, it, expect } from 'vitest'
import promptBuilder from '../../agentic/prompt-builder.js'

describe('Prompt Builder', () => {
  const mockTemplate = {
    frontmatter: {
      'allowed-tools': ['Read', 'Write', 'Bash'],
      description: 'Execute test command',
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

      expect(prompt).toContain('TASK: Execute test command')
    })

    it('should include allowed tools', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('TOOLS: Read, Write, Bash')
    })

    it('should include project context', () => {
      // Context is now handled differently in the new prompt builder (filtered context)
      // The prompt builder doesn't explicitly list project ID/Timestamp anymore in the main prompt
      // It focuses on the task and tools
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)
      expect(prompt).toBeDefined()
    })

    it('should include current state', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('STATE:')
      expect(prompt).toContain('now: # Current Task')
      expect(prompt).toContain('Test task in progress')
      expect(prompt).toContain('next: # Priority Queue')
      expect(prompt).toContain('Task 1, Task 2')
    })

    it('should exclude null or empty state values', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should not include 'context' since it's null
      expect(prompt).not.toContain('context:')
    })

    it('should include parameters when present', () => {
      const contextWithParams = {
        ...mockContext,
        params: {
          task: 'Test Task',
          description: 'Test Feature',
        },
      }

      const prompt = promptBuilder.build(mockTemplate, contextWithParams, mockState)

      expect(prompt).toContain('INPUT: Test Task')
    })

    it('should exclude parameters section when empty', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should not include INPUT section since params is empty
      const hasInputSection = prompt.includes('INPUT:')
      expect(hasInputSection).toBe(false)
    })

    it('should include final execution instructions', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('## PROCESS ENFORCEMENT')
      expect(prompt).toContain('FOLLOW the Flow strictly')
      expect(prompt).toContain('EXECUTE: Follow flow. Use tools. Decide.')
    })

    it('should handle template without allowed-tools', () => {
      const templateNoTools = {
        frontmatter: {},
        content: 'Simple command',
      }

      const prompt = promptBuilder.build(templateNoTools, mockContext, mockState)

      expect(prompt).toBeDefined()
      expect(prompt).toContain('Simple command')
      // Should not have TOOLS section
      expect(prompt).not.toContain('TOOLS:')
    })

    it('should handle empty state', () => {
      const emptyState = {}

      const prompt = promptBuilder.build(mockTemplate, mockContext, emptyState)

      expect(prompt).toBeDefined()
      expect(prompt).not.toContain('STATE:')
    })

    it('should format state content', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      expect(prompt).toContain('STATE:')
      expect(prompt).toContain('now: # Current Task')
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

      const taskIndex = prompt.indexOf('TASK:')
      const toolsIndex = prompt.indexOf('TOOLS:')
      const stateIndex = prompt.indexOf('STATE:')
      const enforcementIndex = prompt.indexOf('## PROCESS ENFORCEMENT')
      const executeIndex = prompt.indexOf('EXECUTE:')

      expect(taskIndex).toBeGreaterThan(-1)
      expect(toolsIndex).toBeGreaterThan(taskIndex)
      expect(stateIndex).toBeGreaterThan(toolsIndex)
      expect(enforcementIndex).toBeGreaterThan(stateIndex)
      expect(executeIndex).toBeGreaterThan(enforcementIndex)
    })

    it('should use proper formatting', () => {
      const prompt = promptBuilder.build(mockTemplate, mockContext, mockState)

      // Should have proper headings
      expect(prompt).toContain('TASK:')
      expect(prompt).toContain('TOOLS:')
    })
  })
})
