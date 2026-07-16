/**
 * Substrate health + capture density — honesty metrics for living memory.
 *
 * Pure over MemoryEntry[]. Used by insights quality / memory doctor and as a
 * compact-brief coverage footer so consumers never confuse "listed risks"
 * with "complete knowledge of the zone".
 *
 * Metrics (contract for future intake):
 *   signal_ratio · unshaped_gotcha_rate · empty_spec_rate · junk_like_rate
 *   recency bands · blind_spots[] · score 0–100
 */

import type { MemoryEntry } from './entries'
import { classifyCapturePrecision } from './precision-classifier'
import { clusterMemoryEntries, extractKeyEntities } from './semantic-cluster'

/** Types that carry judgment authority on briefs. */
export const JUDGMENT_TYPES = new Set([
  'decision',
  'gotcha',
  'learning',
  'fact',
  'feedback',
  'pattern',
  'anti-pattern',
  'red-herring',
  'spec',
  'shipped',
])

const DAY_MS = 24 * 60 * 60 * 1000

export interface DensityBand {
  d7: number
  d30: number
  older: number
}

export interface BlindSpot {
  kind: 'type' | 'entity' | 'recency' | 'empty'
  label: string
  reason: string
}

export interface SubstrateHealth {
  live: number
  judgment: number
  /** 0–1: share of judgment rows that pass precision as-typed. */
  signalRatio: number
  unshapedGotchaRate: number
  emptySpecRate: number
  junkLikeRate: number
  /** Entries that would collapse under semantic cluster (within-type). */
  clusterCollapsedEstimate: number
  byType: Record<string, number>
  recency: DensityBand
  blindSpots: BlindSpot[]
  /** 0–100 composite for doctor / gates. */
  score: number
  issues: string[]
}

function ageMs(e: MemoryEntry, now: number): number {
  const t = Date.parse(e.rememberedAt)
  return Number.isFinite(t) ? Math.max(0, now - t) : Number.POSITIVE_INFINITY
}

/**
 * Compute substrate health for a vault slice (full index or recall set).
 */
export function computeSubstrateHealth(
  entries: MemoryEntry[],
  nowMs: number = Date.now()
): SubstrateHealth {
  const live = entries.length
  const byType: Record<string, number> = {}
  for (const e of entries) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
  }

  const judgment = entries.filter((e) => JUDGMENT_TYPES.has(e.type))
  let unshapedGotcha = 0
  let emptySpec = 0
  let junkLike = 0
  let precisionFail = 0

  const gotchas = judgment.filter((e) => e.type === 'gotcha')
  const specs = judgment.filter((e) => e.type === 'spec')

  for (const e of judgment) {
    const v = classifyCapturePrecision(e.content, e.type)
    if (v.action !== 'accept') {
      precisionFail++
      if (e.type === 'gotcha' && v.reasonCode === 'gotcha_open_narration') unshapedGotcha++
      if (e.type === 'spec' && (v.reasonCode === 'empty_spec_mirror' || v.reasonCode === 'bare_id_body')) {
        emptySpec++
      }
      if (v.reasonCode === 'junk' || v.reasonCode === 'inbox_no_substance') junkLike++
    }
  }

  const unshapedGotchaRate = gotchas.length === 0 ? 0 : unshapedGotcha / gotchas.length
  const emptySpecRate = specs.length === 0 ? 0 : emptySpec / specs.length
  const junkLikeRate = judgment.length === 0 ? 0 : junkLike / judgment.length
  const signalRatio =
    judgment.length === 0 ? 1 : Math.max(0, Math.min(1, 1 - precisionFail / judgment.length))

  // Cluster estimate within judgment types only
  let clusterCollapsedEstimate = 0
  const byJType = new Map<string, MemoryEntry[]>()
  for (const e of judgment) {
    const list = byJType.get(e.type) ?? []
    list.push(e)
    byJType.set(e.type, list)
  }
  for (const group of byJType.values()) {
    if (group.length < 2) continue
    const clusters = clusterMemoryEntries(group)
    for (const c of clusters) {
      if (c.seenInN > 1) clusterCollapsedEstimate += c.seenInN - 1
    }
  }

  const recency: DensityBand = { d7: 0, d30: 0, older: 0 }
  for (const e of entries) {
    const age = ageMs(e, nowMs)
    if (age <= 7 * DAY_MS) recency.d7++
    else if (age <= 30 * DAY_MS) recency.d30++
    else recency.older++
  }

  const blindSpots: BlindSpot[] = []
  if (live === 0) {
    blindSpots.push({
      kind: 'empty',
      label: 'vault',
      reason: 'no live memory — every zone is a blind spot',
    })
  }
  if (judgment.length > 0 && recency.d30 === 0 && recency.d7 === 0) {
    blindSpots.push({
      kind: 'recency',
      label: 'stale-vault',
      reason: 'no captures in the last 30 days — knowledge may be rotten',
    })
  }
  // Judgment types missing entirely but others present
  for (const need of ['decision', 'gotcha'] as const) {
    if (live >= 8 && (byType[need] ?? 0) === 0) {
      blindSpots.push({
        kind: 'type',
        label: need,
        reason: `no ${need} entries in a non-empty vault — risk surface is incomplete`,
      })
    }
  }

  // Entity density: entities that appear only once and only in old entries
  // are thin — surface top thin anchors when judgment exists.
  if (judgment.length >= 3) {
    const entityHits = new Map<string, { count: number; fresh: number }>()
    for (const e of judgment) {
      const fresh = ageMs(e, nowMs) <= 30 * DAY_MS ? 1 : 0
      for (const ent of extractKeyEntities(e.content)) {
        if (ent.length < 6 && !['rls', 'jwt', 'csrf'].includes(ent)) continue
        const cur = entityHits.get(ent) ?? { count: 0, fresh: 0 }
        cur.count++
        cur.fresh += fresh
        entityHits.set(ent, cur)
      }
    }
    // Prefer reporting lack of multi-capture on high-signal single-hit entities
    // only when we have enough data that sparsity is meaningful.
    let thin = 0
    for (const [ent, h] of entityHits) {
      if (h.count === 1 && h.fresh === 0) {
        thin++
        if (blindSpots.filter((b) => b.kind === 'entity').length < 3) {
          blindSpots.push({
            kind: 'entity',
            label: ent,
            reason: `single stale capture for "${ent}" — validate before trusting`,
          })
        }
      }
    }
    if (thin > 3) {
      blindSpots.push({
        kind: 'entity',
        label: `${thin} thin anchors`,
        reason: `${thin} entities appear only once in stale captures — density is low`,
      })
    }
  }

  const issues: string[] = []
  if (unshapedGotcha > 0) {
    issues.push(`${unshapedGotcha} open-narration gotcha(s) fail precision (should be context).`)
  }
  if (emptySpec > 0) {
    issues.push(`${emptySpec} empty-spec mirror(s) still live.`)
  }
  if (junkLike > 0) {
    issues.push(`${junkLike} junk-like judgment row(s) should be forgotten.`)
  }
  if (clusterCollapsedEstimate > 0) {
    issues.push(
      `${clusterCollapsedEstimate} near-duplicate(s) would collapse on brief (semantic cluster).`
    )
  }
  for (const b of blindSpots) {
    if (b.kind !== 'entity' || blindSpots.filter((x) => x.kind === 'entity').indexOf(b) < 2) {
      issues.push(`Blind spot (${b.kind}): ${b.reason}`)
    }
  }

  // Score: start 100, penalize precision failures and blind spots
  let score = 100
  score -= Math.round((1 - signalRatio) * 40)
  score -= Math.min(20, Math.round(unshapedGotchaRate * 20))
  score -= Math.min(15, Math.round(emptySpecRate * 15))
  score -= Math.min(15, blindSpots.length * 3)
  score = Math.max(0, Math.min(100, score))

  return {
    live,
    judgment: judgment.length,
    signalRatio,
    unshapedGotchaRate,
    emptySpecRate,
    junkLikeRate,
    clusterCollapsedEstimate,
    byType,
    recency,
    blindSpots,
    score,
    issues,
  }
}

