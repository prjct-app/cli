/**
 * Injection Validator Tests
 * Tests for safeInject, truncation, skill filtering, and budget tracking.
 */

import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import {
  DEFAULT_BUDGETS,
  estimateTokens,
  InjectionBudgetTracker,
  safeInject,
  safeInjectString,
  truncateToTokenBudget,
} from '../../agentic/injection-validator'

// =============================================================================
// safeInject
// =============================================================================

describe('safeInject', () => {
  const schema = z.object({ name: z.string(), value: z.number() })
  const fallback = { name: 'unknown', value: 0 }

  it('returns validated data on valid input', () => {
    const data = { name: 'test', value: 42 }
    expect(safeInject(data, schema, fallback)).toEqual(data)
  })

  it('returns fallback on invalid input', () => {
    const data = { name: 123, value: 'bad' }
    expect(safeInject(data, schema, fallback)).toEqual(fallback)
  })

  it('returns fallback on null input', () => {
    expect(safeInject(null, schema, fallback)).toEqual(fallback)
  })

  it('returns fallback on undefined input', () => {
    expect(safeInject(undefined, schema, fallback)).toEqual(fallback)
  })

  it('strips extra fields via Zod', () => {
    const data = { name: 'test', value: 42, extra: 'ignored' }
    const result = safeInject(data, schema, fallback)
    expect(result.name).toBe('test')
    expect(result.value).toBe(42)
  })
})

// =============================================================================
// safeInjectString
// =============================================================================

describe('safeInjectString', () => {
  const schema = z.object({ count: z.number() })
  const formatter = (d: { count: number }) => `Items: ${d.count}`

  it('returns formatted string on valid input', () => {
    expect(safeInjectString({ count: 5 }, schema, formatter, 'N/A')).toBe('Items: 5')
  })

  it('returns fallback string on invalid input', () => {
    expect(safeInjectString({ count: 'bad' }, schema, formatter, 'N/A')).toBe('N/A')
  })

  it('returns fallback string on null', () => {
    expect(safeInjectString(null, schema, formatter, 'no data')).toBe('no data')
  })
})

// =============================================================================
// truncateToTokenBudget
// =============================================================================

describe('truncateToTokenBudget', () => {
  it('returns text unchanged if within budget', () => {
    const text = 'short text'
    expect(truncateToTokenBudget(text, 100)).toBe(text)
  })

  it('truncates text that exceeds budget', () => {
    const text = 'a'.repeat(500) // 500 chars = ~125 tokens
    const result = truncateToTokenBudget(text, 50) // 50 tokens = 200 chars
    expect(result.length).toBeLessThan(500)
    expect(result).toContain('truncated')
    expect(result).toContain('~50 tokens')
  })

  it('truncates to exact char limit', () => {
    const text = 'a'.repeat(100)
    const result = truncateToTokenBudget(text, 10) // 10 tokens = 40 chars
    expect(result.startsWith('a'.repeat(40))).toBe(true)
  })

  it('handles empty string', () => {
    expect(truncateToTokenBudget('', 100)).toBe('')
  })

  it('handles zero budget', () => {
    const result = truncateToTokenBudget('some text', 0)
    expect(result).toContain('truncated')
  })
})

// =============================================================================
// estimateTokens
// =============================================================================

describe('estimateTokens', () => {
  it('estimates tokens at ~4 chars per token', () => {
    expect(estimateTokens('a'.repeat(100))).toBe(25)
  })

  it('rounds up partial tokens', () => {
    expect(estimateTokens('abc')).toBe(1) // 3/4 = 0.75, ceil = 1
  })

  it('handles empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

// =============================================================================
// InjectionBudgetTracker
// =============================================================================

describe('InjectionBudgetTracker', () => {
  it('tracks cumulative token usage', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 100 })
    tracker.addSection('a'.repeat(200), 100) // 200 chars = 50 tokens
    expect(tracker.totalUsed).toBe(50)
    expect(tracker.remaining).toBe(50)
  })

  it('truncates sections to per-section budget', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 1000 })
    const result = tracker.addSection('a'.repeat(500), 50) // budget: 50 tokens = 200 chars
    expect(result.length).toBeLessThan(500)
  })

  it('returns empty string when total budget exhausted', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 10 })
    tracker.addSection('a'.repeat(100), 50) // uses all 10 tokens of total budget
    const result = tracker.addSection('more content', 50)
    expect(result).toBe('')
  })

  it('fits content to remaining total budget', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 30 })
    tracker.addSection('a'.repeat(80), 30) // 80 chars = 20 tokens
    // Remaining: 10 tokens
    const result = tracker.addSection('b'.repeat(200), 100) // wants 100 tokens, only 10 left
    expect(result.length).toBeLessThan(200)
    expect(tracker.remaining).toBe(0)
  })

  it('uses default budgets when none provided', () => {
    const tracker = new InjectionBudgetTracker()
    expect(tracker.config.totalPrompt).toBe(DEFAULT_BUDGETS.totalPrompt)
    expect(tracker.config.autoContext).toBe(DEFAULT_BUDGETS.autoContext)
  })

  it('allows partial budget overrides', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 5000 })
    expect(tracker.config.totalPrompt).toBe(5000)
    expect(tracker.config.autoContext).toBe(DEFAULT_BUDGETS.autoContext) // unchanged
  })

  it('remaining never goes negative', () => {
    const tracker = new InjectionBudgetTracker({ totalPrompt: 5 })
    tracker.addSection('a'.repeat(1000), 500)
    expect(tracker.remaining).toBe(0)
  })
})

// =============================================================================
// DEFAULT_BUDGETS
// =============================================================================

describe('DEFAULT_BUDGETS', () => {
  it('has all required fields', () => {
    expect(DEFAULT_BUDGETS.autoContext).toBeGreaterThan(0)
    expect(DEFAULT_BUDGETS.stateData).toBeGreaterThan(0)
    expect(DEFAULT_BUDGETS.memories).toBeGreaterThan(0)
    expect(DEFAULT_BUDGETS.totalPrompt).toBeGreaterThan(0)
  })

  it('totalPrompt is larger than individual budgets', () => {
    expect(DEFAULT_BUDGETS.totalPrompt).toBeGreaterThan(DEFAULT_BUDGETS.autoContext)
    expect(DEFAULT_BUDGETS.totalPrompt).toBeGreaterThan(DEFAULT_BUDGETS.stateData)
  })
})
