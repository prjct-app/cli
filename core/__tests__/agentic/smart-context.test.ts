/**
 * Smart Context Tests
 * PRJ-84: Unit tests for smart-context.ts
 */

import { describe, expect, it } from 'bun:test'
import smartContext from '../../agentic/smart-context'
import type { ContextDomain } from '../../types/agentic'
import type { TaskType } from '../../types/agents'

describe('SmartContext PRJ-84', () => {
  describe('detectDomain', () => {
    it('should return general for any task (LLM-over-heuristic)', () => {
      const result = smartContext.detectDomain('Add a new button component')
      expect(result.primary).toBe('general')
      expect(result.confidence).toBe(0.3)
      expect(result.secondary).toEqual([])
    })

    it('should return general for empty descriptions', () => {
      const result = smartContext.detectDomain('')
      expect(result.primary).toBe('general')
    })
  })

  describe('estimateSize', () => {
    // @ts-expect-error - accessing private method for testing
    const estimateSize = smartContext.estimateSize.bind(smartContext)

    it('should return minimum 100 for empty context', () => {
      const result = estimateSize({})
      expect(result).toBe(100)
    })

    it('should estimate roadmap items at ~50 tokens each', () => {
      const result = estimateSize({ roadmap: [{}, {}] })
      expect(result).toBe(100) // 2 * 50
    })

    it('should estimate patterns at ~30 tokens each', () => {
      const result = estimateSize({ patterns: [{}, {}, {}, {}] })
      expect(result).toBe(120) // 4 * 30
    })

    it('should estimate stack at 100 tokens', () => {
      const result = estimateSize({ stack: {} })
      expect(result).toBe(100)
    })

    it('should estimate files at ~10 tokens each', () => {
      const result = estimateSize({ files: ['a', 'b', 'c', 'd', 'e'] })
      expect(result).toBe(100) // 5 * 10 = 50, min 100
    })

    it('should estimate state at 200 tokens', () => {
      const result = estimateSize({ state: {} })
      expect(result).toBe(200)
    })

    it('should combine all estimates', () => {
      const result = estimateSize({
        roadmap: [{}], // 50
        patterns: [{}], // 30
        stack: {}, // 100
        files: ['a'], // 10
        state: {}, // 200
      })
      expect(result).toBe(390)
    })
  })

  describe('taskTypeToContextDomain', () => {
    const testCases: Array<{ input: TaskType; expected: ContextDomain }> = [
      { input: 'frontend', expected: 'frontend' },
      { input: 'backend', expected: 'backend' },
      { input: 'devops', expected: 'devops' },
      { input: 'database', expected: 'backend' },
      { input: 'testing', expected: 'testing' },
      { input: 'documentation', expected: 'docs' },
      { input: 'refactoring', expected: 'general' },
      { input: 'bugfix', expected: 'general' },
      { input: 'feature', expected: 'general' },
      { input: 'design', expected: 'frontend' },
      { input: 'other', expected: 'general' },
    ]

    for (const { input, expected } of testCases) {
      it(`should map ${input} to ${expected}`, () => {
        expect(smartContext.taskTypeToContextDomain(input as TaskType)).toBe(expected)
      })
    }
  })
})