/**
 * One-line coverage footer for compact memory surfaces (honest density).
 */
export function formatCoverageFooter(entries: MemoryEntry[], nowMs: number = Date.now()): string {
  if (entries.length === 0) {
    return '_Coverage: empty set — full blind spot; do not treat absence of risks as safety._'
  }
  const h = computeSubstrateHealth(entries, nowMs)
  const density =
    h.recency.d7 + h.recency.d30 >= Math.max(3, Math.ceil(entries.length * 0.4))
      ? 'dense'
      : h.recency.d7 + h.recency.d30 >= 1
        ? 'mixed'
        : 'thin/stale'
  const topTypes = Object.entries(h.byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t, n]) => `${t}:${n}`)
    .join(' ')
  const blind =
    h.blindSpots.length === 0
      ? 'no structural blind spots in this slice'
      : `${h.blindSpots.length} blind-spot signal(s) — not complete coverage`
  return `_Coverage: ${entries.length} shown · density=${density} · signal≈${Math.round(h.signalRatio * 100)}% · ${topTypes} · ${blind}_`
}

/**
 * Markdown block for memory doctor / insights quality.
 */
export function formatSubstrateHealthMd(h: SubstrateHealth): string {
  const lines = [
    '## Substrate health',
    '',
    `| Metric | Value |`,
    `|---|---:|`,
    `| Score | ${h.score}/100 |`,
    `| Live | ${h.live} |`,
    `| Judgment | ${h.judgment} |`,
    `| Signal ratio | ${Math.round(h.signalRatio * 100)}% |`,
    `| Unshaped gotcha rate | ${Math.round(h.unshapedGotchaRate * 100)}% |`,
    `| Empty-spec rate | ${Math.round(h.emptySpecRate * 100)}% |`,
    `| Cluster collapse estimate | ${h.clusterCollapsedEstimate} |`,
    `| Recency 7d / 30d / older | ${h.recency.d7} / ${h.recency.d30} / ${h.recency.older} |`,
    '',
  ]
  if (h.issues.length === 0) {
    lines.push('- No substrate precision issues detected in this slice.')
  } else {
    lines.push('### Issues')
    for (const i of h.issues) lines.push(`- ${i}`)
  }
  if (h.blindSpots.length > 0) {
    lines.push('', '### Blind spots')
    for (const b of h.blindSpots) {
      lines.push(`- **${b.label}** (${b.kind}): ${b.reason}`)
    }
  }
  lines.push(
    '',
    '_This is captured knowledge only — absence of a risk is not proof it does not exist._'
  )
  return lines.join('\n')
}
