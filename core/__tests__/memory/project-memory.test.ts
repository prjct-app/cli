/**
 * Project memory recall — latest-winner dedupe by (type, tags.key).
 *
 * Inspired by gstack's gstack-learnings-search "latest winner per
 * key+type" pattern. When the same key is asserted multiple times,
 * recall returns only the newest version. Entries without a key are
 * unaffected so the open-ended "remember any thought" use case still
 * accumulates.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { formatMemoryMd, type MemoryEntry, projectMemory } from '../../memory/project-memory'
import prjctDb from '../../storage/database'

/**
 * Write a memory entry directly via the SQLite layer, bypassing the
 * configManager.getProjectId() round-trip (which requires a fully
 * initialized .prjct/ directory). Mirrors the schema written by
 * memoryService.log: events.type = `memory.remember.<type>`, data is
 * the JSON payload.
 */
async function writeMemoryEntry(args: {
  type: string
  content: string
  tags?: Record<string, string>
}): Promise<void> {
  prjctDb.appendEvent(projectId, `memory.remember.${args.type}`, {
    content: args.content,
    tags: args.tags ?? {},
    provenance: 'declared',
  })
}

let tmpRoot: string
let projectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-memory-test-'))
  projectId = `test-mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  pathManager.getGlobalProjectPath = (id: string) => path.join(tmpRoot, id)
  pathManager.getStoragePath = (id: string, filename: string) =>
    path.join(tmpRoot, id, 'storage', filename)
  pathManager.getFilePath = (id: string, layer: string, filename: string) =>
    path.join(tmpRoot, id, layer, filename)
})

afterEach(async () => {
  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  pathManager.getStoragePath = originalGetStoragePath
  pathManager.getFilePath = originalGetFilePath
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
})

describe('projectMemory.recall — dedupeByKey', () => {
  it('returns all entries when none have a key tag', async () => {
    await writeMemoryEntry({
      type: 'decision',
      content: 'use Bun runtime',
      tags: {},
    })
    await writeMemoryEntry({
      type: 'decision',
      content: 'use SQLite WAL mode',
      tags: {},
    })

    const entries = projectMemory.recall(projectId, { types: ['decision'] })
    expect(entries.length).toBe(2)
  })

  it('keeps only the newest entry per (type, key) when keys collide', async () => {
    await writeMemoryEntry({
      type: 'decision',
      content: 'first version: use npm',
      tags: { key: 'package-manager' },
    })
    // Force a later timestamp by waiting >1ms (events.timestamp has ms precision).
    await new Promise((r) => setTimeout(r, 5))
    await writeMemoryEntry({
      type: 'decision',
      content: 'updated: use bun',
      tags: { key: 'package-manager' },
    })

    const entries = projectMemory.recall(projectId, { types: ['decision'] })
    expect(entries.length).toBe(1)
    expect(entries[0].content).toBe('updated: use bun')
  })

  it('does not collapse same key across different types', async () => {
    await writeMemoryEntry({
      type: 'decision',
      content: 'decided to retry',
      tags: { key: 'retry-strategy' },
    })
    await writeMemoryEntry({
      type: 'gotcha',
      content: 'retry can deadlock',
      tags: { key: 'retry-strategy' },
    })

    const entries = projectMemory.recall(projectId, { types: ['decision', 'gotcha'] })
    expect(entries.length).toBe(2)
  })

  it('preserves entries without keys alongside deduped keyed ones', async () => {
    await writeMemoryEntry({
      type: 'learning',
      content: 'no-key learning A',
      tags: {},
    })
    await writeMemoryEntry({
      type: 'learning',
      content: 'old version',
      tags: { key: 'core-insight' },
    })
    await new Promise((r) => setTimeout(r, 5))
    await writeMemoryEntry({
      type: 'learning',
      content: 'new version',
      tags: { key: 'core-insight' },
    })
    await writeMemoryEntry({
      type: 'learning',
      content: 'no-key learning B',
      tags: {},
    })

    const entries = projectMemory.recall(projectId, { types: ['learning'] })
    expect(entries.length).toBe(3)
    const contents = entries.map((e) => e.content).sort()
    expect(contents).toContain('no-key learning A')
    expect(contents).toContain('no-key learning B')
    expect(contents).toContain('new version')
    expect(contents).not.toContain('old version')
  })

  it('returns full history when dedupeByKey is explicitly disabled', async () => {
    await writeMemoryEntry({
      type: 'decision',
      content: 'v1',
      tags: { key: 'router' },
    })
    await new Promise((r) => setTimeout(r, 5))
    await writeMemoryEntry({
      type: 'decision',
      content: 'v2',
      tags: { key: 'router' },
    })

    const entries = projectMemory.recall(projectId, {
      types: ['decision'],
      dedupeByKey: false,
    })
    expect(entries.length).toBe(2)
    expect(entries[0].content).toBe('v2')
    expect(entries[1].content).toBe('v1')
  })
})

describe('projectMemory.getById — resolve an opaque mem_N reference', () => {
  it('resolves a mem_<id> (and bare numeric) to the full entry', async () => {
    await writeMemoryEntry({
      type: 'decision',
      content: 'pick Bun over Node',
      tags: { topic: 'rt' },
    })
    const [e] = projectMemory.recall(projectId, { types: ['decision'] })
    expect(e.id).toMatch(/^mem_\d+$/)

    const byMem = projectMemory.getById(projectId, e.id)
    expect(byMem).not.toBeNull()
    expect(byMem?.content).toBe('pick Bun over Node')
    expect(byMem?.type).toBe('decision')
    expect(byMem?.tags).toEqual({ topic: 'rt' })

    // Bare numeric and mem- variants resolve the same row.
    const bare = projectMemory.getById(projectId, e.id.replace('mem_', ''))
    expect(bare?.id).toBe(e.id)
    expect(projectMemory.getById(projectId, e.id.replace('_', '-'))?.id).toBe(e.id)
  })

  it('returns null for a non-existent / malformed id (no throw)', () => {
    expect(projectMemory.getById(projectId, 'mem_999999')).toBeNull()
    expect(projectMemory.getById(projectId, 'not-an-id')).toBeNull()
    expect(projectMemory.getById(projectId, '')).toBeNull()
  })
})

describe('formatMemoryMd — vault makes every mem_N navigable (mem_3233)', () => {
  const mk = (over: Partial<MemoryEntry> & { id: string }): MemoryEntry => ({
    type: 'decision',
    content: '',
    tags: {},
    rememberedAt: '2026-05-18T00:00:00.000Z',
    provenance: 'declared',
    ...over,
  })

  it('CLI mode (no opts) is plain — no anchor, no wikilink', () => {
    const out = formatMemoryMd([
      mk({ id: 'mem_3247', content: 'fixed via resolves=mem_3135', tags: { pr: '355' } }),
    ])
    expect(out).toContain('[mem_3247 · decision]')
    expect(out).not.toContain('^mem-3247') // no Obsidian block anchor in terminal
    expect(out).not.toContain('[[') // no wikilink in terminal
    expect(out).toContain('resolves=mem_3135') // stays plain text for grep
  })

  it('vault mode: every entry gets a ^mem-N block anchor', () => {
    const out = formatMemoryMd([mk({ id: 'mem_3247', content: 'x' })], { vault: true })
    // Anchor must be the LAST token on the bullet (Obsidian block-ref rule).
    const line = out.split('\n').find((l) => l.includes('mem_3247'))
    expect(line?.endsWith(' ^mem-3247')).toBe(true)
  })

  it('vault mode: cross-ref with KNOWN type → typed wikilink to its file', () => {
    const idTypeIndex = new Map([['mem_3135', 'gotcha']])
    const out = formatMemoryMd(
      [mk({ id: 'mem_3247', content: 'done', tags: { resolves: 'mem_3135' } })],
      { vault: true, idTypeIndex }
    )
    expect(out).toContain('resolves=[[gotcha#^mem-3135|mem_3135]]')
  })

  it('vault mode: UNKNOWN id → bare [[mem_N]] (clickable, not dead text)', () => {
    const out = formatMemoryMd([mk({ id: 'mem_3247', content: 'see mem_999 for context' })], {
      vault: true,
      idTypeIndex: new Map(),
    })
    expect(out).toContain('see [[mem_999]] for context')
  })

  it('vault mode: inline content mentions are linkified too, not just the meta tail', () => {
    const idTypeIndex = new Map([['mem_2895', 'feedback']])
    const out = formatMemoryMd([mk({ id: 'mem_3247', content: 'supersedes mem_2895 entirely' })], {
      vault: true,
      idTypeIndex,
    })
    expect(out).toContain('supersedes [[feedback#^mem-2895|mem_2895]] entirely')
  })

  it('regression lock: vault syntax never leaks into the CLI/terminal path', () => {
    const entries = [mk({ id: 'mem_3247', content: 'refs mem_1', tags: { relates: 'mem_2' } })]
    const cli = formatMemoryMd(entries)
    expect(cli).not.toMatch(/\^mem-|\[\[/)
  })
})
