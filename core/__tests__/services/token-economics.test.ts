import { describe, expect, test } from 'bun:test'
import { buildTokenEconomics } from '../../services/token-economics'

describe('buildTokenEconomics', () => {
  test('returns scored line without throwing', () => {
    const e = buildTokenEconomics('00000000-0000-0000-0000-000000000000')
    expect(e.line).toContain('Token economics')
    expect(e.score).toBeGreaterThanOrEqual(0)
    expect(e.score).toBeLessThanOrEqual(100)
  })

  test('over-budget cycle lowers score', () => {
    const under = buildTokenEconomics('00000000-0000-0000-0000-000000000000', {
      cycleTokensIn: 100,
      cycleTokensOut: 100,
      maxTokensPerCycle: 1000,
    })
    const over = buildTokenEconomics('00000000-0000-0000-0000-000000000000', {
      cycleTokensIn: 900,
      cycleTokensOut: 900,
      maxTokensPerCycle: 1000,
    })
    expect(under.score).toBeGreaterThan(over.score)
    expect(over.line).toContain('cycle=1800/1000')
  })
})
