import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'

const LONG = 'x'.repeat(600)

function entry(over: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: 'mem_1',
    type: 'decision',
    content: `A decision body. ${LONG}`,
    tags: { topic: 'token-efficiency', source: 'mem_99' },
    rememberedAt: '2026-06-28T00:00:00.000Z',
    provenance: 'declared',
    ...over,
  }
}

describe('formatMemoryMd compact mode', () => {
  it('emits one truncated line per entry — far smaller than full bodies', () => {
    const entries = [entry(), entry({ id: 'mem_2', type: 'gotcha' })]
    const full = formatMemoryMd(entries)
    const compact = formatMemoryMd(entries, { compact: true })
    expect(compact.length).toBeLessThan(full.length / 2)
    // No raw 600-char body leaks through.
    expect(compact).not.toContain(LONG)
    expect(compact).toContain('…')
  })

  it('keeps the resolvable id + type so progressive disclosure works', () => {
    const compact = formatMemoryMd([entry()], { compact: true })
    expect(compact).toContain('mem_1')
    expect(compact).toContain('· decision')
  })

  it('drops machine-tag noise from the scan list', () => {
    const compact = formatMemoryMd([entry()], { compact: true })
    expect(compact).not.toContain('source=mem_99')
  })

  it('does not wrap every row in <user_content> (lean over per-row boundary)', () => {
    const compact = formatMemoryMd([entry(), entry({ id: 'mem_2' })], {
      compact: true,
      boundary: 'llm',
    })
    expect(compact).not.toContain('<user_content')
  })

  it('leaves the full (legacy) output byte-identical when compact is unset', () => {
    const entries = [entry()]
    const a = formatMemoryMd(entries)
    const b = formatMemoryMd(entries, {})
    expect(a).toBe(b)
    // Full body is present in the non-compact path.
    expect(a).toContain(LONG)
  })

  it('handles an empty set', () => {
    expect(formatMemoryMd([], { compact: true })).toBe('> No matching memory entries.')
  })
})
