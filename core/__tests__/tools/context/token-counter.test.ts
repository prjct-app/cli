import { describe, expect, it } from 'bun:test'
import {
  combineMetrics,
  countTokens,
  formatCompressionRate,
  formatCostSaved,
  formatTokenCount,
  measureCompression,
  noCompression,
} from '../../../tools/context/token-counter'

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0)
  })

  it('uses ~4 chars per token heuristic (ceil)', () => {
    expect(countTokens('abcd')).toBe(1)
    expect(countTokens('abcde')).toBe(2)
    expect(countTokens('a'.repeat(100))).toBe(25)
  })
})

describe('formatTokenCount', () => {
  it('formats small numbers with comma separators', () => {
    expect(formatTokenCount(42)).toBe('42')
    expect(formatTokenCount(999)).toBe('999')
  })

  it('formats thousands with K suffix', () => {
    expect(formatTokenCount(1500)).toBe('1.5K')
    expect(formatTokenCount(2300)).toBe('2.3K')
  })

  it('formats millions with M suffix', () => {
    expect(formatTokenCount(1_500_000)).toBe('1.5M')
  })
})

describe('formatCompressionRate', () => {
  it('rounds to whole percent', () => {
    expect(formatCompressionRate(0.894)).toBe('89%')
    expect(formatCompressionRate(1)).toBe('100%')
    expect(formatCompressionRate(0)).toBe('0%')
  })
})

describe('formatCostSaved', () => {
  it('shows < $0.01 for trivial amounts', () => {
    expect(formatCostSaved(0.0005)).toBe('<$0.01')
  })

  it('shows three decimals for small amounts', () => {
    expect(formatCostSaved(0.005)).toBe('$0.005')
  })

  it('shows two decimals for regular amounts', () => {
    expect(formatCostSaved(1.234)).toBe('$1.23')
    expect(formatCostSaved(10)).toBe('$10.00')
  })
})

describe('measureCompression', () => {
  it('computes compression rate between 0 and 1', () => {
    const result = measureCompression('a'.repeat(1000), 'a'.repeat(100))
    expect(result.compression).toBeGreaterThan(0.8)
    expect(result.compression).toBeLessThanOrEqual(1)
    expect(result.tokens.saved).toBeGreaterThan(0)
  })

  it('clamps compression to 0 when filtered is larger', () => {
    const result = measureCompression('a'.repeat(100), 'a'.repeat(200))
    expect(result.compression).toBe(0)
    expect(result.tokens.saved).toBe(0)
  })

  it('handles empty original (no divide-by-zero)', () => {
    const result = measureCompression('', '')
    expect(result.compression).toBe(0)
    expect(result.tokens.original).toBe(0)
  })

  it('emits cost breakdown per model', () => {
    const result = measureCompression('a'.repeat(10000), 'a'.repeat(100))
    expect(result.cost.byModel.length).toBeGreaterThan(0)
    for (const entry of result.cost.byModel) {
      expect(entry.total).toBeGreaterThanOrEqual(0)
      expect(entry.inputSaved).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('noCompression', () => {
  it('returns zero compression with original=filtered tokens', () => {
    const result = noCompression('a'.repeat(40))
    expect(result.compression).toBe(0)
    expect(result.tokens.original).toBe(result.tokens.filtered)
    expect(result.tokens.saved).toBe(0)
    expect(result.cost.saved).toBe(0)
  })
})

describe('combineMetrics', () => {
  it('returns zero metrics for empty input', () => {
    const result = combineMetrics([])
    expect(result.tokens.original).toBe(0)
    expect(result.compression).toBe(0)
  })

  it('sums tokens across metrics', () => {
    const a = measureCompression('a'.repeat(400), 'a'.repeat(100))
    const b = measureCompression('b'.repeat(800), 'b'.repeat(200))
    const combined = combineMetrics([a, b])
    expect(combined.tokens.original).toBe(a.tokens.original + b.tokens.original)
    expect(combined.tokens.filtered).toBe(a.tokens.filtered + b.tokens.filtered)
    expect(combined.tokens.saved).toBe(a.tokens.saved + b.tokens.saved)
  })

  it('recomputes overall compression rate', () => {
    const a = measureCompression('a'.repeat(1000), 'a'.repeat(100))
    const combined = combineMetrics([a, a])
    expect(combined.compression).toBeCloseTo(a.compression, 2)
  })
})
