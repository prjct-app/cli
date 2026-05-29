/**
 * projectMemory.recall — author-declared compaction (supersede / duplicate).
 *
 * Stale entries the author explicitly retired must drop out of recall so the
 * agent isn't handed an obsolete decision next to the one that replaced it.
 * Author-declared, not heuristic: nothing is pruned unless the relationship
 * was written down. The link/index layer can opt out so retired entries stay
 * resolvable (their wikilinks must not rot).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { projectMemory } from '../../memory/project-memory'
import prjctDb from '../../storage/database'

let tmpRoot: string
let projectId: string

const origGlobal = pathManager.getGlobalProjectPath.bind(pathManager)
const origStorage = pathManager.getStoragePath.bind(pathManager)
const origFile = pathManager.getFilePath.bind(pathManager)

function write(type: string, content: string, tags: Record<string, string> = {}): string {
  prjctDb.appendEvent(projectId, `memory.remember.${type}`, {
    content,
    tags,
    provenance: 'declared',
  })
  // Keep pruning/dedupe OFF here so we always get the id of the entry we
  // just wrote, even when it self-declares `superseded-by`.
  const latest = projectMemory.recall(projectId, {
    limit: 1,
    dedupeByKey: false,
    pruneSuperseded: false,
  })
  return latest[0]?.id ?? ''
}

const ids = (entries: { id: string }[]) => entries.map((e) => e.id)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-supersede-'))
  projectId = `test-sup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(tmpRoot, id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(tmpRoot, id, layer, filename)
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = origGlobal
  pathManager.getStoragePath = origStorage
  pathManager.getFilePath = origFile
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('projectMemory.recall — supersede/duplicate compaction', () => {
  it('drops an entry retired by a newer `supersedes:` entry', () => {
    const old = write('decision', 'use npm')
    write('decision', 'use bun instead', { supersedes: old })
    const got = ids(projectMemory.recall(projectId, { types: ['decision'] }))
    expect(got).not.toContain(old)
    expect(got.length).toBe(1)
  })

  it('drops an entry that self-declares `superseded-by:`', () => {
    const a = write('decision', 'legacy approach', { 'superseded-by': 'mem_99999' })
    const got = ids(projectMemory.recall(projectId, { types: ['decision'] }))
    expect(got).not.toContain(a)
  })

  it('drops an entry retired via `duplicates:`', () => {
    const orig = write('gotcha', 'WAL lock under iCloud')
    write('gotcha', 'iCloud sync lock (dupe)', { duplicates: orig })
    const got = ids(projectMemory.recall(projectId, { types: ['gotcha'] }))
    expect(got).not.toContain(orig)
  })

  it('keeps retired entries when pruneSuperseded:false (link/index layer)', () => {
    const old = write('decision', 'use npm')
    write('decision', 'use bun instead', { supersedes: old })
    const got = ids(
      projectMemory.recall(projectId, { types: ['decision'], pruneSuperseded: false })
    )
    expect(got).toContain(old)
    expect(got.length).toBe(2)
  })

  it('leaves unrelated entries untouched', () => {
    write('decision', 'alpha')
    write('decision', 'beta')
    const got = projectMemory.recall(projectId, { types: ['decision'] })
    expect(got.length).toBe(2)
  })
})
