/**
 * Developer profile synthesis — the "know the developer" half of the model.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/project-memory'
import { buildDeveloperProfile } from '../../services/wiki/developer-profile-builder'

function entry(
  id: string,
  type: string,
  content: string,
  tags: Record<string, string> = {}
): MemoryEntry {
  return {
    id,
    type,
    content,
    tags,
    rememberedAt: '2026-05-31T00:00:00Z',
    provenance: 'declared',
  } as MemoryEntry
}

describe('buildDeveloperProfile', () => {
  it('returns null with no feedback and no friction', () => {
    expect(buildDeveloperProfile([entry('mem_1', 'decision', 'use sqlite')])).toBeNull()
  })

  it('synthesizes preferences from feedback and friction from pushback signals', () => {
    const out = buildDeveloperProfile([
      entry('mem_1', 'feedback', 'Author memory in English regardless of conversation language.'),
      entry('mem_2', 'improvement-signal', '[negation] User pushback: "no native deps"', {
        source: 'friction-detector',
      }),
      entry('mem_3', 'decision', 'unrelated decision'),
    ])
    expect(out).not.toBeNull()
    expect(out).toContain('# Developer profile')
    expect(out).toContain('## Preferences & guidance')
    expect(out).toContain('English')
    expect(out).toContain('## Friction history')
    expect(out).toContain('no native deps')
    expect(out).toContain('`mem_1`')
    expect(out).not.toContain('unrelated decision')
  })

  it('omits the friction section when there is no friction signal', () => {
    const out = buildDeveloperProfile([entry('mem_1', 'feedback', 'ship as minor')])
    expect(out).toContain('## Preferences & guidance')
    expect(out).not.toContain('## Friction history')
  })

  it('ignores improvement-signals that are not from the friction detector', () => {
    const out = buildDeveloperProfile([
      entry('mem_1', 'feedback', 'a rule'),
      entry('mem_2', 'improvement-signal', 'skill-miss noise', { source: 'skill-miss-detector' }),
    ])
    expect(out).not.toContain('## Friction history')
  })
})
