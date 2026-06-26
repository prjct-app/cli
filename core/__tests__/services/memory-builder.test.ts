/**
 * Vault memory builder — per-entry notes + connected, legible graph.
 *
 * Regression cover for the "all relationships lost in the vault" bug:
 * entries must be individual notes (Obsidian graph nodes = files),
 * cross-refs must be legible alias links (not `mem_N` keys, not
 * dangling), and relation tags must NOT fragment into orphan tag pages.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
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
    mk({
      id: 'mem_3206',
      content: 'second release note so the topic dimension is browsable',
      tags: { topic: 'release', once: 'single-use' },
    }),
  ]
  const files = buildTagFiles(entries, entries)
  const keys = [...files.keys()]

  it('does not emit relation-key tag pages (relates/resolves/closes)', () => {
    expect(keys.some((k) => k.includes('relates'))).toBe(false)
    expect(keys.some((k) => k.includes('resolves'))).toBe(false)
    expect(keys.some((k) => k.includes('closes'))).toBe(false)
  })

  it('emits a LINK-ONLY index page per category key — no content duplication', () => {
    expect(files.has('tags/topic.md')).toBe(true)
    const page = files.get('tags/topic.md') ?? ''
    // Wikilinks to the entry notes, never the entry content copied in
    // (the old model embedded full formatMemoryMd rows with provenance
    // markers and block anchors).
    expect(page).toMatch(/- \[\[[a-z0-9-]+\|[^\]]+\]\]/)
    expect(page).not.toContain('`DECL`')
    expect(page).not.toContain('^mem-')
    // No per-value pages at all (the old tags/<key>/<value>.md model).
    expect(keys.some((k) => /^tags\/[^/]+\//.test(k))).toBe(false)
  })

  it('emits a tags.md master index linking each key page', () => {
    const index = files.get('tags.md') ?? ''
    expect(index).toContain('[[tags/topic|topic]]')
  })

  it('a dimension used once gets no page (orphan-node guard)', () => {
    expect(files.has('tags/once.md')).toBe(false)
  })
})

describe('machine-signal quarantine — telemetry never becomes notes or tags', () => {
  const signal = mk({
    id: 'mem_900',
    type: 'learning',
    content: 'Hot file: `core/x.ts` — 3 touches in the last 7 days. Worth a refactor pass.',
    tags: { source: 'pattern-detector-auto', pattern: 'hot-file', file: 'core/x.ts', touches: '3' },
    provenance: 'inferred',
  })
  const improvement = mk({
    id: 'mem_901',
    type: 'improvement-signal',
    content: 'skill-miss: unused project knowledge mem_902',
    tags: { source: 'skill-miss-detector' },
    provenance: 'inferred',
  })
  const knowledge = mk({
    id: 'mem_902',
    type: 'gotcha',
    content: 'Real trap worth its own note. See mem_900 for the churn signal.',
    tags: { topic: 'storage' },
  })
  const all = [signal, improvement, knowledge]

  it('signal entries get no per-entry note and no MOC row', () => {
    const files = buildMemoryFiles(all, all)
    expect([...files.keys()].some((k) => k.startsWith('memory/learning/'))).toBe(false)
    expect(files.has('memory/improvement-signal.md')).toBe(false)
    const gotchaMoc = files.get('memory/gotcha.md') ?? ''
    expect(gotchaMoc).toContain('Real trap')
  })

  it('signal entries get no tag pages either', () => {
    const files = buildTagFiles(all, all)
    const bodies = [...files.values()].join('\n')
    expect(bodies).not.toContain('Hot file')
  })

  it('refs to a signal id resolve into signals.md, not a dangling node', () => {
    const files = buildMemoryFiles(all, all)
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/gotcha/'))?.[1] ?? ''
    expect(note).toContain('[[signals#^mem-900|')
  })
})

describe('frontmatter — native Obsidian tag list', () => {
  it('emits tags: [key/value] and hides machine/relation keys', () => {
    const entries = [
      mk({
        id: 'mem_10',
        content: 'A decision with mixed tags worth keeping around',
        tags: {
          topic: 'Daemon Lazy Loading',
          source: 'analysis',
          session: 'abc-123',
          resolves: 'mem_9',
        },
      }),
    ]
    const files = buildMemoryFiles(entries, entries)
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/decision/'))?.[1] ?? ''
    expect(note).toContain('tags: [topic/daemon-lazy-loading]')
    expect(note).not.toContain('session')
    expect(note).not.toMatch(/tags:.*resolves/)
  })
})

describe('PER_ENTRY_TYPES contract', () => {
  it('covers substantive types, excludes ephemeral GTD (inbox/todo/idea)', () => {
    expect(PER_ENTRY_TYPES.has('decision')).toBe(true)
    expect(PER_ENTRY_TYPES.has('context')).toBe(true)
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

  it('context entries get their own rich note for humans and LLMs', () => {
    const entries = [
      mk({
        id: 'mem_2',
        type: 'context',
        content:
          'What happened: completed a task · Why it mattered: future agents need the lesson · Feature/domain: memory',
      }),
    ]
    const files = buildMemoryFiles(entries, entries)
    expect([...files.keys()].some((k) => k.startsWith('memory/context/'))).toBe(true)
    const note = [...files.entries()].find(([k]) => k.startsWith('memory/context/'))?.[1] ?? ''
    expect(note).toContain('# context:')
    expect(note).toContain('What happened: completed a task')
  })
})
