/**
 * Cold purge: soft-deleted vacuum, orphan events, auto-source cap.
 * Runs on prjct sync — makes "delete" actually free disk over time.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { projectMemory } from '../../memory/project-memory'
import {
  isAutoSource,
  purgeSoftDeleted,
  runVaultPurge,
  trimAutoSourceCap,
  vaultHealth,
} from '../../services/retention/purge'
import prjctDb from '../../storage/database'
import { patchPathManager, restorePathManager } from '../_setup/path-manager-mock'

let tmpRoot: string
let projectId: string

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-purge-'))
  projectId = `test-purge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  patchPathManager(tmpRoot)
  prjctDb.run(projectId, 'SELECT 1 WHERE 1=0')
})

afterEach(async () => {
  restorePathManager()
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('isAutoSource', () => {
  it('matches known auto prefixes', () => {
    expect(isAutoSource('pattern-detector-auto')).toBe(true)
    expect(isAutoSource('transcript-auto')).toBe(true)
    expect(isAutoSource('skill-miss-detector')).toBe(true)
    expect(isAutoSource('friction-detector')).toBe(true)
    expect(isAutoSource('land-auto')).toBe(true)
    expect(isAutoSource(undefined)).toBe(false)
    expect(isAutoSource('manual-review')).toBe(false)
  })
})

describe('purgeSoftDeleted', () => {
  it('hard-deletes rows with old deleted_at and leaves live rows', () => {
    const old = Date.now() - 60 * 86_400_000
    const recent = Date.now() - 2 * 86_400_000
    prjctDb.run(
      projectId,
      `INSERT INTO memory_entries (
        id, project_id, type, title, content, provenance, content_hash,
        user_triggered, revision_count, created_at, updated_at, deleted_at
      ) VALUES
        ('mem_9001', ?, 'context', 'old', 'old deleted content here for purge test xx', 'extracted', 'h1', 0, 0, ?, ?, ?),
        ('mem_9002', ?, 'context', 'new', 'recently deleted content still in grace period xx', 'extracted', 'h2', 0, 0, ?, ?, ?),
        ('mem_9003', ?, 'decision', 'live', 'live decision that must never be purged by soft-delete vacuum', 'declared', 'h3', 0, 0, ?, ?, NULL)`,
      projectId,
      old,
      old,
      old,
      projectId,
      recent,
      recent,
      recent,
      projectId,
      Date.now(),
      Date.now()
    )

    const n = purgeSoftDeleted(projectId, 30, 100)
    expect(n).toBe(1)
    const gone = prjctDb.get<{ c: number }>(
      projectId,
      "SELECT COUNT(*) AS c FROM memory_entries WHERE id = 'mem_9001'"
    )
    expect(gone?.c).toBe(0)
    const grace = prjctDb.get<{ c: number }>(
      projectId,
      "SELECT COUNT(*) AS c FROM memory_entries WHERE id = 'mem_9002'"
    )
    expect(grace?.c).toBe(1)
    const live = prjctDb.get<{ c: number }>(
      projectId,
      "SELECT COUNT(*) AS c FROM memory_entries WHERE id = 'mem_9003' AND deleted_at IS NULL"
    )
    expect(live?.c).toBe(1)
  })
})

describe('trimAutoSourceCap', () => {
  it('soft-deletes oldest auto-source rows beyond maxLive', async () => {
    for (let i = 0; i < 5; i++) {
      await projectMemory.remember(tmpRoot, {
        type: 'learning',
        content: `auto pattern finding number ${i} with enough characters to pass length gates xx`,
        tags: { source: 'pattern-detector-auto' },
        projectId,
        // Bypass capture gate for setup — gate may reject low excess
        // by using unique content above; still may hit gate. Force via SQL if needed.
      })
    }
    // If gate blocked some, seed via SQL
    const live = projectMemory
      .allEntriesForIndex(projectId)
      .filter((e) => e.tags?.source === 'pattern-detector-auto')
    if (live.length < 5) {
      for (let i = live.length; i < 5; i++) {
        const id = `mem_8${100 + i}`
        const t = Date.now() - (5 - i) * 86_400_000
        prjctDb.run(
          projectId,
          `INSERT INTO memory_entries (
            id, project_id, type, title, content, provenance, content_hash,
            user_triggered, revision_count, created_at, updated_at, deleted_at
          ) VALUES (?, ?, 'learning', 'p', ?, 'inferred', ?, 0, 0, ?, ?, NULL)`,
          id,
          projectId,
          `forced auto pattern seed ${i} unique body for cap test ${Math.random()}`,
          `hash-auto-${i}`,
          t,
          t
        )
        prjctDb.run(
          projectId,
          'INSERT INTO memory_entry_tags (entry_id, key, value, is_machine) VALUES (?, ?, ?, 0)',
          id,
          'source',
          'pattern-detector-auto'
        )
      }
    }

    const trimmed = trimAutoSourceCap(projectId, 2)
    expect(trimmed).toBeGreaterThanOrEqual(1)
    const after = projectMemory
      .allEntriesForIndex(projectId)
      .filter((e) => e.tags?.source === 'pattern-detector-auto')
    expect(after.length).toBeLessThanOrEqual(2)
  })
})

describe('vaultHealth + runVaultPurge', () => {
  it('reports inventory and dry-run purges nothing', async () => {
    await projectMemory.remember(tmpRoot, {
      type: 'decision',
      content: 'we only keep model knowledge durable everything else ages out of the vault',
      projectId,
    })
    const h = vaultHealth(projectId)
    expect(h.live).toBeGreaterThanOrEqual(1)
    const dry = runVaultPurge(projectId, { dryRun: true })
    expect(dry.softDeletedPurged + dry.archivesPruned).toBe(0)
  })
})
