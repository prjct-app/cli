/**
 * Capture gate — Rho step at write time: only persist high-excess knowledge.
 *
 * Exact fingerprint dedup already lives in projectMemory.remember.
 * This gate adds *semantic* redundancy: if content is near-duplicate of the
 * reference model R, low-stakes types (inbox/context/idea/signals) are
 * rejected instead of diluting the vault.
 *
 * High-stakes judgment (decision/gotcha/learning/fact/…) always passes when
 * content is not an exact hash dup — the human/agent asserted it.
 *
 * Efficiency: R is built once; gate is sync and best-effort (never throws).
 */

import type { MemoryEntry, MemoryType } from '../../memory/entries'
import { projectMemory } from '../../memory/project-memory'
import { buildReferenceIndex, CAPTURE_MIN_EXCESS, excessAgainstIndex } from './excess'
import { buildReferenceModel } from './reference-model'

/** Types that must never be blocked by semantic excess (user/agent judgment). */
const ALWAYS_ACCEPT = new Set([
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
  'shipped',
])

export interface CaptureGateResult {
  accept: boolean
  reason: string
  excess?: number
  nearestId?: string | null
}

/**
 * Gate a prospective capture against the current project model.
 * Pure read of SQLite via projectMemory; no writes.
 */
export function captureGate(
  projectId: string,
  type: MemoryType,
  content: string
): CaptureGateResult {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return { accept: false, reason: 'empty content' }
  }

  // Judgment always accepted (exact-hash dedup already handled upstream).
  if (ALWAYS_ACCEPT.has(type)) {
    return { accept: true, reason: 'judgment type — always accept novel content' }
  }

  let entries: MemoryEntry[]
  try {
    entries = projectMemory.allEntriesForIndex(projectId)
  } catch {
    return { accept: true, reason: 'gate skipped (read failure)' }
  }

  if (entries.length === 0) {
    return { accept: true, reason: 'empty vault — seed accepted' }
  }

  const R = buildReferenceModel(entries)
  if (R.length === 0) {
    return { accept: true, reason: 'empty reference — accept' }
  }

  const index = buildReferenceIndex(R)
  const ex = excessAgainstIndex(trimmed, index)

  if (ex.exactDup || ex.nearDup || ex.excess < CAPTURE_MIN_EXCESS) {
    return {
      accept: false,
      reason: ex.exactDup
        ? `redundant exact match of ${ex.nearestId}`
        : `low excess ${ex.excess.toFixed(2)} vs reference (nearest ${ex.nearestId}, sim ${ex.maxSim.toFixed(2)})`,
      excess: ex.excess,
      nearestId: ex.nearestId,
    }
  }

  return {
    accept: true,
    reason: `excess ${ex.excess.toFixed(2)} above capture floor`,
    excess: ex.excess,
    nearestId: ex.nearestId,
  }
}
