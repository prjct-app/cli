import { describe, expect, it } from 'bun:test'
import {
  type AggregateMetrics,
  aggregate,
  evaluateImprovementGate,
  firstRelevantRank,
  ndcgAtK,
  recallAtK,
  reciprocalRank,
} from '../../eval/retrieval-metrics'

const rel = (...ids: string[]) => new Set(ids)
const metrics = (overrides: Partial<AggregateMetrics>): AggregateMetrics => ({
  queries: 100,
  recallAtK: 0.5,
  mrr: 0.5,
  ndcgAtK: 0.5,
  k: 10,
  ...overrides,
})

describe('firstRelevantRank', () => {
  it('returns the 1-indexed rank of the first relevant id', () => {
    expect(firstRelevantRank(['a', 'b', 'c'], rel('b'))).toBe(2)
    expect(firstRelevantRank(['a', 'b', 'c'], rel('a'))).toBe(1)
  })
  it('returns 0 when no relevant id is present', () => {
    expect(firstRelevantRank(['a', 'b'], rel('z'))).toBe(0)
  })
})

describe('recallAtK', () => {
  it('is 1 when the single relevant id is within k', () => {
    expect(recallAtK(['a', 'b', 'c'], rel('c'), 3)).toBe(1)
  })
  it('is 0 when the relevant id is beyond k', () => {
    expect(recallAtK(['a', 'b', 'c'], rel('c'), 2)).toBe(0)
  })
  it('fractions over a multi-id relevant set', () => {
    expect(recallAtK(['a', 'b', 'c', 'd'], rel('a', 'd', 'z'), 4)).toBeCloseTo(2 / 3)
  })
  it('is 0 for an empty relevant set', () => {
    expect(recallAtK(['a'], rel(), 5)).toBe(0)
  })
})

describe('reciprocalRank', () => {
  it('is 1/rank of the first hit', () => {
    expect(reciprocalRank(['a', 'b', 'c'], rel('b'))).toBeCloseTo(1 / 2)
  })
  it('is 0 with no hit', () => {
    expect(reciprocalRank(['a'], rel('z'))).toBe(0)
  })
})

describe('ndcgAtK', () => {
  it('is 1 when the only relevant id is ranked first', () => {
    expect(ndcgAtK(['a', 'b', 'c'], rel('a'), 3)).toBeCloseTo(1)
  })
  it('discounts a relevant id ranked lower', () => {
    // single relevant at rank 2 → DCG = 1/log2(3), IDCG = 1/log2(2) = 1
    expect(ndcgAtK(['a', 'b'], rel('b'), 2)).toBeCloseTo(1 / Math.log2(3))
  })
  it('is 0 when nothing relevant is in the top-k', () => {
    expect(ndcgAtK(['a', 'b', 'c'], rel('c'), 2)).toBe(0)
  })
})

describe('aggregate', () => {
  it('means each metric over the cases', () => {
    const m = aggregate(
      [
        { ranked: ['x', 'a'], relevant: rel('x') }, // RR 1, recall 1, ndcg 1
        { ranked: ['a', 'y'], relevant: rel('y') }, // RR 1/2, recall 1, ndcg 1/log2(3)
      ],
      5
    )
    expect(m.queries).toBe(2)
    expect(m.recallAtK).toBeCloseTo(1)
    expect(m.mrr).toBeCloseTo((1 + 0.5) / 2)
    expect(m.ndcgAtK).toBeCloseTo((1 + 1 / Math.log2(3)) / 2)
  })
  it('handles the empty batch', () => {
    expect(aggregate([], 5)).toEqual({ queries: 0, recallAtK: 0, mrr: 0, ndcgAtK: 0, k: 5 })
  })
})

describe('evaluateImprovementGate', () => {
  it('passes when sample is large enough, primary lift clears 20%, and guards do not regress', () => {
    const gate = evaluateImprovementGate(
      metrics({ ndcgAtK: 0.5 }),
      metrics({ recallAtK: 0.5, mrr: 0.51, ndcgAtK: 0.61 })
    )

    expect(gate.passed).toBe(true)
    expect(gate.sampleOk).toBe(true)
    expect(gate.requiredPrimaryValue).toBeCloseTo(0.6)
    expect(gate.blockers).toEqual([])
  })

  it('fails when the eval sample is too small even if metrics improve', () => {
    const gate = evaluateImprovementGate(
      metrics({ queries: 13, ndcgAtK: 0.5 }),
      metrics({ queries: 13, ndcgAtK: 0.8 })
    )

    expect(gate.passed).toBe(false)
    expect(gate.blockers).toContain('sample 13/100')
  })

  it('fails when the primary metric lift is below the required 20%', () => {
    const gate = evaluateImprovementGate(metrics({ ndcgAtK: 0.5 }), metrics({ ndcgAtK: 0.59 }))

    expect(gate.passed).toBe(false)
    expect(gate.blockers).toContain('ndcgAtK lift below 20%')
  })

  it('fails when any guarded metric regresses', () => {
    const gate = evaluateImprovementGate(
      metrics({ recallAtK: 0.5, ndcgAtK: 0.5 }),
      metrics({ recallAtK: 0.49, ndcgAtK: 0.7 })
    )

    expect(gate.passed).toBe(false)
    expect(gate.blockers).toContain('recallAtK regressed')
  })
})
