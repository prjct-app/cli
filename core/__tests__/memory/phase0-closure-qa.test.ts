/**
 * Fase 0 closure QA — client acceptance cases (behavior on real/adversarial inputs).
 * Case 2 is critical (anti-over-collapse); Case 1 red-herring precision; Case 3 signal_ratio lock.
 */

import { describe, expect, it } from 'bun:test'
import type { MemoryEntry } from '../../memory/entries'
import { formatMemoryMd } from '../../memory/format'
import { classifyCapturePrecision, looksLikeRedHerring } from '../../memory/precision-classifier'
import { collapseEntriesForSurface, shouldClusterPair } from '../../memory/semantic-cluster'
import { computeSubstrateHealth, SIGNAL_RATIO_METRIC_VERSION } from '../../memory/substrate-health'

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

// ─── Case 1 — red-herring precision ─────────────────────────────────────────

const CASE_1A = [
  {
    id: 'IN-1A-1',
    content:
      "No era RLS. can_access_company y todas las policies estaban perfectas — el síntoma 'solo super-admin ve' fue una coincidencia engañosa. Causa real: el RPC search_inventory se declaró STABLE pero corre EXPLAIN adentro.",
  },
  {
    id: 'IN-1A-2',
    content:
      'search_inventory RPC is declared STABLE but runs EXPLAIN internally... This is NOT an RLS bug; can_access_company and all RLS were correct. Fix: declare the function VOLATILE.',
  },
  {
    id: 'IN-1A-3',
    content:
      'RLS per-row cost is NOT the bottleneck — migration ...perf_rls_wrap_auth_uid already wraps auth.uid().',
  },
] as const

const CASE_1B = [
  {
    id: 'IN-1B-1',
    content: 'No era necesario el índice pero lo agregué igual para futuras queries.',
  },
  {
    id: 'IN-1B-2',
    content:
      'Esto no es RLS-related, es puro frontend — el badge no renderiza por un estado local.',
  },
  {
    id: 'IN-1B-3',
    content: "The fix wasn't hard — one-line VOLATILE change.",
  },
] as const

describe('Fase 0 Case 1 — red-herring precision', () => {
  it('1A: true positives retype to red-herring (3/3)', () => {
    for (const c of CASE_1A) {
      expect(looksLikeRedHerring(c.content)).toBe(true)
      const v = classifyCapturePrecision(c.content, 'gotcha')
      expect(v.action).toBe('demote')
      expect(v.demoteTo).toBe('red-herring')
      expect(v.reasonCode).toBe('gotcha_is_red_herring')
    }
  })

  it('1B: false positives do NOT retype to red-herring (0/3)', () => {
    for (const c of CASE_1B) {
      expect(looksLikeRedHerring(c.content)).toBe(false)
      const v = classifyCapturePrecision(c.content, 'gotcha')
      expect(v.demoteTo === 'red-herring').toBe(false)
      expect(v.reasonCode === 'gotcha_is_red_herring').toBe(false)
    }
  })
})

// ─── Case 2 — anti-over-collapse (CRITICAL) ─────────────────────────────────

const CASE_2_A =
  'CompanySwitcher (v0.59.0) stopped letting super-admins switch company. Root cause: the new component uses HeroUI Listbox with onAction inside a Popover that ALSO has an autoFocus Input + ScrollShadow wrapping the Listbox; onAction does NOT fire reliably on click. Fix: use onSelectionChange instead of onAction.'

const CASE_2_B =
  "Company switcher (super-admin) didn't change company: setActiveCompany server action sets the active_company_id cookie + revalidatePath, but the handlers only awaited it. Invoking a server action imperatively from an onClick (outside a transition) does NOT auto re-fetch the layout RSC. Fix: call router.refresh() right after setActiveCompany."

const CASE_2_CTRL_A =
  'No era RLS — search_inventory es SECURITY DEFINER, gate con can_access_company.'
const CASE_2_CTRL_B =
  "It wasn't RLS — search_inventory is SECURITY DEFINER; gate with can_access_company."

