/**
 * Response Validator & LLM Output Schema Tests
 *
 * Tests for:
 * - JSON parsing (plain, markdown-wrapped)
 * - Zod schema validation of LLM responses
 * - Re-prompt message generation
 * - Schema-to-prompt rendering
 * - Classification schema validation
 * - Agent assignment schema validation
 * - Subtask breakdown schema validation
 *
 * @see PRJ-264
 */

import { describe, expect, it } from 'bun:test'
import { buildReprompt, validateLLMResponse } from '../../agentic/response-validator'
import { TaskClassificationSchema } from '../../schemas/classification'
import {
  AgentAssignmentSchema,
  OUTPUT_SCHEMAS,
  renderSchemaForPrompt,
  SubtaskBreakdownSchema,
} from '../../schemas/llm-output'
import type { ValidationFailure } from '../../types/agentic'

// =============================================================================
// validateLLMResponse
// =============================================================================

describe('validateLLMResponse', () => {
  it('should parse valid JSON and validate against schema', () => {
    const raw = JSON.stringify({
      primaryDomain: 'backend',
      secondaryDomains: ['database'],
      confidence: 0.9,
      filePatterns: ['src/api/**'],
      relevantAgents: ['backend.md'],
    })

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryDomain).toBe('backend')
      expect(result.data.confidence).toBe(0.9)
    }
  })

  it('should handle markdown-wrapped JSON', () => {
    const raw =
      '```json\n{"primaryDomain":"frontend","secondaryDomains":[],"confidence":0.85,"filePatterns":[],"relevantAgents":[]}\n```'

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.primaryDomain).toBe('frontend')
    }
  })

  it('should handle markdown-wrapped JSON without language tag', () => {
    const raw =
      '```\n{"primaryDomain":"frontend","secondaryDomains":[],"confidence":0.85,"filePatterns":[],"relevantAgents":[]}\n```'

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(true)
  })

  it('should fail on non-JSON response', () => {
    const raw = 'This task is about backend development.'

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not valid JSON')
    }
  })

  it('should fail on valid JSON with wrong schema', () => {
    const raw = JSON.stringify({
      primaryDomain: 'invalid-domain',
      secondaryDomains: [],
      confidence: 0.9,
      filePatterns: [],
      relevantAgents: [],
    })

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0)
      expect(result.rawParsed).toBeTruthy()
    }
  })

  it('should fail on missing required fields', () => {
    const raw = JSON.stringify({
      primaryDomain: 'backend',
      // missing: secondaryDomains, confidence, filePatterns, relevantAgents
    })

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.length).toBeGreaterThan(0)
    }
  })

  it('should validate agent assignment schema', () => {
    const raw = JSON.stringify({
      agentName: 'backend.md',
      reasoning: 'Task involves API work',
      confidence: 0.85,
    })

    const result = validateLLMResponse(raw, AgentAssignmentSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.agentName).toBe('backend.md')
    }
  })

  it('should validate subtask breakdown schema', () => {
    const raw = JSON.stringify({
      subtasks: [
        {
          description: 'Add validation',
          domain: 'backend',
          agent: 'backend.md',
          dependsOn: [],
        },
      ],
      effort: 'medium',
    })

    const result = validateLLMResponse(raw, SubtaskBreakdownSchema)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.subtasks).toHaveLength(1)
      expect(result.data.effort).toBe('medium')
    }
  })

  it('should reject subtask breakdown with invalid effort', () => {
    const raw = JSON.stringify({
      subtasks: [],
      effort: 'extreme',
    })

    const result = validateLLMResponse(raw, SubtaskBreakdownSchema)
    expect(result.success).toBe(false)
  })

  it('should handle confidence out of range', () => {
    const raw = JSON.stringify({
      primaryDomain: 'backend',
      secondaryDomains: [],
      confidence: 1.5, // out of range
      filePatterns: [],
      relevantAgents: [],
    })

    const result = validateLLMResponse(raw, TaskClassificationSchema)
    expect(result.success).toBe(false)
  })
})

// =============================================================================
// buildReprompt
// =============================================================================

describe('buildReprompt', () => {
  it('should generate a re-prompt message with errors', () => {
    const failure: ValidationFailure = {
      success: false,
      error: 'Schema validation failed',
      rawParsed: { primaryDomain: 'invalid' },
      issues: ['primaryDomain: Invalid enum value'],
    }

    const reprompt = buildReprompt(failure, '{"primaryDomain":"backend"}')
    expect(reprompt).toContain('not valid')
    expect(reprompt).toContain('primaryDomain: Invalid enum value')
    expect(reprompt).toContain('{"primaryDomain":"backend"}')
  })

  it('should include all issues in the message', () => {
    const failure: ValidationFailure = {
      success: false,
      error: 'Multiple errors',
      rawParsed: {},
      issues: ['field1: Required', 'field2: Expected number'],
    }

    const reprompt = buildReprompt(failure, '{}')
    expect(reprompt).toContain('field1: Required')
    expect(reprompt).toContain('field2: Expected number')
  })
})

// =============================================================================
// renderSchemaForPrompt
// =============================================================================

describe('renderSchemaForPrompt', () => {
  it('should render classification schema for prompt', () => {
    const rendered = renderSchemaForPrompt('classification')
    expect(rendered).toBeTruthy()
    expect(rendered).toContain('OUTPUT FORMAT')
    expect(rendered).toContain('primaryDomain')
    expect(rendered).toContain('confidence')
  })

  it('should render agent assignment schema', () => {
    const rendered = renderSchemaForPrompt('agentAssignment')
    expect(rendered).toBeTruthy()
    expect(rendered).toContain('agentName')
    expect(rendered).toContain('reasoning')
  })

  it('should render subtask breakdown schema', () => {
    const rendered = renderSchemaForPrompt('subtaskBreakdown')
    expect(rendered).toBeTruthy()
    expect(rendered).toContain('subtasks')
    expect(rendered).toContain('effort')
  })

  it('should return null for unknown schema type', () => {
    const rendered = renderSchemaForPrompt('nonexistent')
    expect(rendered).toBeNull()
  })
})

// =============================================================================
// OUTPUT_SCHEMAS Registry
// =============================================================================

describe('OUTPUT_SCHEMAS registry', () => {
  it('should have classification entry', () => {
    expect(OUTPUT_SCHEMAS.classification).toBeTruthy()
    expect(OUTPUT_SCHEMAS.classification.schema).toBe(TaskClassificationSchema)
  })

  it('should have agentAssignment entry', () => {
    expect(OUTPUT_SCHEMAS.agentAssignment).toBeTruthy()
  })

  it('should have subtaskBreakdown entry', () => {
    expect(OUTPUT_SCHEMAS.subtaskBreakdown).toBeTruthy()
  })

  it('should have valid JSON examples', () => {
    for (const entry of Object.values(OUTPUT_SCHEMAS)) {
      const parsed = JSON.parse(entry.example)
      expect(parsed).toBeTruthy()
      // Examples should validate against their own schema
      const result = entry.schema.safeParse(parsed)
      expect(result.success).toBe(true)
    }
  })
})
