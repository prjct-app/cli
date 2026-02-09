/**
 * Subtask Handoff Tests (PRJ-262)
 *
 * Tests for mandatory subtask output and handoff:
 * - SubtaskCompletionDataSchema validation
 * - SubtaskSummarySchema required fields
 * - validateSubtaskCompletion helper
 * - Backward compatibility with old state.json
 */

import { describe, expect, it } from 'bun:test'
import {
  SubtaskCompletionDataSchema,
  SubtaskSchema,
  SubtaskSummarySchema,
  validateSubtaskCompletion,
} from '../../schemas/state'

// =============================================================================
// SubtaskSummarySchema — outputForNextAgent is now required
// =============================================================================

describe('SubtaskSummarySchema', () => {
  const validSummary = {
    title: 'Implement auth middleware',
    description: 'Added JWT verification to all protected routes',
    filesChanged: [
      { path: 'src/middleware/auth.ts', action: 'created' as const },
      { path: 'src/routes/api.ts', action: 'modified' as const },
    ],
    whatWasDone: ['Created JWT middleware', 'Applied to API routes'],
    outputForNextAgent:
      'Auth middleware is in place. Next subtask should add role-based access control.',
  }

  it('should parse a valid summary with all required fields', () => {
    const result = SubtaskSummarySchema.parse(validSummary)
    expect(result.outputForNextAgent).toBe(validSummary.outputForNextAgent)
    expect(result.whatWasDone).toHaveLength(2)
  })

  it('should reject missing outputForNextAgent', () => {
    const { outputForNextAgent, ...withoutOutput } = validSummary
    expect(() => SubtaskSummarySchema.parse(withoutOutput)).toThrow()
  })

  it('should reject empty outputForNextAgent', () => {
    expect(() => SubtaskSummarySchema.parse({ ...validSummary, outputForNextAgent: '' })).toThrow()
  })

  it('should reject empty whatWasDone array', () => {
    expect(() => SubtaskSummarySchema.parse({ ...validSummary, whatWasDone: [] })).toThrow()
  })

  it('should allow optional notes', () => {
    const result = SubtaskSummarySchema.parse({ ...validSummary, notes: 'Watch for rate limits' })
    expect(result.notes).toBe('Watch for rate limits')
  })

  it('should allow missing notes', () => {
    const result = SubtaskSummarySchema.parse(validSummary)
    expect(result.notes).toBeUndefined()
  })
})

// =============================================================================
// SubtaskCompletionDataSchema — validates completion requirements
// =============================================================================

describe('SubtaskCompletionDataSchema', () => {
  const validCompletion = {
    output: 'Implemented auth middleware with JWT verification',
    summary: {
      title: 'Auth middleware',
      description: 'JWT verification for protected routes',
      filesChanged: [{ path: 'src/auth.ts', action: 'created' as const }],
      whatWasDone: ['Created JWT middleware'],
      outputForNextAgent: 'Middleware ready, add RBAC next.',
    },
  }

  it('should parse valid completion data', () => {
    const result = SubtaskCompletionDataSchema.parse(validCompletion)
    expect(result.output).toBe(validCompletion.output)
    expect(result.summary.outputForNextAgent).toBe('Middleware ready, add RBAC next.')
  })

  it('should reject missing output', () => {
    const { output, ...withoutOutput } = validCompletion
    expect(() => SubtaskCompletionDataSchema.parse(withoutOutput)).toThrow()
  })

  it('should reject empty output', () => {
    expect(() => SubtaskCompletionDataSchema.parse({ ...validCompletion, output: '' })).toThrow()
  })

  it('should reject missing summary', () => {
    expect(() => SubtaskCompletionDataSchema.parse({ output: 'some output' })).toThrow()
  })

  it('should reject summary without outputForNextAgent', () => {
    const badSummary = { ...validCompletion.summary }
    // @ts-expect-error - intentionally testing invalid data
    delete badSummary.outputForNextAgent
    expect(() => SubtaskCompletionDataSchema.parse({ output: 'ok', summary: badSummary })).toThrow()
  })
})

// =============================================================================
// validateSubtaskCompletion helper
// =============================================================================

describe('validateSubtaskCompletion', () => {
  const validData = {
    output: 'Task done',
    summary: {
      title: 'Test',
      description: 'Testing',
      filesChanged: [],
      whatWasDone: ['Did the thing'],
      outputForNextAgent: 'Context for next.',
    },
  }

  it('should return success for valid data', () => {
    const result = validateSubtaskCompletion(validData)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.output).toBe('Task done')
    }
  })

  it('should return errors for missing output', () => {
    const result = validateSubtaskCompletion({ summary: validData.summary })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some((e) => e.includes('output'))).toBe(true)
    }
  })

  it('should return errors for empty whatWasDone', () => {
    const result = validateSubtaskCompletion({
      output: 'ok',
      summary: { ...validData.summary, whatWasDone: [] },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.some((e) => e.includes('whatWasDone'))).toBe(true)
    }
  })

  it('should return errors for completely invalid data', () => {
    const result = validateSubtaskCompletion({})
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })
})

// =============================================================================
// Backward Compatibility
// =============================================================================

describe('backward compatibility', () => {
  it('should parse old SubtaskSchema without summary or output', () => {
    const oldSubtask = {
      id: 'subtask-1',
      description: 'Old subtask without handoff',
      domain: 'backend',
      agent: 'backend.md',
      status: 'completed' as const,
      dependsOn: [],
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T01:00:00.000Z',
      // No output, no summary — old format
    }
    const result = SubtaskSchema.parse(oldSubtask)
    expect(result.output).toBeUndefined()
    expect(result.summary).toBeUndefined()
    expect(result.status).toBe('completed')
  })

  it('should parse pending subtask without completion fields', () => {
    const pending = {
      id: 'subtask-2',
      description: 'Pending subtask',
      domain: 'frontend',
      agent: 'frontend.md',
      status: 'pending' as const,
      dependsOn: ['subtask-1'],
    }
    const result = SubtaskSchema.parse(pending)
    expect(result.status).toBe('pending')
    expect(result.output).toBeUndefined()
    expect(result.summary).toBeUndefined()
  })

  it('should parse subtask with output but no summary (transition format)', () => {
    const transitional = {
      id: 'subtask-1',
      description: 'Transitional format',
      domain: 'backend',
      agent: 'backend.md',
      status: 'completed' as const,
      dependsOn: [],
      output: 'Done with basic output',
      // No summary yet
    }
    const result = SubtaskSchema.parse(transitional)
    expect(result.output).toBe('Done with basic output')
    expect(result.summary).toBeUndefined()
  })

  it('should parse subtask with full handoff data', () => {
    const withHandoff = {
      id: 'subtask-1',
      description: 'Full handoff format',
      domain: 'backend',
      agent: 'backend.md',
      status: 'completed' as const,
      dependsOn: [],
      output: 'Implemented the feature',
      summary: {
        title: 'Backend API',
        description: 'Created REST endpoints',
        filesChanged: [{ path: 'src/api.ts', action: 'created' as const }],
        whatWasDone: ['Created endpoints', 'Added validation'],
        outputForNextAgent: 'API is ready at /api/v1. Add auth next.',
      },
    }
    const result = SubtaskSchema.parse(withHandoff)
    expect(result.summary?.outputForNextAgent).toBe('API is ready at /api/v1. Add auth next.')
    expect(result.summary?.whatWasDone).toHaveLength(2)
  })
})
