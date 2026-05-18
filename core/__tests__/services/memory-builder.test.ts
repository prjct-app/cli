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

  it('cross-ref renders as a legible alias link, never a bare key', () => {
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    // resolves=mem_3233 → [[mem_3233|<title of 3233>]] (feedback is per-entry)
    expect(note).toContain('## Relations')
    expect(note).toMatch(/\[\[mem_3233\|[^\]]*opaque[^\]]*\]\]/i)
    expect(note).not.toContain('|mem_3233]]') // label is the title, not the key
  })

  it('memory/<type>.md is a MOC that wikilinks every entry note', () => {
    const moc = files.get('memory/decision.md') ?? ''
    expect(moc).toContain('# DECISION')
    expect(moc).toMatch(/- \[\[mem_3264\|[^\]]+\]\]/)
  })

  it('no dangling [[mem_N]] for an id present in the full set', () => {
    for (const body of files.values()) {
      expect(body).not.toMatch(/\[\[mem_3233\]\]/) // must be the labelled alias form
    }
  })
})

describe('buildMemoryFiles — Defect B: refs to non-rendered ids still resolve', () => {
  it('an old referenced entry gets a note so [[mem_N|title]] is not dangling', () => {
    const rendered = [
      mk({
        id: 'mem_3300',
        content: 'New decision that resolves an old one',
        tags: { resolves: 'mem_2609' },
      }),
    ]
    const all = [
      ...rendered,
      mk({ id: 'mem_2609', content: 'Closed mem_2525 daemon restart follow-up shipped' }),
    ]
    const files = buildMemoryFiles(all, all)
    // mem_2609 must exist as a note carrying its alias
    const has2609 = [...files.values()].some((b) => b.includes('aliases: ["mem_2609"]'))
    expect(has2609).toBe(true)
    const newNote = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    expect(newNote).toMatch(/\[\[mem_2609\|/) // legible, resolvable
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
