/**
 * Cycle budget card (Dynasty D5).
 */

import { describe, expect, it } from 'bun:test'
import { buildCycleBudgetCard } from '../../services/cycle-budget-card'

describe('cycle-budget-card', () => {
  it('prints turns and density cue at cycle open', () => {
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
    expect(c.line).toMatch(/signal density|session continues/i)
    expect(c.md).toContain('Cycle budget')
  })

  it('under critical pressure prefers compact work not session kill', () => {
    const c = buildCycleBudgetCard({
      turns: 12,
      turnLimit: 15,
      tokensSpent: 90_000,
      tokenBudget: 100_000,
      pressureLevel: 'critical',
    })
    expect(c.line).toMatch(/high-signal|compact|keep working/i)
    expect(c.line).not.toMatch(/LAND NOW/i)
    expect(c.turnRatio).toBeCloseTo(0.8, 2)
  })
})
