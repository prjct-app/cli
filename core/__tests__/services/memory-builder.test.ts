/**
 * Vault memory builder — per-entry notes + connected, legible graph.
 *
 * Regression cover for the "all relationships lost in the vault" bug:
 * entries must be individual notes (Obsidian graph nodes = files),
 * cross-refs must be legible alias links (not `mem_N` keys, not
 * dangling), and relation tags must NOT fragment into orphan tag pages.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/project-memory'
import {
  buildMemoryFiles,
  buildTagFiles,
  PER_ENTRY_TYPES,
} from '../../services/wiki/memory-builder'

const mk = (over: Partial<MemoryEntry> & { id: string }): MemoryEntry => ({
  type: 'decision',
  content: '',
  tags: {},
  rememberedAt: '2026-05-17T00:00:00.000Z',
  provenance: 'declared',
  ...over,
})

describe('buildMemoryFiles — one note per entry', () => {
  const entries = [
    mk({
      id: 'mem_3264',
      type: 'decision',
      content: 'Opaque mem pointers fixed. resolves the dangling class',
      tags: { topic: 'memory-ux', pr: '356', resolves: 'mem_3233' },
    }),
    mk({
      id: 'mem_3233',
      type: 'feedback',
      content: 'mem_NNNN are opaque pointers: not resolvable by human or LLM',
      tags: { topic: 'memory-ux' },
    }),
  ]
  const files = buildMemoryFiles(entries, entries)
  const keys = [...files.keys()]

  it('emits a per-entry note at memory/<type>/<slug>.md', () => {
    const decisionNote = keys.find((k) => k.startsWith('memory/decision/'))
    expect(decisionNote).toBeTruthy()
    expect(decisionNote).not.toContain('mem_3264.md') // human slug, not the key
  })

  it('note carries aliases:[mem_N] + block anchor for stable resolution', () => {
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    expect(note).toContain('aliases: ["mem_3264"]')
    expect(note).toContain('^mem-3264')
    expect(note).toMatch(/^# decision: /m)
  })

  it('cross-ref links the target NOTE by basename, not the mem_N alias', () => {
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    expect(note).toContain('## Relations')
    // resolves=mem_3233 → [[<slug-of-3233>|title]] — slug, NOT [[mem_3233|…]]
    expect(note).not.toMatch(/\[\[mem_3233\b/) // alias-only link defeats the graph
    expect(note).toMatch(/\[\[[a-z0-9-]+\|[^\]]*opaque[^\]]*\]\]/i)
  })

  it('GRAPH INVARIANT: every [[target|label]] resolves to a real note basename', () => {
    // The v2.23.3 regression: links resolved only via frontmatter alias,
    // which Obsidian's graph ignores. Every link target must be an
    // emitted note's basename (or a type MOC) so the edge is drawn.
    const basenames = new Set<string>()
    for (const k of keys) {
      const m = k.match(/^memory\/[^/]+\/(.+)\.md$/)
      if (m) basenames.add(m[1])
      const moc = k.match(/^memory\/([^/]+)\.md$/)
      if (moc) basenames.add(moc[1]) // type MOC, also block-anchor host
    }
    for (const body of files.values()) {
      for (const [, target] of body.matchAll(/\[\[([^|\]#]+)(?:#[^|\]]+)?\|[^\]]+\]\]/g)) {
        if (/^mem_\d+$/.test(target)) throw new Error(`alias-only link: [[${target}]]`)
        expect(basenames.has(target)).toBe(true)
      }
    }
  })

  it('memory/<type>.md is a MOC that wikilinks each note by slug', () => {
    const moc = files.get('memory/decision.md') ?? ''
    expect(moc).toContain('# DECISION')
    expect(moc).not.toMatch(/\[\[mem_\d+\|/) // not alias links
    expect(moc).toMatch(/- \[\[[a-z0-9-]+\|[^\]]+\]\]/)
  })
})

describe('buildMemoryFiles — Defect B: refs to non-rendered ids still resolve', () => {
  it('an old referenced entry gets a note + a slug link the graph can draw', () => {
    const rendered = [
      mk({
        id: 'mem_3300',
        content: 'New decision that resolves an old one',
        tags: { resolves: 'mem_2609' },
      }),
    ]
    const all = [
      ...rendered,
      mk({ id: 'mem_2609', content: 'Closed an old daemon restart follow-up shipped' }),
    ]
    const files = buildMemoryFiles(all, all)
    // mem_2609 exists as a note (alias kept for CLI/click) AND its
    // basename is the link target so the graph edge is drawn.
    const note2609 = [...files.entries()].find(([, b]) => b.includes('aliases: ["mem_2609"]'))
    expect(note2609).toBeDefined()
    const slug2609 = note2609?.[0].match(/^memory\/[^/]+\/(.+)\.md$/)?.[1] ?? ''
    expect(slug2609).not.toBe('')
    const newNote = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    expect(newNote).not.toMatch(/\[\[mem_2609\b/) // not alias-only
    expect(newNote).toContain(`[[${slug2609}|`) // links the real note basename
  })
})

describe('buildTagFiles — Defect C: relation tags are NOT tag pages', () => {
  const entries = [
    mk({
      id: 'mem_3205',
      content: 'changelog root cause fixed',
      tags: { topic: 'release', resolves: 'mem_3135', relates: 'mem_2895', closes: 'mem_2604' },
    }),
  ]
  const files = buildTagFiles(entries, entries)
  const keys = [...files.keys()]

  it('does not emit tags/relates|resolves|closes/* orphan stubs', () => {
    expect(keys.some((k) => k.startsWith('tags/relates/'))).toBe(false)
    expect(keys.some((k) => k.startsWith('tags/resolves/'))).toBe(false)
    expect(keys.some((k) => k.startsWith('tags/closes/'))).toBe(false)
  })

  it('still emits real category tag pages (topic)', () => {
    expect(keys.some((k) => k.startsWith('tags/topic/'))).toBe(true)
  })
})

describe('PER_ENTRY_TYPES contract', () => {
  it('covers substantive types, excludes ephemeral GTD (inbox/todo/idea)', () => {
    expect(PER_ENTRY_TYPES.has('decision')).toBe(true)
    expect(PER_ENTRY_TYPES.has('gotcha')).toBe(true)
    expect(PER_ENTRY_TYPES.has('inbox')).toBe(false)
    expect(PER_ENTRY_TYPES.has('todo')).toBe(false)
    expect(PER_ENTRY_TYPES.has('idea')).toBe(false)
  })

  it('ephemeral types stay aggregated (no per-entry note dir)', () => {
    const entries = [mk({ id: 'mem_1', type: 'inbox', content: 'a stray thought to triage' })]
    const files = buildMemoryFiles(entries, entries)
    expect([...files.keys()].some((k) => k.startsWith('memory/inbox/'))).toBe(false)
    expect(files.has('memory/inbox.md')).toBe(true)
  })
})
