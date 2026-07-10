/**
 * Retention score — value-based cleanup verdicts.
 *
 * Pins: usage (usefulness ledger) keeps entries active; superseded/corrected
 * entries sink; exact-fingerprint duplicates flag the OLDER copy; generated
 * noise is deletable; protected types never get a `delete` verdict; fresh
 * entries get a grace period; the whole evaluation is read-only.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { MemoryEntry } from '../../memory/entries'
import { projectMemory } from '../../memory/project-memory'
import {
  collectDuplicateIds,
  collectRetentionInputs,
  evaluateRetention,
  type RetentionInputs,
  scoreEntry,
} from '../../services/retention'
import { usefulnessService } from '../../services/usefulness'
import prjctDb from '../../storage/database'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

let tmpRoot: string
let projectId: string

const NOW = Date.parse('2026-07-10T00:00:00.000Z')
const DAY = 86_400_000
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

const entry = (over: Partial<MemoryEntry>): MemoryEntry => ({
  id: 'mem_1',
  type: 'decision',
  content: 'a decision about the architecture of the system that matters',
  tags: {},
  rememberedAt: iso(90 * DAY),
  provenance: 'declared',
  ...over,
})

const inputs = (over: Partial<RetentionInputs>): RetentionInputs => ({
  entries: [],
  usefulness: new Map(),
  supersededIds: new Set(),
  correctedIds: new Set(),
  indexedPaths: null,
  nowMs: NOW,
  ...over,
})

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-retention-'))
  projectId = `test-retention-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  patchPathManager(tmpRoot)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0') // force migrations
})

afterEach(async () => {
  restorePathManager()
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('scoreEntry — verdicts', () => {
  it('a used, grounded, current entry stays active', () => {
    const e = entry({ id: 'mem_used' })
    const r = scoreEntry(e, inputs({ usefulness: new Map([['mem_used', 2.5]]) }), new Set())
    expect(r.verdict).toBe('active')
    expect(r.reasons.join(' ')).toContain('used')
  })

  it('an old unused entry with no strikes still stays active (base + nothing negative)', () => {
    const e = entry({ id: 'mem_idle', rememberedAt: iso(300 * DAY) })
    const r = scoreEntry(e, inputs({}), new Set())
    expect(r.verdict).toBe('active')
  })

  it('a superseded old entry sinks to archive', () => {
    const e = entry({ id: 'mem_old', rememberedAt: iso(200 * DAY) })
    const r = scoreEntry(e, inputs({ supersededIds: new Set(['mem_old']) }), new Set())
    expect(r.verdict).toBe('archive')
    expect(r.reasons).toContain('superseded')
  })

  it('a corrected entry sinks', () => {
    const e = entry({ id: 'mem_wrong', rememberedAt: iso(200 * DAY) })
    const r = scoreEntry(e, inputs({ correctedIds: new Set(['mem_wrong']) }), new Set())
    expect(r.verdict).toBe('archive')
    expect(r.reasons).toContain('corrected')
  })

  it('old generated noise that is also a duplicate gets delete', () => {
    const e = entry({
      id: 'mem_noise',
      type: 'improvement-signal',
      rememberedAt: iso(200 * DAY),
    })
    const r = scoreEntry(e, inputs({}), new Set(['mem_noise']))
    expect(r.verdict).toBe('delete')
  })

  it('type floor: a decision never gets delete, worst case archive', () => {
    const e = entry({
      id: 'mem_dec',
      type: 'decision',
      rememberedAt: iso(300 * DAY),
    })
    const r = scoreEntry(
      e,
      inputs({ supersededIds: new Set(['mem_dec']), correctedIds: new Set(['mem_dec']) }),
      new Set(['mem_dec'])
    )
    expect(r.verdict).toBe('archive')
    expect(r.reasons).toContain('protected type')
  })

  it('grace period: fresh entries stay active even with strikes', () => {
    const e = entry({ id: 'mem_fresh', type: 'context', rememberedAt: iso(2 * DAY) })
    const r = scoreEntry(e, inputs({ correctedIds: new Set(['mem_fresh']) }), new Set())
    expect(r.verdict).toBe('active')
    expect(r.reasons).toContain('grace period')
  })

  it('grace does NOT rescue a fresh duplicate', () => {
    const e = entry({ id: 'mem_dup', type: 'context', rememberedAt: iso(2 * DAY) })
    const r = scoreEntry(e, inputs({ correctedIds: new Set(['mem_dup']) }), new Set(['mem_dup']))
    expect(r.verdict).not.toBe('active')
  })

  it('ungrounded: citing only files missing from the index is penalized', () => {
    const grounded = entry({
      id: 'mem_g',
      content: 'see core/services/real.ts for the pattern',
      rememberedAt: iso(200 * DAY),
    })
    const ungrounded = entry({
      id: 'mem_u',
      content: 'see core/services/deleted.ts for the pattern',
      rememberedAt: iso(200 * DAY),
    })
    const idx = new Set(['core/services/real.ts'])
    const rg = scoreEntry(grounded, inputs({ indexedPaths: idx }), new Set())
    const ru = scoreEntry(ungrounded, inputs({ indexedPaths: idx }), new Set())
    expect(rg.score).toBeGreaterThan(ru.score)
    expect(ru.reasons).toContain('cites files missing at HEAD')
  })

  it('no code index means groundedness is skipped, not failed', () => {
    const e = entry({
      id: 'mem_noidx',
      content: 'see core/services/whatever.ts',
      rememberedAt: iso(200 * DAY),
    })
    const r = scoreEntry(e, inputs({ indexedPaths: null }), new Set())
    expect(r.reasons).not.toContain('cites files missing at HEAD')
  })
})

describe('evaluateRetention — end to end over storage (read-only)', () => {
  it('scores real entries and mutates nothing', async () => {
    await projectMemory.remember(tmpRoot, {
      type: 'decision',
      content: 'we chose SQLite as the single source of truth',
      projectId,
    })
    await projectMemory.remember(tmpRoot, {
      type: 'context',
      content: 'short blob',
      projectId,
    })
    const before = projectMemory.allEntriesForIndex(projectId).length
    expect(before).toBeGreaterThanOrEqual(2)

    const report = evaluateRetention(projectId, NOW)
    expect(report.evaluated).toBe(before)
    expect(report.active + report.archive + report.delete).toBe(report.evaluated)
    // Read-only guarantee: nothing was removed or added.
    expect(projectMemory.allEntriesForIndex(projectId)).toHaveLength(before)
  })

  it('capture-time dedup already collapses verbatim repeats (retention is the backstop)', async () => {
    await projectMemory.remember(tmpRoot, {
      type: 'context',
      content: 'Session close: identical text captured twice by a retry',
      projectId,
    })
    await projectMemory.remember(tmpRoot, {
      type: 'context',
      content: 'Session close: identical text captured twice by a retry',
      projectId,
    })
    // The second remember collapsed into the first — nothing for retention to flag.
    expect(projectMemory.allEntriesForIndex(projectId)).toHaveLength(1)
  })

  it('collectDuplicateIds flags the older copy only (pre-dedup historical entries)', () => {
    const older = entry({ id: 'mem_old_dup', rememberedAt: iso(100 * DAY) })
    const newer = entry({ id: 'mem_new_dup', rememberedAt: iso(10 * DAY) })
    const unrelated = entry({
      id: 'mem_other',
      content: 'a completely different piece of knowledge',
      rememberedAt: iso(50 * DAY),
    })
    const dups = collectDuplicateIds([older, newer, unrelated])
    expect(dups.has('mem_old_dup')).toBe(true)
    expect(dups.has('mem_new_dup')).toBe(false)
    expect(dups.has('mem_other')).toBe(false)
  })

  it('usefulness credit from the ledger flows into the score', async () => {
    await projectMemory.remember(tmpRoot, {
      type: 'gotcha',
      content: 'daemon holds RW handles over prjct.db during sync',
      projectId,
    })
    const [e] = projectMemory.allEntriesForIndex(projectId)
    usefulnessService.recordFetch(projectId, e.id, new Date(NOW).toISOString())

    const withCredit = collectRetentionInputs(projectId, NOW)
    expect(withCredit.usefulness.get(e.id) ?? 0).toBeGreaterThan(0)
  })
})
