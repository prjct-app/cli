/**
 * Context cache tiers L0–L3 contract.
 */

import { describe, expect, it } from 'bun:test'
import {
  buildContextTiersReport,
  CONTEXT_TIERS,
  contextTiersOneLiner,
  formatContextTiersMd,
  L0_ROUTING_BYTES_MAX,
  L0_SKILL_TOKENS_MAX,
  measureL0Budget,
} from '../../services/context-tiers'
import { WORLD_CLASS } from '../../services/harness-score'

describe('CONTEXT_TIERS', () => {
  it('defines exactly L0–L3', () => {
    expect(CONTEXT_TIERS.map((t) => t.id)).toEqual(['L0', 'L1', 'L2', 'L3'])
  })

  it('each tier has load, contents, pull, antiPattern', () => {
    for (const t of CONTEXT_TIERS) {
      expect(t.load.length).toBeGreaterThan(5)
      expect(t.contents.length).toBeGreaterThan(0)
      expect(t.pull.length).toBeGreaterThan(5)
      expect(t.antiPattern.length).toBeGreaterThan(10)
    }
  })
})

describe('measureL0Budget', () => {
  it('is within WORLD_CLASS SLOs (lockstep constants)', () => {
    expect(L0_SKILL_TOKENS_MAX).toBe(WORLD_CLASS.skillTokensMax)
    expect(L0_ROUTING_BYTES_MAX).toBe(WORLD_CLASS.routingBodyBytesMax)
    const m = measureL0Budget()
    expect(m.ok).toBe(true)
    expect(m.skillTokens).toBeLessThanOrEqual(L0_SKILL_TOKENS_MAX)
    expect(m.routingBytes).toBeLessThanOrEqual(L0_ROUTING_BYTES_MAX)
  })
})

describe('formatContextTiersMd', () => {
  it('renders table + L0 budget + anti-patterns', () => {
    const md = formatContextTiersMd(buildContextTiersReport())
    expect(md).toContain('# prjct context cache tiers')
    expect(md).toContain('**L0**')
    expect(md).toContain('**L3**')
    expect(md).toContain('L0 budget')
    expect(md).toContain('Anti-patterns')
    expect(md).toMatch(/Never stuff L2/)
  })
})

describe('contextTiersOneLiner', () => {
  it('is short and names all tiers', () => {
    const line = contextTiersOneLiner()
    expect(line.length).toBeLessThan(160)
    expect(line).toMatch(/L0/)
    expect(line).toMatch(/L2/)
  })
})
