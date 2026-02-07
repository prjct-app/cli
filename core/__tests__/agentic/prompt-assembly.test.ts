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
import {
  buildAntiHallucinationBlock,
  type ProjectGroundTruth,
} from '../../agentic/anti-hallucination'
import { buildEnvironmentBlock, type EnvironmentBlockInput } from '../../agentic/environment-block'
import promptBuilder, { PROMPT_SECTION_ORDER } from '../../agentic/prompt-builder'

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
      availableAgents: ['backend', 'testing'],
    }

    const block = buildAntiHallucinationBlock(truth)

    // Section header
    expect(block).toContain('CONSTRAINTS (Read Before Acting)')

    // Availability
    expect(block).toContain('AVAILABLE in this project: TypeScript, Hono, Zod, Vitest')

    // Unavailability (no frontend, no database, no docker)
    expect(block).toContain('NOT PRESENT:')
    expect(block).toContain('Frontend (UI/components)')
    expect(block).toContain('Database (SQL/ORM)')
    expect(block).toContain('Docker/containers')

    // Should NOT list present domains as absent
    expect(block).not.toContain('NOT PRESENT: Backend')
    expect(block).not.toContain('NOT PRESENT: Testing')

    // Agents
    expect(block).toContain('AGENTS: backend, testing')

    // Grounding rules
    expect(block).toContain('SCOPE: Only files in `/home/user/my-app` are accessible.')
    expect(block).toContain('Do NOT infer or guess paths')
    expect(block).toContain('NEVER assume a library is available')
    expect(block).toContain('trust this section')

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

  it('should place efficiency directive at the end', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Flow\nStep 1',
    }
    const context = { projectPath: '/test' }

    const prompt = await builder.build(template, context, {})

    const efficiencyPos = prompt.indexOf('OUTPUT RULES')
    const executePos = prompt.indexOf('EXECUTE:')
    expect(efficiencyPos).toBeGreaterThan(-1)
    expect(executePos).toBeGreaterThan(-1)
    // Should be in the last ~300 chars of the prompt
    expect(prompt.length - executePos).toBeLessThan(300)
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

  it('should include efficiency rules in every prompt', async () => {
    const template = {
      frontmatter: { description: 'Test' },
      content: '## Flow\nStep 1',
    }
    const context = { projectPath: '/test' }

    const prompt = await builder.build(template, context, {})

    expect(prompt).toContain('OUTPUT RULES')
    expect(prompt).toContain('Be concise')
    expect(prompt).toContain('No preamble')
    expect(prompt).toContain('No postamble')
    expect(prompt).toContain('EXECUTE:')
  })

  it('should build efficiency directive as standalone method', () => {
    const directive = builder.buildEfficiencyDirective()

    expect(directive).toContain('Maximum 4 lines')
    expect(directive).toContain('No preamble')
    expect(directive).toContain('Prefer structured output')
    expect(directive).toContain('EXECUTE:')
  })
})
