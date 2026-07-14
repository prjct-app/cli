/**
 * Reference model R — the Rho "high-quality distribution" for project memory.
 *
 * Rho trains a reference LM on clean data, then scores corpus tokens by excess
 * loss vs that reference. In prjct the analogous R is the durable project
 * model already in SQLite: judgment knowledge + living-v2 synthesis. No LLM
 * call, no new tables — pure selection over existing entries.
 *
 * Efficiency: R is capped and built once per evaluate/capture-gate call.
 * Vectors for excess scoring are computed lazily by the excess module.
 */

import type { MemoryEntry } from '../../memory/entries'
import { isModelMemory } from '../../memory/entries'

/** Types that form the project's reference model (judgment + synthesis). */
export const REFERENCE_TYPES = new Set([
  'decision',
  'gotcha',
  'learning',
  'fact',
  'feedback',
  'pattern',
  'anti-pattern',
  'identity',
  'voice',
  'glossary',
  'framework',
  'spec',
  // living-v2 context is synthesis of the project model; included when tagged
  'context',
])

/** Hard cap on |R| — keeps excess scoring O(n·|R|) sub-millisecond for typical vaults. */
export const REFERENCE_CAP = 150

const PROVENANCE_RANK: Record<string, number> = {
  declared: 3,
  extracted: 2,
  ambiguous: 1,
  inferred: 0,
}

function isLivingV2(entry: MemoryEntry): boolean {
  if (entry.tags?.context_schema === 'living-v2') return true
  if (entry.tags?.synthesis === 'model-authored' || entry.tags?.synthesis === 'deterministic') {
    return true
  }
  // Heuristic: land-auto session close is model-relevant synthesis
  if (entry.tags?.source === 'land-auto' || entry.tags?.capture === 'land-v2') return true
  return false
}

/**
 * Is this entry eligible to sit in the reference set R?
 * Noise, inbox, raw signals, and empty content never define the model.
 */
export function isReferenceEligible(entry: MemoryEntry): boolean {
  if (!isModelMemory(entry)) return false
  if (entry.content.trim().length < 40) return false
  if (!REFERENCE_TYPES.has(entry.type)) return false
  if (entry.type === 'context' && !isLivingV2(entry)) return false
  if (entry.type === 'inbox' || entry.type === 'todo' || entry.type === 'idea') return false
  return true
}

/**
 * Rank for selection into R (higher = more authoritative).
 * Prefer declared judgment, then recency.
 */
function referenceRank(entry: MemoryEntry): number {
  const prov = PROVENANCE_RANK[entry.provenance] ?? 1
  const typeBoost =
    entry.type === 'decision' || entry.type === 'gotcha'
      ? 100
      : entry.type === 'learning' || entry.type === 'fact'
        ? 50
        : entry.type === 'context'
          ? 30
          : 20
  const t = Date.parse(entry.rememberedAt)
  const recency = Number.isFinite(t) ? t / 1e13 : 0 // small tie-break
  return typeBoost * 10 + prov * 3 + recency
}

/**
 * Build the reference set R from the live entry list.
 * Deterministic: same entries → same R (sorted by rank, capped).
 */
export function buildReferenceModel(entries: MemoryEntry[]): MemoryEntry[] {
  const eligible = entries.filter(isReferenceEligible)
  eligible.sort((a, b) => referenceRank(b) - referenceRank(a))
  return eligible.slice(0, REFERENCE_CAP)
}
