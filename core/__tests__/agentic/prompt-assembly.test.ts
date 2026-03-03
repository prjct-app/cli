/**
 * Prompt Assembly Tests (PRJ-301)
 *
 * Tests for the redesigned prompt assembly:
 * - Section ordering (Identity → Env → Ground Truth → ... → Efficiency)
 * - Environment block generation
 * - Anti-hallucination block generation
 * - Token efficiency directive
 * - Budget trimming with priorities
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import { buildAntiHallucinationBlock } from '../../agentic/anti-hallucination'
import { buildEnvironmentBlock } from '../../agentic/environment-block'
import promptBuilder, { PROMPT_SECTION_ORDER } from '../../agentic/prompt-builder'
import type { EnvironmentBlockInput, ProjectGroundTruth } from '../../types/agentic'

// =============================================================================
// Environment Block
// =============================================================================

describe('Environment Block (PRJ-301)', () => {
  it('should generate <env> block with all fields', () => {
    const input: EnvironmentBlockInput = {
      projectName: 'my-app',
      projectPath: '/home/user/my-app',
      isGitRepo: true,
      gitBranch: 'feature/login',
      platform: 'darwin',
      runtime: 'bun',
      date: '2026-02-07',
      model: 'opus',
      provider: 'claude',
    }

    const block = buildEnvironmentBlock(input)

    expect(block).toContain('<env>')
    expect(block).toContain('</env>')
    expect(block).toContain('project: my-app')
    expect(block).toContain('path: /home/user/my-app')
    expect(block).toContain('git: true')
    expect(block).toContain('branch: feature/login')
    expect(block).toContain('platform: macOS')
    expect(block).toContain('runtime: bun')
    expect(block).toContain('date: 2026-02-07')
    expect(block).toContain('model: opus')
    expect(block).toContain('provider: claude')
  })

  it('should omit undefined fields', () => {
    const input: EnvironmentBlockInput = {
      projectName: 'my-app',
      projectPath: '/test',
    }

    const block = buildEnvironmentBlock(input)

    expect(block).toContain('project: my-app')
    expect(block).toContain('path: /test')
    expect(block).not.toContain('model:')
    expect(block).not.toContain('provider:')
    expect(block).not.toContain('branch:')
  })

  it('should normalize platform names', () => {
    expect(
      buildEnvironmentBlock({ projectName: 'x', projectPath: '/x', platform: 'darwin' })
    ).toContain('platform: macOS')
    expect(
      buildEnvironmentBlock({ projectName: 'x', projectPath: '/x', platform: 'linux' })
    ).toContain('platform: Linux')
    expect(
      buildEnvironmentBlock({ projectName: 'x', projectPath: '/x', platform: 'win32' })
    ).toContain('platform: Windows')
  })

  it('should auto-detect runtime and date when not provided', () => {
    const block = buildEnvironmentBlock({ projectName: 'x', projectPath: '/x' })

    // Should have a runtime (bun or node)
    expect(block).toMatch(/runtime: (bun|node)/)
    // Should have a date in YYYY-MM-DD format
    expect(block).toMatch(/date: \d{4}-\d{2}-\d{2}/)
  })
})

// =============================================================================
// Anti-Hallucination Block
// =============================================================================

describe('Anti-Hallucination Block (PRJ-301)', () => {
  it('should generate constraints block with availability', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/home/user/my-app',
      language: 'TypeScript',
      framework: 'Hono',
      techStack: ['Hono', 'Zod', 'Vitest'],
      domains: {
        hasFrontend: false,
        hasBackend: true,
        hasDatabase: false,
        hasTesting: true,
        hasDocker: false,
      },
      fileCount: 292,
    }

    const block = buildAntiHallucinationBlock(truth)

    // Section header
    expect(block).toContain('CONSTRAINTS (Read Before Acting)')

    // Availability
    expect(block).toContain('AVAILABLE in this project: TypeScript, Hono, Zod, Vitest')

    // Unavailability (no frontend, no database, no docker)
    expect(block).toContain('NOT PRESENT:')
    expect(block).toContain('frontend')
    expect(block).toContain('database')
    expect(block).toContain('docker')

    // Should NOT list present domains as absent
    expect(block).not.toContain('NOT PRESENT: Backend')
    expect(block).not.toContain('NOT PRESENT: Testing')

    // No agents section
    expect(block).not.toContain('AGENTS:')

    // Grounding rules
    expect(block).toContain('SCOPE: Only files in `/home/user/my-app` are accessible.')

    // File count
    expect(block).toContain('292 files in project')
  })

  it('should handle minimal input', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
    }

    const block = buildAntiHallucinationBlock(truth)

    expect(block).toContain('CONSTRAINTS')
    expect(block).toContain('SCOPE: Only files in `/test` are accessible.')
    // Should not have AVAILABLE or NOT PRESENT lines
    expect(block).not.toContain('AVAILABLE in this project:')
    expect(block).not.toContain('NOT PRESENT:')
  })

  it('should not duplicate framework in techStack listing', () => {
    const truth: ProjectGroundTruth = {
      projectPath: '/test',
      language: 'TypeScript',
      framework: 'Next.js',
      techStack: ['Next.js', 'React', 'Tailwind'],
    }

    const block = buildAntiHallucinationBlock(truth)

    // Next.js should appear once (from framework), not duplicated from techStack
    const matches = block.match(/Next\.js/g)
    expect(matches?.length).toBe(1)
  })
})

// =============================================================================
// Section Ordering
// =============================================================================

describe('Prompt Section Ordering (PRJ-301)', () => {
  let builder: typeof promptBuilder

  beforeEach(() => {
    builder = promptBuilder
    builder.resetContext()
  })

  it('should define correct section order constant', () => {
    expect(PROMPT_SECTION_ORDER).toEqual([
      'identity',
      'environment',
      'ground_truth',
      'capabilities',
      'constraints',
      'task_context',
      'task',
      'output_schema',
      'efficiency',
    ])
  })

  it('should place environment block before constraints', async () => {
    const template = {
      frontmatter: { description: 'Test', 'allowed-tools': ['Read'] },
      content: '## Instructions\nDo the thing',
    }
    const context = { projectPath: '/test', files: ['a.js'] }

    const prompt = await builder.build(template, context, {})

    const envPos = prompt.indexOf('<env>')
    const constraintsPos = prompt.indexOf('CONSTRAINTS')
    expect(envPos).toBeGreaterThan(-1)
    expect(constraintsPos).toBeGreaterThan(-1)
    expect(envPos).toBeLessThan(constraintsPos)
  })

  it('should place constraints before task template content', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## UNIQUE_TEMPLATE_MARKER\nFollow these steps',
    }
    const context = { projectPath: '/test', files: ['a.js'] }

    const prompt = await builder.build(template, context, {})

    const constraintsPos = prompt.indexOf('CONSTRAINTS')
    const templatePos = prompt.indexOf('UNIQUE_TEMPLATE_MARKER')
    expect(constraintsPos).toBeGreaterThan(-1)
    expect(templatePos).toBeGreaterThan(-1)
    expect(constraintsPos).toBeLessThan(templatePos)
  })

  it('should place identity (TASK:) at the beginning', async () => {
    const template = {
      frontmatter: { description: 'My Task' },
      content: '## Flow\nStep 1',
    }
    const context = { projectPath: '/test' }

    const prompt = await builder.build(template, context, {})

    const taskPos = prompt.indexOf('TASK: My Task')
    expect(taskPos).toBeLessThan(50)
  })

  it('should include static efficiency directive', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Flow\nStep 1',
    }
    const context = { projectPath: '/test' }

    const prompt = await builder.build(template, context, {})

    expect(prompt).toContain('EFFICIENCY')
    expect(prompt).toContain('Be concise')
    expect(prompt).toContain('sub-agents')
    // Should NOT contain dynamic zone warnings without health monitor
    expect(prompt).not.toContain('CONTEXT WARNING')
    expect(prompt).not.toContain('CONTEXT CRITICAL')
  })
})

// =============================================================================
// Token Efficiency Directive
// =============================================================================

describe('Token Efficiency Directive (PRJ-301)', () => {
  let builder: typeof promptBuilder

  beforeEach(() => {
    builder = promptBuilder
    builder.resetContext()
  })

  it('should include efficiency directive with static rules', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Flow\nStep 1',
    }
    const context = { projectPath: '/test' }

    const prompt = await builder.build(template, context, {})

    expect(prompt).toContain('EFFICIENCY')
    expect(prompt).toContain('Be concise')
  })

  it('should build efficiency directive with static rules', () => {
    const directive = builder.buildEfficiencyDirective()

    expect(directive).toContain('EFFICIENCY')
    expect(directive).toContain('Be concise')
    expect(directive).toContain('sub-agents')
    expect(directive).toContain('file:line')
  })
})
