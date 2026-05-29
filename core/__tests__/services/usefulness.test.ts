/**
 * Memory reinforcement ledger — "smarter with use".
 *
 * Pins: reference/fetch signals accumulate a score, scores TIME-DECAY by
 * half-life, and recall re-ranking gives a BOUNDED usefulness boost (a
 * proven entry climbs, but relevance still leads and unscored entries keep
 * their order). Time is injected so decay is deterministic.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { MemoryEntry } from '../../memory/project-memory'
import { extractRefIds, usefulnessService } from '../../services/usefulness'
import prjctDb from '../../storage/database'

let tmpRoot: string
let projectId: string

const origGlobal = pathManager.getGlobalProjectPath.bind(pathManager)
const origStorage = pathManager.getStoragePath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)

const T0 = Date.parse('2026-01-01T00:00:00.000Z')
const T0_ISO = new Date(T0).toISOString()
const DAY = 86_400_000

const fakeEntry = (id: string): MemoryEntry =>
  ({
    id,
    type: 'decision',
    content: id,
    tags: {},
    rememberedAt: T0_ISO,
    provenance: 'declared',
  }) as MemoryEntry

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-useful-'))
  projectId = `test-useful-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(tmpRoot, id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(tmpRoot, id, layer, filename)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0') // force migrations
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = origGlobal
  pathManager.getStoragePath = origStorage
  pathManager.getFilePath = origFile
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('extractRefIds', () => {
  it('pulls ids from relationship tags and inline mentions', () => {
    const ids = extractRefIds('builds on mem_7 and mem_8', { resolves: 'mem_3', other: 'x' })
    expect(new Set(ids)).toEqual(new Set(['mem_3', 'mem_7', 'mem_8']))
  })
  it('returns [] when there are no refs', () => {
    expect(extractRefIds('no references here', {})).toHaveLength(0)
  })
})

describe('usefulnessService — accumulation + decay', () => {
  it('credits referenced ids and exposes their score', () => {
    usefulnessService.recordReferences(projectId, 'see mem_5', {}, T0_ISO)
    const scores = usefulnessService.decayedScores(projectId, T0)
    expect(scores.get('mem_5')).toBeCloseTo(1.0, 5)
  })

  it('a reference outweighs a fetch', () => {
    usefulnessService.recordReferences(projectId, 'mem_1', {}, T0_ISO)
    usefulnessService.recordFetch(projectId, 'mem_2', T0_ISO)
    const s = usefulnessService.decayedScores(projectId, T0)
    expect(s.get('mem_1')!).toBeGreaterThan(s.get('mem_2')!)
  })

  it('decays to ~half after one half-life (45d)', () => {
    usefulnessService.recordReferences(projectId, 'mem_9', {}, T0_ISO)
    const decayed = usefulnessService.decayedScores(projectId, T0 + 45 * DAY)
    expect(decayed.get('mem_9')).toBeCloseTo(0.5, 2)
  })

  it('accumulates repeated references', () => {
    usefulnessService.recordReferences(projectId, 'mem_4', {}, T0_ISO)
    usefulnessService.recordReferences(projectId, 'mem_4 again', {}, T0_ISO)
    expect(usefulnessService.decayedScores(projectId, T0).get('mem_4')).toBeCloseTo(2.0, 5)
  })
})

describe('usefulnessService.rerank', () => {
  it('lifts a proven entry above an unused one ranked just ahead of it', () => {
    // Give mem_2 a strong score; it starts BELOW mem_1 in relevance order.
    for (let i = 0; i < 5; i++) usefulnessService.recordReferences(projectId, 'mem_2', {}, T0_ISO)
    const ordered = [fakeEntry('mem_1'), fakeEntry('mem_2'), fakeEntry('mem_3')]
    const reranked = usefulnessService.rerank(projectId, ordered, T0)
    expect(reranked[0]?.id).toBe('mem_2')
  })

  it('is a no-op when nothing has a score (preserves order)', () => {
    const ordered = [fakeEntry('mem_1'), fakeEntry('mem_2'), fakeEntry('mem_3')]
    const reranked = usefulnessService.rerank(projectId, ordered, T0)
    expect(reranked.map((e) => e.id)).toEqual(['mem_1', 'mem_2', 'mem_3'])
  })

  it('boost is bounded — a tiny score cannot leap a far-more-relevant entry', () => {
    usefulnessService.recordFetch(projectId, 'mem_99', T0_ISO) // weak, single fetch
    // mem_99 is dead last in a long relevance-ordered list.
    const ordered = Array.from({ length: 10 }, (_, i) => fakeEntry(`mem_${i}`))
    ordered.push(fakeEntry('mem_99'))
    const reranked = usefulnessService.rerank(projectId, ordered, T0)
    // It may climb a few slots but must NOT reach the top.
    expect(reranked[0]?.id).toBe('mem_0')
  })
})
