/**
 * `prjct sdd` — opt-in Spec-Driven Development discipline.
 *
 * Covers the pure mode-resolution core (config wins, env fallback, unknown →
 * off) and that `sdd` is a registered verb. Mirrors the `lean`/`tdd` shape.
 */

import { describe, expect, it } from 'bun:test'
import { _internal } from '../../commands/sdd'
import { REGISTERED_VERBS_SET } from '../../commands/verb-names'

describe('sdd — mode resolution', () => {
  it('effectiveSddMode: config wins, env is the fallback, unknown → off', () => {
    const saved = process.env.PRJCT_SDD_MODE
    delete process.env.PRJCT_SDD_MODE
    try {
      expect(_internal.effectiveSddMode({ sdd: { mode: 'strict' } } as never)).toBe('strict')
      expect(_internal.effectiveSddMode({ sdd: { mode: 'advisory' } } as never)).toBe('advisory')
      expect(_internal.effectiveSddMode(null)).toBe('off')
      expect(_internal.effectiveSddMode({ sdd: { mode: 'bogus' } } as never)).toBe('off')
      process.env.PRJCT_SDD_MODE = 'strict'
      expect(_internal.effectiveSddMode(null)).toBe('strict')
      expect(_internal.effectiveSddMode({ sdd: { mode: 'off' } } as never)).toBe('off')
    } finally {
      if (saved === undefined) delete process.env.PRJCT_SDD_MODE
      else process.env.PRJCT_SDD_MODE = saved
    }
  })

  it('is a registered verb (so it never auto-captures to the inbox)', () => {
    expect(REGISTERED_VERBS_SET.has('sdd')).toBe(true)
  })
})
