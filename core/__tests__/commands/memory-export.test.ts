/**
 * `prjct memory export|import` — git-shareable memory (gentle-ai learning #6).
 * Export writes chunked JSONL; import replays through the event path with
 * content-hash dedup (re-import = no-op, local knowledge never overwritten).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { MemoryExportCommands } from '../../commands/memory-export'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import { prjctDb } from '../../storage/database'

let tmpRoot: string
let projectPath: string
let projectId: string
const origGlobal = pathManager.getGlobalProjectPath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)
const cmd = new MemoryExportCommands()

describe('prjct memory export/import', () => {
  beforeEach(async () => {
    prjctDb.close()
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-memexp-'))
    projectId = `test-memexp-${Date.now()}`
    projectPath = path.join(tmpRoot, 'repo')
    pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, 'home', id)
    pathManager.getFilePath = (id: string, layer: string, filename: string) =>
      path.join(tmpRoot, 'home', id, layer, filename)
    await fs.mkdir(path.join(projectPath, '.prjct'), { recursive: true })
    await fs.writeFile(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({ projectId })
    )
    prjctDb.getDb(projectId)
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = origGlobal
    pathManager.getFilePath = origFile
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
  })

  it('round-trips: export → wipe → import restores entries with tags, deduped on re-import', async () => {
    // Let ensureInit settle the project identity first (an unregistered path
    // gets re-initialized with a fresh id), then use the REAL id throughout.
    await cmd.memory('export', projectPath, { md: true })
    const cfg = JSON.parse(
      await fs.readFile(path.join(projectPath, '.prjct', 'prjct.config.json'), 'utf-8')
    )
    projectId = cfg.projectId

    await projectMemory.remember(projectPath, {
      type: 'decision',
      content: 'use SQLite WAL',
      tags: { area: 'storage' },
      projectId,
    })
    await projectMemory.remember(projectPath, {
      type: 'gotcha',
      content: 'daemon caches stale code after upgrade',
      projectId,
    })

    const exp = await cmd.memory('export', projectPath, { md: true })
    expect(exp.success).toBe(true)
    const manifest = JSON.parse(
      await fs.readFile(path.join(projectPath, '.prjct', 'memory-export', 'manifest.json'), 'utf-8')
    )
    expect(manifest.entries).toBe(2)

    // Fresh machine: same export files, empty DB (new project id).
    const otherId = `${projectId}-clone`
    await fs.writeFile(
      path.join(projectPath, '.prjct', 'prjct.config.json'),
      JSON.stringify({ projectId: otherId })
    )
    prjctDb.getDb(otherId)

    const imp1 = await cmd.memory('import', projectPath, { md: true })
    expect(imp1.success).toBe(true)
    expect(imp1.imported).toBe(2)
    // ensureInit may have re-settled the clone's identity — query the REAL id.
    const cloneId = JSON.parse(
      await fs.readFile(path.join(projectPath, '.prjct', 'prjct.config.json'), 'utf-8')
    ).projectId
    const rows = prjctDb.query<{ type: string; content: string }>(
      cloneId,
      'SELECT type, content FROM memory_entries WHERE deleted_at IS NULL ORDER BY type'
    )
    expect(rows).toHaveLength(2)
    expect(rows[0].content).toBe('use SQLite WAL')
    // Tags survived the round trip.
    const tag = prjctDb.get<{ value: string }>(
      cloneId,
      "SELECT value FROM memory_entry_tags WHERE key = 'area' LIMIT 1"
    )
    expect(tag?.value).toBe('storage')

    // Re-import: full no-op.
    const imp2 = await cmd.memory('import', projectPath, { md: true })
    expect(imp2.imported).toBe(0)
    expect(imp2.skipped).toBe(2)
  })

  it('import without an export is a clear no-op', async () => {
    const r = await cmd.memory('import', projectPath, { md: true })
    expect(r.success).toBe(false)
  })
})
