/**
 * Retention score — value-based cleanup verdicts for memory entries.
 *
 * Replaces "oldest-first" and "shape-only" cleanup criteria with a single
 * per-entry evaluation against what the project actually knows and uses:
 *
 *   1. Real usage    — decayed `memory_usefulness` score (ship credits,
 *                      references, corrections). The strongest signal.
 *   2. Groundedness  — do the file paths the entry cites still exist in the
 *                      code index (HEAD)? Was it superseded or corrected by a
 *                      later entry?
 *   3. Excess signal — exact-fingerprint duplicates and non-model telemetry
 *                      add nothing beyond what is already stored.
 *   4. Type floor    — judgment knowledge (decisions, gotchas, learnings,
 *                      feedback, shipped) is never hard-deleted: worst case
 *                      it is archived with its record intact. Raw context
 *                      and generated signals may be deleted.
 *
 * Deterministic and read-only: 0 tokens, no new tables — every input already
 * lives in SQLite. Callers decide what to DO with a verdict; this module only
 * scores. The sync dry-run phase reports verdicts without mutating anything.
 */

import { loadIndex as loadBm25Index } from '../../domain/bm25'
import { memoryFingerprint } from '../../memory/content-fingerprint'
import { collectSupersededIds, isModelMemory, type MemoryEntry } from '../../memory/entries'
import { projectMemory } from '../../memory/project-memory'
import { isIrrelevantGeneratedContext } from '../context-quality-service'
import { extractCorrectionIds, usefulnessService } from '../usefulness'

export type RetentionVerdict = 'active' | 'archive' | 'delete'

export interface RetentionResult {
  id: string
  type: string
  verdict: RetentionVerdict
  /** 0–100; higher = more worth keeping. Used to rank within a verdict. */
  score: number
  reasons: string[]
}

export interface RetentionReport {
  evaluated: number
  active: number
  archive: number
  delete: number
  /** Non-active results only — the actionable set, worst score first. */
  flagged: RetentionResult[]
}

/** Entry types whose worst-case verdict is `archive` (tombstone), never `delete`. */
const PROTECTED_TYPES = new Set([
  'decision',
  'gotcha',
  'learning',
  'feedback',
  'fact',
  'shipped',
  'spec',
])

/** Entries newer than this stay `active` unless duplicated or superseded —
 *  fresh knowledge must get a chance to be used before it can be judged. */
const GRACE_DAYS = 30

/** Verdict thresholds over the 0–100 score. */
const ACTIVE_MIN = 50
const ARCHIVE_MIN = 20

const BASE_SCORE = 50
const USEFULNESS_MAX_BONUS = 30
const RECENCY_MAX_BONUS = 20
const RECENCY_WINDOW_DAYS = 180
const SUPERSEDED_PENALTY = 40
const CORRECTED_PENALTY = 40
const DUPLICATE_PENALTY = 35
const NOISE_PENALTY = 35
const UNGROUNDED_PENALTY = 25

const MS_PER_DAY = 86_400_000

/** Path-like references in entry content (e.g. `core/services/foo.ts`).
 *  Requires a directory segment + a source-ish extension so prose with
 *  dots ("v3.44.0", "Node.js") never counts as a citation. */
const PATH_RE = /\b[\w.-]+(?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|sh|toml|yml|yaml)\b/g

export interface RetentionInputs {
  entries: MemoryEntry[]
  usefulness: Map<string, number>
  supersededIds: Set<string>
  correctedIds: Set<string>
  /** Indexed file paths at HEAD; null when no code index exists yet. */
  indexedPaths: Set<string> | null
  nowMs: number
}

/** Gather every input the scorer needs from storage. Read-only. */
export function collectRetentionInputs(projectId: string, nowMs: number): RetentionInputs {
  const entries = projectMemory.allEntriesForIndex(projectId)

  const correctedIds = new Set<string>()
  for (const entry of entries) {
    for (const id of extractCorrectionIds(entry.tags)) correctedIds.add(id)
  }

  let indexedPaths: Set<string> | null = null
  try {
    const index = loadBm25Index(projectId)
    if (index) indexedPaths = new Set(Object.keys(index.documents))
  } catch {
    // No code index (first run) — groundedness is skipped, not failed.
  }

  return {
    entries,
    usefulness: usefulnessService.decayedScores(projectId, nowMs),
    supersededIds: collectSupersededIds(entries),
    correctedIds,
    indexedPaths,
    nowMs,
  }
}

