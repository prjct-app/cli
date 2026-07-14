import { describe, expect, it } from 'bun:test'
import { detectCbm, formatCbmStatus } from '../../services/cbm-bridge'

describe('cbm-bridge', () => {
  it('detectCbm returns a structured status without throwing', async () => {
    const s = await detectCbm()
    expect(typeof s.available).toBe('boolean')
    expect(typeof s.note).toBe('string')
    const line = formatCbmStatus(s)
    expect(line.includes('CBM')).toBe(true)
  })
})
