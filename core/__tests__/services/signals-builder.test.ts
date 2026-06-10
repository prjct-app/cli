/**
 * signals.md — the single dashboard for machine telemetry.
 *
 * Locks the vault-v2 contract: detector output (hot-file churn,
 * skill-miss, friction) renders as ONE page with block anchors, so the
 * graph shows one hub node instead of dozens of telemetry stubs.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import { buildVaultOpts } from '../../services/wiki/memory-builder'
import { buildSignalsFile, isSignalEntry } from '../../services/wiki/signals-builder'

const mk = (over: Partial<MemoryEntry> & { id: string }): MemoryEntry => ({
  type: 'improvement-signal',
  content: '',
  tags: {},
  rememberedAt: '2026-06-10T00:00:00.000Z',
  provenance: 'inferred',
  ...over,
})

describe('isSignalEntry', () => {
  it('classifies improvement-signal and detector-sourced entries as signals', () => {
    expect(isSignalEntry(mk({ id: 'mem_1' }))).toBe(true)
    expect(
      isSignalEntry(
        mk({ id: 'mem_2', type: 'learning', tags: { source: 'pattern-detector-auto' } })
      )
    ).toBe(true)
    expect(
      isSignalEntry(mk({ id: 'mem_3', type: 'learning', tags: { source: 'friction-detector' } }))
    ).toBe(true)
  })

  it('keeps declared/extracted knowledge out (transcript-auto, analysis, user)', () => {
    expect(
      isSignalEntry(mk({ id: 'mem_4', type: 'learning', tags: { source: 'transcript-auto' } }))
    ).toBe(false)
    expect(isSignalEntry(mk({ id: 'mem_5', type: 'decision', tags: { source: 'analysis' } }))).toBe(
      false
    )
    expect(isSignalEntry(mk({ id: 'mem_6', type: 'gotcha' }))).toBe(false)
  })
})

describe('buildSignalsFile', () => {
  const signals = [
    mk({
      id: 'mem_100',
      type: 'learning',
      content: 'Hot file: `core/a.ts` — 4 touches in the last 7 days.',
      tags: { source: 'pattern-detector-auto', file: 'core/a.ts', touches: '4', window_days: '7' },
      rememberedAt: '2026-06-09T00:00:00.000Z',
    }),
    mk({
      id: 'mem_101',
      type: 'learning',
      content: 'Hot file: `core/a.ts` — 3 touches in the last 7 days.',
      tags: { source: 'pattern-detector-auto', file: 'core/a.ts', touches: '3', window_days: '7' },
      rememberedAt: '2026-06-02T00:00:00.000Z',
    }),
    mk({
      id: 'mem_102',
      content: 'skill-miss: unused project knowledge — agent re-read source instead of vault',
      tags: { source: 'skill-miss-detector' },
    }),
    mk({
      id: 'mem_103',
      content: '[workflow] User pushback: "no corras el ship manual"',
      tags: { source: 'friction-detector' },
    }),
  ]
  const body = buildSignalsFile(signals, buildVaultOpts(signals)) ?? ''

  it('returns null when there are no signals (no empty stub page)', () => {
    expect(buildSignalsFile([], buildVaultOpts([]))).toBeNull()
  })

  it('groups hot files by file with the newest entry leading', () => {
    expect(body).toContain('## Hot files')
    expect(body).toContain('`core/a.ts` — 4 touches in 7d')
    expect(body.indexOf('^mem-100')).toBeLessThan(body.indexOf('^mem-101'))
  })

  it('every signal keeps a block anchor so [[signals#^mem-N]] resolves', () => {
    for (const id of ['100', '101', '102', '103']) {
      expect(body).toContain(`^mem-${id}`)
    }
  })

  it('sections skill-misses and friction separately', () => {
    expect(body).toContain('## Knowledge being missed')
    expect(body).toContain('## Friction')
  })
})
