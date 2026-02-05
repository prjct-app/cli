/**
 * Tests for AI Tools Formatters
 *
 * @see PRJ-122
 */

import { describe, expect, test } from 'bun:test'
import {
  formatForClaude,
  formatForContinue,
  formatForCopilot,
  formatForCursor,
  formatForWindsurf,
  getFormatter,
  type ProjectContext,
} from '../../ai-tools/formatters'
import { AI_TOOLS, getAIToolConfig } from '../../ai-tools/registry'

// =============================================================================
// Test Fixtures
// =============================================================================

const mockContext: ProjectContext = {
  projectId: 'test-project-id',
  name: 'test-project',
  version: '1.0.0',
  ecosystem: 'Node.js',
  projectType: 'library',
  languages: ['TypeScript'],
  frameworks: ['Hono'],
  repoPath: '/Users/test/project',
  branch: 'main',
  fileCount: 100,
  commits: 50,
  hasChanges: false,
  commands: {
    install: 'bun install',
    dev: 'bun run dev',
    test: 'bun test',
    build: 'bun run build',
    lint: 'bun run lint',
    format: 'bun run format',
  },
  agents: {
    workflow: ['prjct-planner', 'prjct-shipper'],
    domain: ['backend'],
  },
}

// =============================================================================
// Registry Tests
// =============================================================================

describe('AI Tools Registry', () => {
  test('cursor uses correct output file path', () => {
    expect(AI_TOOLS.cursor.outputFile).toBe('.cursor/rules/prjct.mdc')
  })

  test('windsurf uses correct output file path', () => {
    expect(AI_TOOLS.windsurf.outputFile).toBe('.windsurf/rules/prjct.md')
  })

  test('copilot uses correct output file path', () => {
    expect(AI_TOOLS.copilot.outputFile).toBe('.github/copilot-instructions.md')
  })

  test('claude uses correct output file path', () => {
    expect(AI_TOOLS.claude.outputFile).toBe('CLAUDE.md')
  })

  test('continue uses correct output file path', () => {
    expect(AI_TOOLS.continue.outputFile).toBe('.continue/config.json')
  })

  test('getAIToolConfig returns config for valid tool', () => {
    const config = getAIToolConfig('cursor')
    expect(config).not.toBeNull()
    expect(config?.id).toBe('cursor')
  })

  test('getAIToolConfig returns null for invalid tool', () => {
    const config = getAIToolConfig('invalid-tool')
    expect(config).toBeNull()
  })
})

// =============================================================================
// Formatter Tests
// =============================================================================

describe('formatForCursor', () => {
  const config = AI_TOOLS.cursor

  test('generates MDC format with YAML frontmatter', () => {
    const result = formatForCursor(mockContext, config)

    // Should start with YAML frontmatter
    expect(result.startsWith('---\n')).toBe(true)
    expect(result).toContain('description: prjct context for test-project')
    expect(result).toContain('alwaysApply: true')
    expect(result).toContain('---')
  })

  test('includes project info', () => {
    const result = formatForCursor(mockContext, config)

    expect(result).toContain('test-project')
    expect(result).toContain('library')
    expect(result).toContain('Node.js')
  })

  test('includes tech stack', () => {
    const result = formatForCursor(mockContext, config)

    expect(result).toContain('TypeScript')
    expect(result).toContain('Hono')
  })

  test('includes commands', () => {
    const result = formatForCursor(mockContext, config)

    expect(result).toContain('bun install')
    expect(result).toContain('bun run dev')
    expect(result).toContain('bun test')
    expect(result).toContain('bun run build')
  })
})

describe('formatForWindsurf', () => {
  const config = AI_TOOLS.windsurf

  test('generates MD format with YAML frontmatter', () => {
    const result = formatForWindsurf(mockContext, config)

    // Should start with YAML frontmatter
    expect(result.startsWith('---\n')).toBe(true)
    expect(result).toContain('description: prjct context for test-project')
    expect(result).toContain('trigger: always_on')
    expect(result).toContain('---')
  })

  test('uses trigger: always_on (not alwaysApply)', () => {
    const result = formatForWindsurf(mockContext, config)

    expect(result).toContain('trigger: always_on')
    expect(result).not.toContain('alwaysApply')
  })

  test('includes project info', () => {
    const result = formatForWindsurf(mockContext, config)

    expect(result).toContain('test-project')
    expect(result).toContain('library')
    expect(result).toContain('Node.js')
  })

  test('includes commands in bash block', () => {
    const result = formatForWindsurf(mockContext, config)

    expect(result).toContain('```bash')
    expect(result).toContain('bun install')
    expect(result).toContain('bun run dev')
    expect(result).toContain('bun test')
    expect(result).toContain('bun run build')
    expect(result).toContain('```')
  })
})

describe('formatForCopilot', () => {
  const config = AI_TOOLS.copilot

  test('generates minimal format without frontmatter', () => {
    const result = formatForCopilot(mockContext, config)

    // Copilot uses plain markdown, no YAML frontmatter
    expect(result.startsWith('# Copilot Instructions')).toBe(true)
    expect(result).not.toContain('---')
  })

  test('includes project info', () => {
    const result = formatForCopilot(mockContext, config)

    expect(result).toContain('test-project')
    expect(result).toContain('library')
    expect(result).toContain('Node.js')
  })

  test('includes essential commands only', () => {
    const result = formatForCopilot(mockContext, config)

    expect(result).toContain('bun test')
    expect(result).toContain('bun run build')
  })
})

