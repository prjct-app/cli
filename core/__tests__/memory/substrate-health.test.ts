/**
 * Substrate health + coverage footer.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'
import {
  computeSubstrateHealth,
  formatCoverageFooter,
  formatSubstrateHealthMd,
} from '../../memory/substrate-health'

function entry(
  partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'type' | 'content'>
): MemoryEntry {
  return {
    tags: {},
    rememberedAt: new Date().toISOString(),
    provenance: 'declared',
    ...partial,
  }
}

describe('computeSubstrateHealth', () => {
  it('scores clean judgment high', () => {
    const entries = [
      entry({
        id: 'mem_1',
        type: 'decision',
        content: 'Use SQLite as the single source of truth for project memory',
      }),
      entry({
        id: 'mem_2',
        type: 'gotcha',
        content: 'Never call router.refresh() after inventory save — it resets scroll',
      }),
    ]
    const h = computeSubstrateHealth(entries)
    expect(h.live).toBe(2)
    expect(h.judgment).toBe(2)
    expect(h.signalRatio).toBe(1)
    expect(h.unshapedGotchaRate).toBe(0)
    expect(h.score).toBeGreaterThanOrEqual(85)
  })

  it('flags open-narration gotchas and empty specs', () => {
    const entries = [
      entry({
        id: 'mem_g',
        type: 'gotcha',
        content: 'Reviso cómo refrescan hoy para no meter un bug:',
      }),
      entry({
        id: 'mem_s',
        type: 'spec',
        content: 'get abc\n\nGoal: get abc',
      }),
      entry({
        id: 'mem_d',
        type: 'decision',
        content: 'Ship precision classifier before any intake surface',
      }),
    ]
    const h = computeSubstrateHealth(entries)
    expect(h.unshapedGotchaRate).toBe(1)
    expect(h.emptySpecRate).toBe(1)
    expect(h.signalRatio).toBeLessThan(1)
    expect(h.issues.some((i) => /open-narration|empty-spec/i.test(i))).toBe(true)
  })

  it('coverage footer never claims completeness', () => {
    const footer = formatCoverageFooter([])
    expect(footer).toMatch(/blind spot/i)
    const filled = formatCoverageFooter([
      entry({ id: 'mem_1', type: 'fact', content: 'Runtime is bun for CLI tests' }),
    ])
    expect(filled).toMatch(/Coverage:/)
    expect(filled).toMatch(/density=/)
  })

  it('compact formatMemoryMd includes coverage footer', () => {
    const md = formatMemoryMd(
      [entry({ id: 'mem_1', type: 'fact', content: 'Something durable about auth cookies' })],
      { compact: true }
    )
    expect(md).toMatch(/Coverage:/)
  })

  it('formatSubstrateHealthMd includes honesty line', () => {
    const h = computeSubstrateHealth([
      entry({ id: 'mem_1', type: 'decision', content: 'Prefer pure gates over fail-open capture' }),
    ])
    const md = formatSubstrateHealthMd(h)
    expect(md).toMatch(/Substrate health/)
    expect(md).toMatch(/not proof/i)
  })
})
