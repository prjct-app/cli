/**
 * Cycle budget card (Dynasty D5).
 */

import { describe, expect, it } from 'bun:test'
import { buildCycleBudgetCard } from '../../services/cycle-budget-card'

describe('cycle-budget-card', () => {
  it('prints turns and land cue at cycle open', () => {
    const c = buildCycleBudgetCard({
      turns: 0,
      turnLimit: 15,
      tokensSpent: 0,
      tokenBudget: 100_000,
      pressureLevel: 'ok',
    })
    expect(c.line).toMatch(/Cycle budget/)
    expect(c.line).toContain('turns 0/15')
    expect(c.line).toContain('100000')
    expect(c.line).toMatch(/land/i)
    expect(c.md).toContain('Cycle budget')
  })

  it('escalates land cue under critical pressure', () => {
    const c = buildCycleBudgetCard({
      turns: 12,
      turnLimit: 15,
      tokensSpent: 90_000,
      tokenBudget: 100_000,
      pressureLevel: 'critical',
    })
    expect(c.line).toMatch(/LAND NOW/i)
    expect(c.turnRatio).toBeCloseTo(0.8, 2)
  })
})
