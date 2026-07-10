import { describe, expect, test } from 'bun:test'
import { buildClosedLoopHealth } from '../../services/closed-loop-health'

describe('buildClosedLoopHealth', () => {
  test('returns a closed-loop line shape without throwing for empty project id queries', () => {
    // Pure shape check: function must return the health line even when DB is empty/missing.
    // Use a random id that won't have data — counts stay 0, line still formats.
    const h = buildClosedLoopHealth('00000000-0000-0000-0000-000000000000')
    expect(h.line).toContain('Closed-loop judgment')
    expect(h.line).toContain('receipts=')
    expect(h.line).toContain('conflict warn/deny=')
    expect(typeof h.receipts7d).toBe('number')
    expect(typeof h.conflictWarns7d).toBe('number')
    expect(typeof h.conflictDenies7d).toBe('number')
  })
})
