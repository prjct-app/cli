/**
 * Migration `memory-dedup-content-hash` (v25) — backfills memories.content_hash
 * and purges historical verbatim duplicates from BOTH memory tables.
 *
 * The migration is idempotent, so the test seeds duplicates into a
 * fully-migrated DB and re-invokes the migration's `up()` directly — this
 * exercises the heal logic deterministically without depending on whether the
 * fresh-DB path happened to leave dups behind.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { prjctDb } from '../../storage/database'
import { migrations } from '../../storage/database/migrations'

const migration25 = migrations.find((m) => m.version === 25)
if (!migration25) throw new Error('migration v25 not found')

let tmpRoot: string
let projectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-dedup-mig-'))
  projectId = 'dedup-mig-test'
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  await fs.mkdir(path.join(tmpRoot, projectId), { recursive: true })
})

afterEach(async () => {
  prjctDb.close()
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

function seedMemory(id: string, type: string, content: string): void {
  // content_hash left NULL on purpose: simulates a row that landed before the
  // dedup net existed. created_at irrelevant to the (numeric-id) keep-earliest.
  prjctDb.run(
    projectId,
    `INSERT INTO memories
       (id, project_id, title, content, tags, type, provenance, user_triggered,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, '{}', ?, 'declared', 0, ?, ?)`,
    id,
    projectId,
    content.slice(0, 80),
    content,
    type,
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:00:00Z'
  )
}

describe('migration v25 — memory dedup + content_hash backfill', () => {
  it('backfills content_hash, keeps the earliest dup, soft-deletes the rest', () => {
    const db = prjctDb.getDb(projectId) // runs all migrations on a clean DB

    // Three verbatim copies (differing only in whitespace/case) + one distinct.
    seedMemory('mem_5', 'improvement-signal', 'No,   THIS is broken')
    seedMemory('mem_9', 'improvement-signal', 'no, this is broken')
    seedMemory('mem_12', 'improvement-signal', 'no, this is broken')
    seedMemory('mem_7', 'improvement-signal', 'a different signal entirely')

    migration25.up(db)

    // content_hash backfilled on every row.
    const hashed = prjctDb.query<{ id: string; content_hash: string | null }>(
      projectId,
      'SELECT id, content_hash FROM memories'
    )
    expect(hashed.every((r) => !!r.content_hash)).toBe(true)

    // The three normalized-equal copies collapse to the earliest (mem_5);
    // mem_9 and mem_12 are soft-deleted. The distinct one survives.
    const live = prjctDb.query<{ id: string }>(
      projectId,
      'SELECT id FROM memories WHERE deleted_at IS NULL ORDER BY id'
    )
    const liveIds = live.map((r) => r.id).sort()
    expect(liveIds).toEqual(['mem_5', 'mem_7'])

    // Soft, not hard — the demoted rows are still resolvable by id.
    const total = prjctDb.query<{ n: number }>(projectId, 'SELECT COUNT(*) AS n FROM memories')
    expect(total[0]!.n).toBe(4)
  })

  it('hard-deletes duplicate remember-events, keeping the earliest', () => {
    const db = prjctDb.getDb(projectId)

    // events carries the vault-index source; dup signals must not spawn files.
    const ins = (id: number, content: string) =>
      db
        .prepare(
          `INSERT INTO events (id, type, data, timestamp)
           VALUES (?, 'memory.remember.improvement-signal', ?, '2026-01-01T00:00:00Z')`
        )
        .run(id, JSON.stringify({ content }))
    ins(5, 'no, this is broken')
    ins(9, 'no, this is broken')
    ins(12, 'NO, this   is broken') // normalized-equal
    ins(7, 'a unique learning')

    migration25.up(db)

    const rows = prjctDb.query<{ id: number }>(
      projectId,
      "SELECT id FROM events WHERE type LIKE 'memory.remember.%' ORDER BY id"
    )
    expect(rows.map((r) => r.id)).toEqual([5, 7])
  })

  it('is idempotent (a second run is a no-op)', () => {
    const db = prjctDb.getDb(projectId)
    seedMemory('mem_5', 'gotcha', 'same trap')
    seedMemory('mem_9', 'gotcha', 'same trap')

    migration25.up(db)
    const after1 = prjctDb.query<{ n: number }>(
      projectId,
      'SELECT COUNT(*) AS n FROM memories WHERE deleted_at IS NULL'
    )[0]!.n
    migration25.up(db)
    const after2 = prjctDb.query<{ n: number }>(
      projectId,
      'SELECT COUNT(*) AS n FROM memories WHERE deleted_at IS NULL'
    )[0]!.n

    expect(after1).toBe(1)
    expect(after2).toBe(1)
  })
})