describe('Fase 0 Case 2 — anti-over-collapse (CRITICAL)', () => {
  it('near-dup CompanySwitcher bugs with different fixes do NOT collapse', () => {
    const a = entry({ id: 'mem_2a', type: 'gotcha', content: CASE_2_A })
    const b = entry({ id: 'mem_2b', type: 'gotcha', content: CASE_2_B })
    expect(shouldClusterPair(a, b).cluster).toBe(false)

    const { entries, collapsedCount } = collapseEntriesForSurface([a, b])
    expect(entries).toHaveLength(2)
    expect(collapsedCount).toBe(0)
    expect(entries.every((e) => Number(e.tags.seen_in_N ?? '1') <= 1)).toBe(true)

    const md = formatMemoryMd([a, b], { compact: true })
    expect(md.match(/\[mem_2[ab] · gotcha\]/g)?.length ?? 0).toBe(2)
    expect(md).not.toMatch(/seen_in_2/)
  })

  it('control: same fact ES/EN DOES collapse with sources=', () => {
    const a = entry({ id: 'mem_ctrl_a', type: 'gotcha', content: CASE_2_CTRL_A })
    const b = entry({ id: 'mem_ctrl_b', type: 'gotcha', content: CASE_2_CTRL_B })
    expect(shouldClusterPair(a, b).cluster).toBe(true)

    const { entries, collapsedCount } = collapseEntriesForSurface([a, b])
    expect(entries).toHaveLength(1)
    expect(collapsedCount).toBe(1)
    expect(entries[0]!.tags.seen_in_N).toBe('2')
    const sources = (entries[0]!.tags.cluster_sources ?? '').split(',')
    expect(sources).toContain('mem_ctrl_a')
    expect(sources).toContain('mem_ctrl_b')

    const md = formatMemoryMd([a, b], { compact: true })
    expect(md).toMatch(/seen_in_2/)
    expect(md).toMatch(/sources=/)
  })
})

// ─── Case 3 — signal_ratio v1 lock ──────────────────────────────────────────

/** Frozen corpus for signal_ratio regression (read-only fixture). */
const SIGNAL_RATIO_FROZEN_CORPUS: MemoryEntry[] = [
  entry({
    id: 'mem_sr_1',
    type: 'decision',
    content: 'Use SQLite as the single source of truth for project memory',
  }),
  entry({
    id: 'mem_sr_2',
    type: 'gotcha',
    content: 'Never call router.refresh() after inventory save — it resets scroll',
  }),
  entry({
    id: 'mem_sr_3',
    type: 'gotcha',
    content: 'Reviso cómo refrescan hoy para no meter un bug:',
  }),
  entry({
    id: 'mem_sr_4',
    type: 'spec',
    content: 'Crew mode migration\n\nGoal: Crew mode migration',
  }),
  entry({
    id: 'mem_sr_5',
    type: 'red-herring',
    content:
      "It wasn't RLS — search_inventory is SECURITY DEFINER; gate with can_access_company. Fix: check company access.",
  }),
  entry({
    id: 'mem_sr_6',
    type: 'fact',
    content: 'Runtime for unit tests is bun',
  }),
  entry({
    id: 'mem_sr_7',
    type: 'inbox',
    content: 'Investigate stock audit reopen on mobile after complete',
  }),
]

describe('Fase 0 Case 3 — signal_ratio v1 lock', () => {
  it('documents metric version v1', () => {
    expect(SIGNAL_RATIO_METRIC_VERSION).toBe('v1')
    const h = computeSubstrateHealth(SIGNAL_RATIO_FROZEN_CORPUS)
    expect(h.signalRatioVersion).toBe('v1')
  })

  it('frozen corpus yields stable signal_ratio across two runs (exact)', () => {
    const a = computeSubstrateHealth(SIGNAL_RATIO_FROZEN_CORPUS)
    const b = computeSubstrateHealth(SIGNAL_RATIO_FROZEN_CORPUS)
    expect(a.signalRatio).toBe(b.signalRatio)
    expect(a.judgment).toBe(b.judgment)
    // Lock expected v1 value for this corpus:
    // judgment types: decision, gotcha×2, spec, red-herring, fact = 6 (inbox excluded)
    // fails: open-narration gotcha + empty-spec mirror = 2
    // signal_ratio = 1 - 2/6 = 2/3
    expect(a.judgment).toBe(6)
    expect(a.signalRatio).toBeCloseTo(1 - 2 / 6, 10)
  })
})
