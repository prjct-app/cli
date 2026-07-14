/**
 * Impact-ordered ready frontier (Dynasty D4 / C1).
 */

import { describe, expect, it } from 'bun:test'
import {
  ageDaysSince,
  formatWhyNext,
  priorityPoints,
  rankByFactors,
  scoreReadyFactors,
  seedHintsFromDescription,
} from '../../services/impact-ready'
import type { ReadyItem } from '../../services/work-graph'

function item(partial: Partial<ReadyItem> & { id: string; description: string }): ReadyItem {
  return {
    type: 'feature',
    priority: 'medium',
    section: 'active',
    claimedBy: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    unblocks: 0,
    ...partial,
  }
}

describe('impact-ready', () => {
  it('scores unblocks as dominant signal', () => {
    const low = scoreReadyFactors({
      unblocks: 0,
      priorityPts: 50,
      ageDays: 30,
      impactNeighbors: 0,
      impactTraps: 0,
      sotPressure: 0,
    })
    const high = scoreReadyFactors({
      unblocks: 3,
      priorityPts: 5,
      ageDays: 0,
      impactNeighbors: 0,
      impactTraps: 0,
      sotPressure: 0,
    })
    expect(high).toBeGreaterThan(low)
  })

  it('ranks high-unblock + traps above idle low-priority', () => {
    const now = Date.parse('2026-07-11T00:00:00.000Z')
    const a = item({
      id: 'a',
      description: 'leaf chore',
      priority: 'low',
      unblocks: 0,
      createdAt: '2026-07-10T00:00:00.000Z',
    })
    const b = item({
      id: 'b',
      description: 'schema that unblocks API',
      priority: 'medium',
      unblocks: 2,
      createdAt: '2026-07-01T00:00:00.000Z',
    })
    const ranked = rankByFactors([
      {
        ...a,
        factors: {
          unblocks: 0,
          priorityPts: priorityPoints(a.priority),
          ageDays: ageDaysSince(a.createdAt, now),
          impactNeighbors: 0,
          impactTraps: 0,
          sotPressure: 0,
        },
      },
      {
        ...b,
        factors: {
          unblocks: 2,
          priorityPts: priorityPoints(b.priority),
          ageDays: ageDaysSince(b.createdAt, now),
          impactNeighbors: 3,
          impactTraps: 2,
          sotPressure: 1,
        },
      },
    ])
    expect(ranked[0]?.id).toBe('b')
    expect(ranked[0]?.why).toMatch(/why next/)
    expect(ranked[0]?.why).toMatch(/unblocks 2/)
  })

  it('formatWhyNext is scannable', () => {
    const line = formatWhyNext(
      {
        unblocks: 1,
        priorityPts: 50,
        ageDays: 2,
        impactNeighbors: 2,
        impactTraps: 1,
        sotPressure: 1,
      },
      200
    )
    expect(line).toContain('why next:')
    expect(line).toContain('score=200')
  })

  it('seedHintsFromDescription extracts paths and tokens', () => {
    const seeds = seedHintsFromDescription('fix core/services/work-graph.ts race on claim')
    expect(seeds.some((s) => s.includes('work-graph.ts'))).toBe(true)
  })
})