describe('formatForClaude', () => {
  const config = AI_TOOLS.claude

  test('generates detailed markdown format', () => {
    const result = formatForClaude(mockContext, config)

    expect(result).toContain('# test-project - Project Rules')
    expect(result).toContain('<!-- projectId: test-project-id -->')
  })

  test('includes prjct workflow reference', () => {
    const result = formatForClaude(mockContext, config)

    expect(result).toContain('## PRJCT RULES')
    expect(result).toContain('p. sync')
    expect(result).toContain('p. task')
    expect(result).toContain('p. done')
    expect(result).toContain('p. ship')
  })

  test('includes commands table', () => {
    const result = formatForClaude(mockContext, config)

    expect(result).toContain('| Action | Command |')
    expect(result).toContain('bun install')
    expect(result).toContain('bun run dev')
  })

  test('includes agent references', () => {
    const result = formatForClaude(mockContext, config)

    expect(result).toContain('prjct-planner')
    expect(result).toContain('prjct-shipper')
    expect(result).toContain('backend')
  })
})

describe('formatForContinue', () => {
  const config = AI_TOOLS.continue

  test('generates valid JSON format', () => {
    const result = formatForContinue(mockContext, config)

    const parsed = JSON.parse(result)
    expect(parsed).toBeDefined()
  })

  test('includes system message with project info', () => {
    const result = formatForContinue(mockContext, config)
    const parsed = JSON.parse(result)

    expect(parsed.systemMessage).toContain('test-project')
    expect(parsed.systemMessage).toContain('library')
    expect(parsed.systemMessage).toContain('Node.js')
  })

  test('includes context providers', () => {
    const result = formatForContinue(mockContext, config)
    const parsed = JSON.parse(result)

    expect(parsed.contextProviders).toBeArray()
    expect(parsed.contextProviders.length).toBeGreaterThan(0)
    expect(parsed.contextProviders).toContainEqual({ name: 'code' })
    expect(parsed.contextProviders).toContainEqual({ name: 'diff' })
  })

  test('includes slash commands', () => {
    const result = formatForContinue(mockContext, config)
    const parsed = JSON.parse(result)

    expect(parsed.slashCommands).toBeArray()
    expect(parsed.slashCommands.length).toBeGreaterThan(0)
  })

  test('includes custom test command with project test command', () => {
    const result = formatForContinue(mockContext, config)
    const parsed = JSON.parse(result)

    expect(parsed.customCommands).toBeArray()
    const testCmd = parsed.customCommands.find((c: { name: string }) => c.name === 'test')
    expect(testCmd).toBeDefined()
    expect(testCmd.prompt).toContain('bun test')
  })
})

// =============================================================================
// getFormatter Tests
// =============================================================================

describe('getFormatter', () => {
  test('returns formatter for claude', () => {
    const formatter = getFormatter('claude')
    expect(formatter).toBe(formatForClaude)
  })

  test('returns formatter for cursor', () => {
    const formatter = getFormatter('cursor')
    expect(formatter).toBe(formatForCursor)
  })

  test('returns formatter for windsurf', () => {
    const formatter = getFormatter('windsurf')
    expect(formatter).toBe(formatForWindsurf)
  })

  test('returns formatter for copilot', () => {
    const formatter = getFormatter('copilot')
    expect(formatter).toBe(formatForCopilot)
  })

  test('returns formatter for continue', () => {
    const formatter = getFormatter('continue')
    expect(formatter).toBe(formatForContinue)
  })

  test('returns null for unknown tool', () => {
    const formatter = getFormatter('unknown-tool')
    expect(formatter).toBeNull()
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Formatter Edge Cases', () => {
  test('handles empty languages array', () => {
    const ctx = { ...mockContext, languages: [] }

    const cursorResult = formatForCursor(ctx, AI_TOOLS.cursor)
    expect(cursorResult).not.toContain('Languages:')

    const windsurfResult = formatForWindsurf(ctx, AI_TOOLS.windsurf)
    expect(windsurfResult).toContain('## Stack')
  })

  test('handles empty frameworks array', () => {
    const ctx = { ...mockContext, frameworks: [] }

    const cursorResult = formatForCursor(ctx, AI_TOOLS.cursor)
    expect(cursorResult).not.toContain('Frameworks:')

    const windsurfResult = formatForWindsurf(ctx, AI_TOOLS.windsurf)
    expect(windsurfResult).toContain('## Stack')
  })

  test('handles empty agents', () => {
    const ctx = { ...mockContext, agents: { workflow: [], domain: [] } }

    const claudeResult = formatForClaude(ctx, AI_TOOLS.claude)
    expect(claudeResult).toContain('**Domain**: none')
  })

  test('handles special characters in project name', () => {
    const ctx = { ...mockContext, name: '@scope/my-project' }

    const cursorResult = formatForCursor(ctx, AI_TOOLS.cursor)
    expect(cursorResult).toContain('@scope/my-project')

    const claudeResult = formatForClaude(ctx, AI_TOOLS.claude)
    expect(claudeResult).toContain('@scope/my-project')
  })
})
