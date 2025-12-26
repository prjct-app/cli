/**
 * Prompt Builder Tests
 * Tests for optimized prompts with compressed rules
 *
 * OPTIMIZED: Tests updated to match compressed prompt structure
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import promptBuilder from '../../agentic/prompt-builder'

describe('PromptBuilder', () => {
  let builder: typeof promptBuilder

  beforeEach(() => {
    builder = promptBuilder
    builder.resetContext()
  })

  describe('Critical Rules (Compressed)', () => {
    it('should include git safety rules', () => {
      builder.setContext({ files: [], filteredSize: 0 })
      const rules = builder.buildCriticalRules()

      expect(rules).toContain('GIT SAFETY')
      expect(rules).toContain('checkout')
      expect(rules).toContain('reset')
    })

    it('should include read-first requirement', () => {
      builder.setContext({ files: [], filteredSize: 0 })
      const rules = builder.buildCriticalRules()

      expect(rules).toContain('READ FIRST')
      expect(rules).toContain('Read tool')
    })

    it('should include pattern matching requirement', () => {
      builder.setContext({ files: [], filteredSize: 0 })
      const rules = builder.buildCriticalRules()

      expect(rules).toContain('MATCH PATTERNS')
    })

    it('should include no-hallucination rules', () => {
      builder.setContext({ files: [], filteredSize: 0 })
      const rules = builder.buildCriticalRules()

      expect(rules).toContain('NO HALLUCINATIONS')
    })

    it('should show file count in context', () => {
      builder.setContext({ files: ['a.js', 'b.js', 'c.js'] })
      const rules = builder.buildCriticalRules()

      expect(rules).toContain('3 files available')
    })
  })

  describe('State Filtering', () => {
    it('should preserve full content for critical files', () => {
      const state = {
        now: '# NOW\n\n**Test task**\n\nStarted: 2025-01-01',
        next: '# NEXT\n\n## Priority Queue\n\n1. Task 1',
        context: 'Project context information',
        analysis: 'Stack: Node.js\nPatterns: ES6 modules',
        metrics: 'Some metrics data'
      }

      const filtered = builder.filterRelevantState(state)

      expect(filtered).toContain('### now')
      expect(filtered).toContain('Test task')
      expect(filtered).toContain('### next')
      expect(filtered).toContain('### context')
      expect(filtered).toContain('### analysis')
    })

    it('should truncate large non-critical files', () => {
      const largeContent = 'x'.repeat(2000)
      const state = {
        now: '# NOW\n\n**Task**',
        largeFile: largeContent
      }

      const filtered = builder.filterRelevantState(state)

      expect(filtered).toContain('### now')
      expect(filtered).toContain('### largeFile')
      expect(filtered).toContain('truncated')
    })

    it('should return null for empty state', () => {
      const filtered = builder.filterRelevantState({})
      expect(filtered).toBeNull()
    })
  })

  describe('Context Filtering by Command Type', () => {
    it('should include patterns for code commands', () => {
      const template = {
        frontmatter: { description: 'Build feature', name: 'p:build' },
        content: '## Flow\nBuild something'
      }

      const context = { projectPath: '/test', files: ['file1.js'] }
      const state = { analysis: 'Stack: Node.js, React' }

      const prompt = builder.build(template, context, state)

      expect(prompt).toContain('PATTERNS')
      expect(prompt).toContain('Node.js')
    })

    it('should NOT include patterns for non-code commands', () => {
      const template = {
        frontmatter: { description: 'Show current task', name: 'p:now' },
        content: '## Flow\nShow task'
      }

      const context = { projectPath: '/test', files: ['file1.js'] }
      const state = { analysis: 'Stack: Node.js, React' }

      const prompt = builder.build(template, context, state)

      expect(prompt).not.toContain('## PATTERNS')
    })
  })

  describe('Project Files Listing', () => {
    it('should list available files when context has files', () => {
      const template = {
        frontmatter: { description: 'Test command' },
        content: '## Flow\nDo something'
      }

      const context = {
        projectPath: '/test',
        files: ['src/file1.js', 'src/file2.js', 'tests/test1.js']
      }

      const state = {}

      const prompt = builder.build(template, context, state)

      expect(prompt).toContain('## FILES:')
      expect(prompt).toContain('3 available')
      expect(prompt).toContain('file1.js')
      expect(prompt).toContain('Read')
    })

    it('should show project path when no files listed', () => {
      const template = {
        frontmatter: { description: 'Test command' },
        content: '## Flow\nDo something'
      }

      const context = { projectPath: '/test/project' }
      const state = {}

      const prompt = builder.build(template, context, state)

      expect(prompt).toContain('## PROJECT:')
      expect(prompt).toContain('/test/project')
    })
  })

  describe('Build Complete Prompt', () => {
    it('should include all critical sections', () => {
      const template = {
        frontmatter: {
          description: 'Test command',
          'allowed-tools': ['Read', 'Write']
        },
        content: '## Flow\n1. Do step 1\n2. Do step 2'
      }

      const context = {
        projectPath: '/test',
        params: { task: 'test task' },
        files: ['file1.js']
      }

      const state = { now: '# NOW\n\n**Current task**' }

      const prompt = builder.build(template, context, state)

      expect(prompt).toContain('TASK:')
      expect(prompt).toContain('TOOLS:')
      expect(prompt).toContain('Flow')
      expect(prompt).toContain('RULES (CRITICAL)')
      expect(prompt).toContain('## FILES:')
    })

    it('should be concise (under 2000 chars for simple prompt)', () => {
      const template = {
        frontmatter: { description: 'Test', 'allowed-tools': ['Read'] },
        content: '## Flow\n1. Test'
      }

      const context = { projectPath: '/test', files: ['a.js'] }
      const state = {}

      const prompt = builder.build(template, context, state)

      expect(prompt.length).toBeLessThan(2000)
    })
  })

  describe('Plan Mode (Compressed)', () => {
    it('should include compact plan mode instructions', () => {
      const template = {
        frontmatter: { description: 'Test' },
        content: '## Flow\nTest'
      }

      const context = { projectPath: '/test' }
      const state = {}
      const planInfo = { isPlanning: true, allowedTools: ['Read', 'Glob'] }

      const prompt = builder.build(template, context, state, null, null, null, null, planInfo)

      expect(prompt).toContain('PLAN MODE')
      expect(prompt).toContain('Read-only')
      expect(prompt).toContain('Tools: Read, Glob')
    })

    it('should include approval required section', () => {
      const template = {
        frontmatter: { description: 'Test' },
        content: '## Flow\nTest'
      }

      const context = { projectPath: '/test' }
      const state = {}
      const planInfo = { requiresApproval: true }

      const prompt = builder.build(template, context, state, null, null, null, null, planInfo)

      expect(prompt).toContain('APPROVAL REQUIRED')
      expect(prompt).toContain('confirmation')
    })
  })
})
