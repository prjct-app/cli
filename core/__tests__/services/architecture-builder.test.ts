/**
 * Baseline architecture synthesis — the deterministic `architecture.md` that
 * makes the "read architecture first" contract hold without an LLM analysis.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/project-memory'
import { buildArchitectureBaseline } from '../../services/wiki/architecture-builder'

function entry(id: string, type: string, content: string): MemoryEntry {
  return {
    id,
    type,
    content,
    tags: {},
    rememberedAt: '2026-05-31T00:00:00Z',
    provenance: 'declared',
  } as MemoryEntry
}

describe('buildArchitectureBaseline', () => {
  it('returns null when there are no decisions or gotchas', () => {
    const out = buildArchitectureBaseline([
      entry('mem_1', 'fact', 'the sky is blue'),
      entry('mem_2', 'idea', 'maybe add dark mode'),
    ])
    expect(out).toBeNull()
  })

  it('synthesizes decisions and gotchas into sections with mem refs', () => {
    const out = buildArchitectureBaseline([
      entry('mem_10', 'decision', 'Use node:sqlite to drop the native dependency.'),
      entry('mem_11', 'gotcha', 'The daemon holds a write lock — set busy_timeout.'),
      entry('mem_12', 'fact', 'ignored'),
    ])
    expect(out).not.toBeNull()
    expect(out).toContain('# Architecture')
    expect(out).toContain('## Key decisions')
    expect(out).toContain('## Known gotchas')
    expect(out).toContain('node:sqlite')
    expect(out).toContain('busy_timeout')
    expect(out).toContain('`mem_10`')
    expect(out).toContain('`mem_11`')
    // A non-decision/gotcha entry must not leak in.
    expect(out).not.toContain('ignored')
  })

  it('omits a section that has no entries', () => {
    const out = buildArchitectureBaseline([entry('mem_1', 'decision', 'Ship daily.')])
    expect(out).toContain('## Key decisions')
    expect(out).not.toContain('## Known gotchas')
  })

  it('caps each section at 20 entries', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      entry(`mem_${i}`, 'decision', `Decision number ${i} about the system.`)
    )
    const out = buildArchitectureBaseline(many)!
    const count = (out.match(/^- \*\*/gm) ?? []).length
    expect(count).toBe(20)
  })
})