/**
 * Older entries whose content fingerprint matches a newer entry exactly.
 * The newest copy of each fingerprint survives; the rest are duplicates.
 * Capture-time dedup already collapses verbatim repeats going forward —
 * this is the backstop for entries stored before that existed.
 */
export function collectDuplicateIds(entries: MemoryEntry[]): Set<string> {
  const newestByPrint = new Map<string, MemoryEntry>()
  const duplicates = new Set<string>()
  const byNewest = [...entries].sort((a, b) => b.rememberedAt.localeCompare(a.rememberedAt))
  for (const entry of byNewest) {
    const print = memoryFingerprint(entry.content)
    if (newestByPrint.has(print)) duplicates.add(entry.id)
    else newestByPrint.set(print, entry)
  }
  return duplicates
}

/** True when the entry cites concrete files and NONE of them exist at HEAD. */
function isUngrounded(entry: MemoryEntry, indexedPaths: Set<string>): boolean {
  const cited = entry.content.match(PATH_RE)
  if (!cited || cited.length === 0) return false
  return !cited.some((p) => indexedPaths.has(p))
}

export function scoreEntry(
  entry: MemoryEntry,
  inputs: RetentionInputs,
  duplicateIds: Set<string>
): RetentionResult {
  const reasons: string[] = []
  let score = BASE_SCORE

  const usefulness = inputs.usefulness.get(entry.id) ?? 0
  if (usefulness > 0) {
    const bonus = Math.min(USEFULNESS_MAX_BONUS, usefulness * 10)
    score += bonus
    reasons.push(`used (+${Math.round(bonus)})`)
  }

  const ageDays = Math.max(0, (inputs.nowMs - Date.parse(entry.rememberedAt)) / MS_PER_DAY)
  if (Number.isFinite(ageDays)) {
    const recency = Math.max(0, RECENCY_MAX_BONUS * (1 - ageDays / RECENCY_WINDOW_DAYS))
    score += recency
  }

  const superseded = inputs.supersededIds.has(entry.id)
  if (superseded) {
    score -= SUPERSEDED_PENALTY
    reasons.push('superseded')
  }
  if (inputs.correctedIds.has(entry.id)) {
    score -= CORRECTED_PENALTY
    reasons.push('corrected')
  }

  const duplicate = duplicateIds.has(entry.id)
  if (duplicate) {
    score -= DUPLICATE_PENALTY
    reasons.push('duplicate of newer entry')
  }

  const noise = !isModelMemory(entry) || isIrrelevantGeneratedContext(entry)
  if (noise) {
    score -= NOISE_PENALTY
    reasons.push('generated noise')
  }

  if (inputs.indexedPaths && isUngrounded(entry, inputs.indexedPaths)) {
    score -= UNGROUNDED_PENALTY
    reasons.push('cites files missing at HEAD')
  }

  score = Math.max(0, Math.min(100, score))

  let verdict: RetentionVerdict =
    score >= ACTIVE_MIN ? 'active' : score >= ARCHIVE_MIN ? 'archive' : 'delete'

  // Grace: fresh knowledge stays active until it has had a chance to be
  // used — unless it is already known-dead (duplicate/superseded).
  if (verdict !== 'active' && ageDays < GRACE_DAYS && !duplicate && !superseded) {
    verdict = 'active'
    reasons.push('grace period')
  }

  // Type floor: judgment knowledge is never hard-deleted.
  if (verdict === 'delete' && PROTECTED_TYPES.has(entry.type)) {
    verdict = 'archive'
    reasons.push('protected type')
  }

  return { id: entry.id, type: entry.type, verdict, score: Math.round(score), reasons }
}

/** Score every memory entry. Read-only; callers act on the verdicts. */
export function evaluateRetention(projectId: string, nowMs: number): RetentionReport {
  const inputs = collectRetentionInputs(projectId, nowMs)
  const duplicateIds = collectDuplicateIds(inputs.entries)

  const report: RetentionReport = {
    evaluated: inputs.entries.length,
    active: 0,
    archive: 0,
    delete: 0,
    flagged: [],
  }

  for (const entry of inputs.entries) {
    const result = scoreEntry(entry, inputs, duplicateIds)
    report[result.verdict]++
    if (result.verdict !== 'active') report.flagged.push(result)
  }

  report.flagged.sort((a, b) => a.score - b.score)
  return report
}
