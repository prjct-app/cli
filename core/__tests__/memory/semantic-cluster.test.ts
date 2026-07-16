/**
 * Semantic cluster — cross-language dups, keep-fullest, no over-collapse.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'
import {
  clusterMemoryEntries,
  collapseEntriesForSurface,
  extractKeyEntities,
  fullnessScore,
  shouldClusterPair,
} from '../../memory/semantic-cluster'

function entry(
  partial: Partial<MemoryEntry> & Pick<MemoryEntry, 'id' | 'type' | 'content'>
): MemoryEntry {
  return {
    tags: {},
    rememberedAt: new Date().toISOString(),
    provenance: 'declared',
    ...partial,
  }
}

describe('extractKeyEntities', () => {
  it('captures RLS and RPC-like anchors', () => {
    const e = extractKeyEntities(
      'No era RLS: search_inventory is SECURITY DEFINER; use can_access_company'
    )
    expect(e.has('rls')).toBe(true)
    expect(e.has('search_inventory')).toBe(true)
    expect(e.has('can_access_company')).toBe(true)
    expect(e.has('security definer')).toBe(true)
  })
})

describe('shouldClusterPair / ES-EN RLS', () => {
  it('clusters Spanish and English variants of the same trap', () => {
    const a = entry({
      id: 'mem_1',
      type: 'gotcha',
      content: 'No era RLS — search_inventory es SECURITY DEFINER y bypasea policies',
    })
    const b = entry({
      id: 'mem_2',
      type: 'gotcha',
      content: "It wasn't RLS — search_inventory is SECURITY DEFINER and bypasses policies",
    })
    const c = entry({
      id: 'mem_3',
      type: 'gotcha',
      content:
        "It wasn't RLS: search_inventory uses SECURITY DEFINER; the real gate is can_access_company. Fix: always check company access.",
    })
    expect(shouldClusterPair(a, b).cluster).toBe(true)
    expect(shouldClusterPair(a, c).cluster).toBe(true)

    const clusters = clusterMemoryEntries([a, b, c])
    expect(clusters).toHaveLength(1)
    expect(clusters[0]!.seenInN).toBe(3)
    // fullest primary
    expect(clusters[0]!.primary.id).toBe('mem_3')
    expect(fullnessScore(c)).toBeGreaterThan(fullnessScore(a))
  })

  it('does NOT merge related-but-distinct facts without shared entities', () => {
    const a = entry({
      id: 'mem_a',
      type: 'gotcha',
      content: 'Auth timeout was 5s — clients saw false 401 on slow networks',
    })
    const b = entry({
      id: 'mem_b',
      type: 'gotcha',
      content: 'Inventory scroll reset after save — never call router.refresh in stock views',
    })
    expect(shouldClusterPair(a, b).cluster).toBe(false)
    expect(clusterMemoryEntries([a, b])).toHaveLength(2)
  })

  it('does not cluster across types', () => {
    const a = entry({ id: 'mem_d', type: 'decision', content: 'Use RLS on all public tables' })
    const b = entry({ id: 'mem_g', type: 'gotcha', content: 'Use RLS on all public tables' })
    expect(shouldClusterPair(a, b).cluster).toBe(false)
  })
})

describe('collapseEntriesForSurface + formatMemoryMd', () => {
  it('annotates seen_in_N and reports collapsed count on compact brief', () => {
    const entries = [
      entry({
        id: 'mem_1',
        type: 'gotcha',
        content: 'No era RLS en search_inventory (SECURITY DEFINER)',
      }),
      entry({
        id: 'mem_2',
        type: 'gotcha',
        content: "Wasn't RLS on search_inventory — SECURITY DEFINER bypass",
      }),
      entry({
        id: 'mem_3',
        type: 'gotcha',
        content:
          "It wasn't RLS on search_inventory: SECURITY DEFINER bypasses policies; gate with can_access_company",
      }),
    ]
    const { entries: out, collapsedCount } = collapseEntriesForSurface(entries)
    expect(out).toHaveLength(1)
    expect(collapsedCount).toBe(2)
    expect(out[0]!.tags.seen_in_N).toBe('3')
    expect(out[0]!.id).toBe('mem_3')

    const md = formatMemoryMd(entries, { compact: true })
    expect(md).toMatch(/seen_in_3/)
    expect(md).toMatch(/repeated collapsed/i)
    // only one gotcha row body (primary)
    expect(md.match(/\[mem_\d+ · gotcha\]/g)?.length ?? 0).toBe(1)
  })

  it('full format without cluster keeps all rows (audit path)', () => {
    const entries = [
      entry({ id: 'mem_1', type: 'fact', content: 'Alpha fact about widgets' }),
      entry({ id: 'mem_2', type: 'fact', content: 'Beta fact about gadgets' }),
    ]
    const md = formatMemoryMd(entries, { cluster: false })
    expect(md).toContain('mem_1')
    expect(md).toContain('mem_2')
    expect(md).not.toMatch(/repeated collapsed/i)
  })
})
