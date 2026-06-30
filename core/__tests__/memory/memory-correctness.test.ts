/**
 * Correctness regressions for the v2 memory projection (audit F1, F2, F4):
 * real content fingerprint (not synthetic), type-aware dedup index (same
 * content under two types both survive), and the trigger covering raw events
 * (events-only path) so recall is never empty.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import configManager from '../../infrastructure/config-manager'
import pathManager from '../../infrastructure/path-manager'
import { memoryFingerprint } from '../../memory/content-fingerprint'
import { projectMemory } from '../../memory/project-memory'
import prjctDb from '../../storage/database'

let tmpRoot: string
let projectRoot: string
const projectId = 'mem-correctness-test'
const spies: Array<ReturnType<typeof spyOn>> = []

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-mem-corr-'))
  projectRoot = path.join(tmpRoot, 'proj')
  await fs.mkdir(path.join(projectRoot, '.prjct'), { recursive: true })
  await fs.writeFile(
    path.join(projectRoot, '.prjct', 'prjct.config.json'),
    JSON.stringify({ projectId, dataPath: '' }, null, 2)
  )
  spies.push(
    spyOn(pathManager, 'getGlobalProjectPath').mockImplementation((pid: string) =>
      path.join(tmpRoot, 'globals', pid)
    )
  )
  await fs.mkdir(path.join(tmpRoot, 'globals', projectId), { recursive: true })
  prjctDb.getDb(projectId)
})

afterEach(async () => {
  prjctDb.close()
  for (const s of spies) s.mockRestore()
  spies.length = 0
  ;(configManager as { clearCache?: () => void }).clearCache?.()
  await fs.rm(tmpRoot, { recursive: true, force: true })
})

describe('memory_entries correctness', () => {
  it('stores the REAL content fingerprint (not a synthetic evt_ hash)', async () => {
    const content = 'Use SQLite WAL mode for concurrency.'
    await projectMemory.remember(projectRoot, { type: 'decision', content, projectId })
    const row = prjctDb.query<{ content_hash: string }>(
      projectId,
      'SELECT content_hash FROM memory_entries LIMIT 1'
    )[0]
    expect(row.content_hash).toBe(memoryFingerprint(content))
    expect(row.content_hash.startsWith('evt_')).toBe(false)
  })

  it('F4: same content under two types both survive (type-aware dedup)', async () => {
    await projectMemory.remember(projectRoot, {
      type: 'decision',
      content: 'Use Postgres',
      projectId,
    })
    await projectMemory.remember(projectRoot, { type: 'fact', content: 'Use Postgres', projectId })
    const decisions = projectMemory.recall(projectId, { types: ['decision'] })
    const facts = projectMemory.recall(projectId, { types: ['fact'] })
    expect(decisions.length).toBe(1)
    expect(facts.length).toBe(1)
  })

  it('F1: trigger covers raw events (events-only path) — recall is not empty', () => {
    // Simulate a writer that bypasses remember()/memories entirely.
    prjctDb.appendEvent(projectId, 'memory.remember.gotcha', {
      content: 'Raw event path',
      tags: { file: 'a.ts' },
      provenance: 'declared',
    })
    const entries = projectMemory.recall(projectId, { types: ['gotcha'] })
    expect(entries.length).toBe(1)
    expect(entries[0].content).toBe('Raw event path')
    expect(entries[0].tags.file).toBe('a.ts')
  })

  it('F2: the newest entry per key wins in recall (ordering)', async () => {
    await projectMemory.remember(projectRoot, {
      type: 'decision',
      content: 'DB: MySQL',
      tags: { key: 'db-choice' },
      projectId,
    })
    await projectMemory.remember(projectRoot, {
      type: 'decision',
      content: 'DB: Postgres (updated)',
      tags: { key: 'db-choice' },
      projectId,
    })
    const got = projectMemory.recall(projectId, { types: ['decision'] })
    expect(got.length).toBe(1)
    expect(got[0].content).toBe('DB: Postgres (updated)')
  })
})
