/**
 * Hard loop guard verdict (GAP 3) — the ONE source the per-turn escalation and
 * the pre-edit deny both read. Stops only on genuine, unacknowledged overrun.
 */

import { describe, expect, it } from 'bun:test'
import type { CurrentTask } from '../../schemas/state'
import { loopGuardVerdict } from '../../services/loop-guard'
import type { LocalConfig } from '../../types/config'

const task = (over: Partial<CurrentTask>): CurrentTask =>
  ({ id: 't', description: 'fix the bug', startedAt: '', sessionId: 's', ...over }) as CurrentTask
const cfg = (n?: number): LocalConfig => ({ maxTurnsPerCycle: n }) as unknown as LocalConfig

describe('loopGuardVerdict', () => {
  it('stops when at/over the limit and not acknowledged', () => {
    const v = loopGuardVerdict(cfg(3), task({ turnCount: 3 }))
    expect(v.stopped).toBe(true)
    expect(v.message).toContain('hard stop')
    expect(v.message).toContain('--extend')
  })

  it('does not stop under the limit', () => {
    expect(loopGuardVerdict(cfg(3), task({ turnCount: 2 })).stopped).toBe(false)
  })

  it('does not stop once the cycle is acknowledged (--extend)', () => {
    expect(
      loopGuardVerdict(cfg(3), task({ turnCount: 99, turnLimitAcknowledgedAt: '2026-01-01' }))
        .stopped
    ).toBe(false)
  })

  it('does not stop when the limit is unset (opt-in)', () => {
    expect(loopGuardVerdict(cfg(undefined), task({ turnCount: 99 })).stopped).toBe(false)
  })

  it('does not stop with no active cycle', () => {
    expect(loopGuardVerdict(cfg(1), null).stopped).toBe(false)
  })
})
