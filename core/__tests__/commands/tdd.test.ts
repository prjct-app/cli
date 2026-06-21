/**
 * `prjct tdd` — opt-in Test-Driven Development discipline.
 *
 * Covers the pure mode-resolution core (config wins, env fallback, unknown →
 * off) and that `tdd` is a registered verb (so it never auto-captures to the
 * inbox). Mirrors the `lean` command test shape.
 */

import { describe, expect, it } from 'bun:test'
import { _internal } from '../../commands/tdd'
import { REGISTERED_VERBS_SET } from '../../commands/verb-names'

describe('tdd — mode resolution', () => {
  it('effectiveTddMode: config wins, env is the fallback, unknown → off', () => {
    const saved = process.env.PRJCT_TDD_MODE
    delete process.env.PRJCT_TDD_MODE
    try {
      expect(_internal.effectiveTddMode({ tdd: { mode: 'strict' } } as never)).toBe('strict')
      expect(_internal.effectiveTddMode({ tdd: { mode: 'assist' } } as never)).toBe('assist')
      expect(_internal.effectiveTddMode(null)).toBe('off')
      expect(_internal.effectiveTddMode({ tdd: { mode: 'bogus' } } as never)).toBe('off')
      process.env.PRJCT_TDD_MODE = 'strict'
      expect(_internal.effectiveTddMode(null)).toBe('strict')
      // Config still wins over env.
      expect(_internal.effectiveTddMode({ tdd: { mode: 'off' } } as never)).toBe('off')
    } finally {
      if (saved === undefined) delete process.env.PRJCT_TDD_MODE
      else process.env.PRJCT_TDD_MODE = saved
    }
  })

  it('is a registered verb (so it never auto-captures to the inbox)', () => {
    expect(REGISTERED_VERBS_SET.has('tdd')).toBe(true)
  })
})
