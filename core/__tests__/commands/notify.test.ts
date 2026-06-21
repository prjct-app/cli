/**
 * `prjct notify` — desktop notifications toggle (default ON).
 *
 * Covers mode resolution (default-on; config + env override) and that `notify`
 * is a registered verb. Mirrors the lean/tdd/sdd command test shape.
 */

import { describe, expect, it } from 'bun:test'
import { REGISTERED_VERBS_SET } from '../../commands/verb-names'
import { effectiveNotifyMode } from '../../utils/notify'

describe('notify — mode resolution', () => {
  it('effectiveNotifyMode: DEFAULT ON; config wins; env is the fallback', () => {
    const saved = process.env.PRJCT_NOTIFY_MODE
    delete process.env.PRJCT_NOTIFY_MODE
    try {
      // Default-on: absent config + no env → on.
      expect(effectiveNotifyMode(null)).toBe('on')
      expect(effectiveNotifyMode({} as never)).toBe('on')
      // Config wins.
      expect(effectiveNotifyMode({ notify: { mode: 'off' } } as never)).toBe('off')
      expect(effectiveNotifyMode({ notify: { mode: 'on' } } as never)).toBe('on')
      // Bogus config value → falls through to default-on.
      expect(effectiveNotifyMode({ notify: { mode: 'bogus' } } as never)).toBe('on')
      // Env fallback when config absent; config still wins over env.
      process.env.PRJCT_NOTIFY_MODE = 'off'
      expect(effectiveNotifyMode(null)).toBe('off')
      expect(effectiveNotifyMode({ notify: { mode: 'on' } } as never)).toBe('on')
    } finally {
      if (saved === undefined) delete process.env.PRJCT_NOTIFY_MODE
      else process.env.PRJCT_NOTIFY_MODE = saved
    }
  })

  it('is a registered verb (so it never auto-captures to the inbox)', () => {
    expect(REGISTERED_VERBS_SET.has('notify')).toBe(true)
  })
})
