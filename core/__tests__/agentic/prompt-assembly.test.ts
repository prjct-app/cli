/**
 * Prompt Assembly Tests (PRJ-301)
 *
 * Tests for the redesigned prompt assembly:
 * - Section ordering (Identity → Env → Ground Truth → ... → Efficiency)
 * - Token efficiency in built prompts
 */

import { beforeEach, describe, expect, it } from 'bun:test'
import promptBuilder, { PROMPT_SECTION_ORDER } from '../../agentic/prompt-builder'

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
})
