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
import {
  deriveTitle,
  formatMemoryMd,
  linkifyMemRefs,
  type MemoryEntry,
  projectMemory,
} from '../../memory/project-memory'
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

  it('vault mode: UNKNOWN id → muted code, not a fake dangling node', () => {
    // Supersedes the old mem_3233 "bare [[mem_N]] clickable" rule: at
    // graph scale that produced the orphan-dot dust the user reported.
    // A deleted id is not knowledge — render it as honest muted text.
    const out = formatMemoryMd([mk({ id: 'mem_3247', content: 'see mem_999 for context' })], {
      vault: true,
      idTypeIndex: new Map(),
    })
    expect(out).toContain('see `mem_999` for context')
    expect(out).not.toContain('[[mem_999]]')
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

  describe('boundary:"llm" — data/instruction boundary for hook + MCP output', () => {
    it('wraps each entry in <user_content> tags carrying id + type', () => {
      const out = formatMemoryMd(
        [mk({ id: 'mem_42', type: 'learning', content: 'memoize the regex pool' })],
        { boundary: 'llm' }
      )
      expect(out).toContain('<user_content id="mem_42" type="learning">')
      expect(out).toContain('</user_content>')
      // The actual row stays between the tags
      const between = out.slice(
        out.indexOf('<user_content'),
        out.indexOf('</user_content>') + '</user_content>'.length
      )
      expect(between).toContain('memoize the regex pool')
    })

    it('escapes markdown control chars in tag values so attackers cannot inject wikilinks', () => {
      const out = formatMemoryMd(
        [
          mk({
            id: 'mem_99',
            content: 'innocent body',
            tags: { resolves: '[[../escape]]', label: '`code`' },
          }),
        ],
        { boundary: 'llm' }
      )
      // The raw `[[` and `` ` `` from tag values must NOT survive into output.
      // (Backslash-escaped forms are fine — they render as literal characters.)
      expect(out).not.toMatch(/(?:^|[^\\])\[\[\.\.\/escape\]\]/)
      expect(out).not.toMatch(/(?:^|[^\\])`code`/)
      // Escaped forms must be present
      expect(out).toContain('\\[\\[')
      expect(out).toContain('\\`code\\`')
    })

    it('does NOT wrap when boundary is omitted (CLI/vault paths stay byte-stable)', () => {
      const entry = mk({ id: 'mem_1', content: 'plain' })
      expect(formatMemoryMd([entry])).not.toContain('<user_content')
      expect(formatMemoryMd([entry], { vault: true })).not.toContain('<user_content')
    })
  })
})

describe('deriveTitle — deterministic, legible, no DB keys', () => {
  const mk = (over: Partial<MemoryEntry> & { id: string }): MemoryEntry => ({
    type: 'decision',
    content: '',
    tags: {},
    rememberedAt: '2026-05-17T00:00:00.000Z',
    provenance: 'declared',
    ...over,
  })

  it('cuts at the first strong clause boundary', () => {
    const t = deriveTitle(
      mk({ id: 'mem_3247', content: 'Triage-before-spec enforced in skill body: root cause was…' })
    )
    expect(t).toBe('Triage-before-spec enforced in skill body')
  })

  it('strips a leading mem ref / wikilink so the title starts on the statement', () => {
    const t = deriveTitle(
      mk({
        id: 'mem_3264',
        content: '[[feedback#^mem-3233|mem_3233]] opaque pointers FIXED. detail',
      })
    )
    expect(t).toBe('opaque pointers FIXED')
  })

  it('appends (PR #N) from the pr tag when not already present', () => {
    const t = deriveTitle(
      mk({ id: 'mem_1', content: 'Release debounce job added to CI', tags: { pr: '351' } })
    )
    expect(t).toBe('Release debounce job added to CI (PR #351)')
  })

  it('truncates long titles on a word boundary with an ellipsis', () => {
    const t = deriveTitle(mk({ id: 'mem_1', content: `${'a'.repeat(40)} ${'b'.repeat(40)}` }))
    expect(t.length).toBeLessThanOrEqual(74)
    expect(t.endsWith('…')).toBe(true)
  })

  it('falls back to "<type> <id>" when content yields no usable title', () => {
    expect(deriveTitle(mk({ id: 'mem_9', type: 'gotcha', content: '...' }))).toBe('gotcha mem_9')
  })

  it('is pure: same entry → same title', () => {
    const e = mk({ id: 'mem_5', content: 'Stable title here. body' })
    expect(deriveTitle(e)).toBe(deriveTitle(e))
  })
})

describe('linkifyMemRefs — slug-targeted links (graph-visible) + legible labels', () => {
  it('per-entry type → links the note BASENAME [[slug|title]] (graph draws it)', () => {
    // The v2.23.3 regression: [[mem_N|title]] resolved only via alias,
    // invisible to Obsidian's graph. Must target the real slug.
    const out = linkifyMemRefs('resolves=mem_3135', {
      idTypeIndex: new Map([['mem_3135', 'gotcha']]),
      idTitleIndex: new Map([['mem_3135', 'CHANGELOG Unreleased stranding']]),
      idSlugIndex: new Map([['mem_3135', 'changelog-unreleased-stranding']]),
      perEntryTypes: new Set(['gotcha']),
    })
    expect(out).toBe('resolves=[[changelog-unreleased-stranding|CHANGELOG Unreleased stranding]]')
    expect(out).not.toContain('[[mem_3135') // never alias-only
  })

  it('aggregated type (no slug) → block-anchor link with legible label', () => {
    const out = linkifyMemRefs('see mem_42', {
      idTypeIndex: new Map([['mem_42', 'inbox']]),
      idTitleIndex: new Map([['mem_42', 'upgrade noise item']]),
      perEntryTypes: new Set(['decision']),
    })
    expect(out).toBe('see [[inbox#^mem-42|upgrade noise item]]')
  })

  it('unknown id with no title → muted `mem_N` code (no fake node)', () => {
    expect(linkifyMemRefs('ref mem_999', { idTypeIndex: new Map() })).toBe('ref `mem_999`')
  })

  it('author-written [[mem_N]] is normalized through the same resolver', () => {
    // deleted id → muted code, NOT the broken [[`mem_N`]]
    expect(linkifyMemRefs('violates [[mem_2620]]', { idTypeIndex: new Map() })).toBe(
      'violates `mem_2620`'
    )
    // known per-entry id → slug link, graph-visible
    expect(
      linkifyMemRefs('see [[mem_42]]', {
        idTypeIndex: new Map([['mem_42', 'gotcha']]),
        idTitleIndex: new Map([['mem_42', 'busy_timeout CAS retry']]),
        idSlugIndex: new Map([['mem_42', 'busy-timeout-cas-retry']]),
        perEntryTypes: new Set(['gotcha']),
      })
    ).toBe('see [[busy-timeout-cas-retry|busy_timeout CAS retry]]')
  })

  it('backward compatible: no idTitleIndex → legacy mem_N label', () => {
    const out = linkifyMemRefs('resolves=mem_3135', {
      idTypeIndex: new Map([['mem_3135', 'gotcha']]),
    })
    expect(out).toBe('resolves=[[gotcha#^mem-3135|mem_3135]]')
  })
})
