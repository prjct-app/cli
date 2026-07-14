/**
 * Trap-before-edit SLO (Dynasty D3 / B3).
 */

import { describe, expect, it } from 'bun:test'
import {
  countSurfacedTrapIds,
  formatTrapSurfaceMessage,
  TRAP_SURFACE_MIN_RATE,
  trapSurfaceSlo,
} from '../../services/trap-surface-slo'

describe('trap-surface-slo', () => {
  it('requires min rate 1.0', () => {
    expect(TRAP_SURFACE_MIN_RATE).toBe(1)
  })

  it('formatTrapSurfaceMessage includes every id', () => {
    const msg = formatTrapSurfaceMessage('db.ts', [
      { id: 'mem_a', type: 'gotcha', title: 'busy_timeout required' },
      { id: 'mem_b', type: 'decision', title: 'WAL mode only' },
    ])
    expect(msg).toContain('mem_a')
    expect(msg).toContain('mem_b')
    expect(msg).toContain('db.ts')
    expect(trapSurfaceSlo({ trapIds: ['mem_a', 'mem_b'], message: msg }).ok).toBe(true)
  })

  it('detects miss when id absent from message', () => {
    const r = trapSurfaceSlo({
      trapIds: ['mem_a', 'mem_b'],
      message: 'heads-up mem_a only',
    })
    expect(r.ok).toBe(false)
    expect(r.missedIds).toEqual(['mem_b'])
    expect(r.rate).toBe(0.5)
  })

  it('zero traps is ok', () => {
    expect(trapSurfaceSlo({ trapIds: [], message: null }).ok).toBe(true)
  })

  it('countSurfacedTrapIds partitions correctly', () => {
    const { surfaced, missed } = countSurfacedTrapIds('x mem_1 y', ['mem_1', 'mem_2'])
    expect(surfaced).toEqual(['mem_1'])
    expect(missed).toEqual(['mem_2'])
  })
})
