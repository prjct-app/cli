/**
 * Sovereign knowledge base (harness pillar 1 — workspace structure).
 *
 * KB facets (identity/voice/glossary/framework) are first-class memory types
 * authored in prjct's SQLite and PROJECTED to the vault — per-entry notes, a
 * MOC per facet, and a cohesive `knowledge.md` home. The KB never lands in a
 * client-repo instruction file (clean-repo doctrine); it is pulled on demand.
 */

import { describe, expect, it } from 'bun:test'
import { BASE_MEMORY_TYPES, KB_MEMORY_TYPES, type MemoryEntry } from '../../memory/entries'
import { buildMemoryFiles, PER_ENTRY_TYPES } from '../../services/wiki/memory-builder'

function entry(type: string, content: string, id: string): MemoryEntry {
  return {
    id,
    type,
    content,
    tags: {},
    rememberedAt: '2026-06-28T00:00:00Z',
    provenance: 'declared',
  }
}

describe('sovereign knowledge base', () => {
  it('exposes KB facets as first-class, capturable memory types', () => {
    for (const facet of KB_MEMORY_TYPES) {
      expect(BASE_MEMORY_TYPES).toContain(facet)
    }
  })

  it('wires every KB facet into the per-entry vault projection (no drift)', () => {
    for (const facet of KB_MEMORY_TYPES) {
      expect(PER_ENTRY_TYPES.has(facet)).toBe(true)
    }
  })

  it('projects KB entries to per-entry notes, a MOC per facet, and a cohesive knowledge.md', () => {
    const entries = [
      entry('voice', 'Terse, concrete, no hype. Lead with the decision.', 'mem_1'),
      entry('glossary', 'Ship: a verified, released unit of work.', 'mem_2'),
    ]
    const files = buildMemoryFiles(entries, entries)

    // Per-facet MOC hubs.
    expect(files.has('memory/voice.md')).toBe(true)
    expect(files.has('memory/glossary.md')).toBe(true)
    // Per-entry notes live under the facet folder.
    expect([...files.keys()].some((k) => k.startsWith('memory/voice/'))).toBe(true)
    expect([...files.keys()].some((k) => k.startsWith('memory/glossary/'))).toBe(true)

    // Cohesive KB home links the present facets...
    const kb = files.get('knowledge.md')
    expect(kb).toBeDefined()
    expect(kb).toContain('# Knowledge Base')
    expect(kb).toContain('[[memory/voice|Voice]]')
    expect(kb).toContain('[[memory/glossary|Glossary]]')
    // ...and locks the clean-repo doctrine into the surface itself.
    expect(kb).toContain('not in CLAUDE.md / AGENTS.md')
  })

  it('emits no knowledge.md when the project has no KB entries', () => {
    const entries = [entry('decision', 'Use SQLite as the single source of truth.', 'mem_9')]
    const files = buildMemoryFiles(entries, entries)
    expect(files.has('knowledge.md')).toBe(false)
  })
})
