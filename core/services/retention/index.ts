/**
 * Retention score — value-based cleanup verdicts for memory entries.
 *
 * Replaces "oldest-first" knowledge thinning with a single per-entry
 * evaluation against what the project actually knows and uses:
 *
 *   1. Real usage    — decayed `memory_usefulness` score (ship credits,
 *                      references, corrections). The strongest signal.
 *   2. Groundedness  — cited file paths still exist in the code index (HEAD)?
 *                      Superseded or corrected by a later entry?
 *   3. Excess signal — fingerprint duplicates + generated noise
 *                      (improvement-signal, hot-file, low-value legacy context).
 *                      Proxy for "adds nothing beyond synthesis/code" until a
 *                      deeper synthesis-diff lands.
 *   4. Type floor    — judgment knowledge is never hard-deleted: worst case
 *                      archive (soft-delete from recall, recoverable).
 *   5. Idle age      — unused knowledge past 90d gradually loses score so
 *                      dead entries can leave `active` without dramatic strikes.
 *
 * Deterministic, 0 tokens, no new tables. `evaluateRetention` is read-only;
 * `applyRetention` archives/deletes according to verdicts (soft-delete via
 * `projectMemory.forget` + optional archives table row for recoverability).
 */

import { loadIndex as loadBm25Index } from '../../domain/bm25'
import { memoryFingerprint } from '../../memory/content-fingerprint'
import { collectSupersededIds, isModelMemory, type MemoryEntry } from '../../memory/entries'
import { projectMemory } from '../../memory/project-memory'
import { archiveStorage } from '../../storage/archive-storage'
import prjctDb from '../../storage/database'
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
  /** All results by id (for callers that need per-entry lookup). */
  byId: Map<string, RetentionResult>
}

export interface ApplyRetentionOptions {
  /** When true, score only — no mutations. Default false. */
  dryRun?: boolean
  /** Cap how many archive actions run this pass (default 100). */
  maxArchive?: number
  /** Cap how many delete actions run this pass (default 50). */
  maxDelete?: number
  nowMs?: number
}

export interface ApplyRetentionResult {
  evaluated: number
  active: number
  wouldArchive: number
  wouldDelete: number
  archived: number
  deleted: number
  skipped: number
  dryRun: boolean
  samples: RetentionResult[]
}

/** Entry types whose worst-case verdict is `archive` (tombstone), never `delete`. */
export const PROTECTED_TYPES = new Set([
  'decision',
  'gotcha',
  'learning',
  'feedback',
  'fact',
  'shipped',
  'spec',
])

/** Entries newer than this stay `active` unless duplicated or superseded. */
const GRACE_DAYS = 30

/** Verdict thresholds over the 0–100 score. */
const ACTIVE_MIN = 50
const ARCHIVE_MIN = 20

/**
 * Base below ACTIVE_MIN so unused knowledge is not permanently active.
 * Usefulness / recency push above the line; idle age + strikes pull below.
 */
const BASE_SCORE = 40
const USEFULNESS_MAX_BONUS = 30
const RECENCY_MAX_BONUS = 20
const RECENCY_WINDOW_DAYS = 180
/** After this many days with zero usefulness, apply idle penalty. */
const IDLE_AFTER_DAYS = 90
const IDLE_MAX_PENALTY = 30
const IDLE_PENALTY_PER_DAY = 0.15
const SUPERSEDED_PENALTY = 40
const CORRECTED_PENALTY = 40
const DUPLICATE_PENALTY = 35
const NOISE_PENALTY = 35
const UNGROUNDED_PENALTY = 25

const MS_PER_DAY = 86_400_000

const DEFAULT_MAX_ARCHIVE = 100
const DEFAULT_MAX_DELETE = 50
/** Smaller budget for per-done incremental passes. */
const INCREMENTAL_MAX_ARCHIVE = 25
const INCREMENTAL_MAX_DELETE = 15

/** Path-like references in entry content (e.g. `core/services/foo.ts`). */
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
 * Newest copy survives; the rest are duplicates (backstop for pre-dedup data).
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

  // Idle: unused knowledge past IDLE_AFTER_DAYS gradually falls out of active.
  if (usefulness <= 0 && Number.isFinite(ageDays) && ageDays > IDLE_AFTER_DAYS) {
    const idle = Math.min(IDLE_MAX_PENALTY, (ageDays - IDLE_AFTER_DAYS) * IDLE_PENALTY_PER_DAY)
    if (idle > 0) {
      score -= idle
      reasons.push(`idle ${Math.round(ageDays)}d`)
    }
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

  // Excess-signal proxy: non-model types + low-value generated/legacy context.
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

  // Grace: fresh knowledge stays active unless already known-dead.
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
    byId: new Map(),
  }

  for (const entry of inputs.entries) {
    const result = scoreEntry(entry, inputs, duplicateIds)
    report[result.verdict]++
    report.byId.set(result.id, result)
    if (result.verdict !== 'active') report.flagged.push(result)
  }

  report.flagged.sort((a, b) => a.score - b.score)
  return report
}

/**
 * Whether an entry should receive an embedding (selective vectorization).
 * Never embed signals/telemetry; never embed entries that score archive/delete.
 */
export function shouldEmbedEntry(entry: MemoryEntry, retention?: RetentionResult | null): boolean {
  if (!isModelMemory(entry)) return false
  if (entry.content.trim().length === 0) return false
  if (retention && retention.verdict !== 'active') return false
  return true
}

function forgetEntry(projectId: string, id: string): boolean {
  // projectMemory.forget only handles mem_N numeric ids.
  if (projectMemory.forget(projectId, id)) return true
  // ship_* and other ids: soft-delete memory_entries row if present.
  try {
    const r = prjctDb.run(
      projectId,
      'UPDATE memory_entries SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL',
      Date.now(),
      id
    )
    return (r.changes ?? 0) > 0
  } catch {
    return false
  }
}

/**
 * Act on retention verdicts:
 *   - archive → row in archives table + soft-delete from active recall
 *   - delete  → soft-delete from active recall (no archives row; refuted/noise)
 * Caps prevent a single sync from emptying a large vault.
 */
export function applyRetention(
  projectId: string,
  options: ApplyRetentionOptions = {}
): ApplyRetentionResult {
  const dryRun = options.dryRun === true
  const nowMs = options.nowMs ?? Date.now()
  const maxArchive = options.maxArchive ?? DEFAULT_MAX_ARCHIVE
  const maxDelete = options.maxDelete ?? DEFAULT_MAX_DELETE

  const report = evaluateRetention(projectId, nowMs)
  const toArchive = report.flagged.filter((r) => r.verdict === 'archive')
  const toDelete = report.flagged.filter((r) => r.verdict === 'delete')

  let archived = 0
  let deleted = 0
  let skipped = 0

  if (!dryRun) {
    const archiveBatch = toArchive.slice(0, maxArchive)
    skipped += Math.max(0, toArchive.length - archiveBatch.length)
    for (const r of archiveBatch) {
      try {
        archiveStorage.archive(projectId, {
          entityType: 'memory_entry',
          entityId: r.id,
          entityData: {
            id: r.id,
            type: r.type,
            score: r.score,
            reasons: r.reasons,
            verdict: r.verdict,
          },
          summary: `retention archive [${r.type}] score=${r.score}`,
          reason: 'retention-archive',
        })
      } catch {
        /* archive row best-effort */
      }
      if (forgetEntry(projectId, r.id)) archived++
      else skipped++
    }

    const deleteBatch = toDelete.slice(0, maxDelete)
    skipped += Math.max(0, toDelete.length - deleteBatch.length)
    for (const r of deleteBatch) {
      if (PROTECTED_TYPES.has(r.type)) {
        // Double-check floor — never hard-delete protected types.
        skipped++
        continue
      }
      if (forgetEntry(projectId, r.id)) deleted++
      else skipped++
    }
  }

  return {
    evaluated: report.evaluated,
    active: report.active,
    wouldArchive: toArchive.length,
    wouldDelete: toDelete.length,
    archived: dryRun ? 0 : archived,
    deleted: dryRun ? 0 : deleted,
    skipped,
    dryRun,
    samples: report.flagged.slice(0, 10),
  }
}

/** Smaller best-effort pass for `prjct status done` / task close. */
export function applyRetentionIncremental(projectId: string): ApplyRetentionResult {
  return applyRetention(projectId, {
    maxArchive: INCREMENTAL_MAX_ARCHIVE,
    maxDelete: INCREMENTAL_MAX_DELETE,
  })
}

/**
 * Inbox triage: soft-delete inbox items that are fingerprint-duplicates of
 * newer non-inbox knowledge, or that score archive/delete under retention.
 */
export function triageInbox(
  projectId: string,
  nowMs: number = Date.now()
): {
  merged: number
  archived: number
} {
  const entries = projectMemory.allEntriesForIndex(projectId)
  const inbox = entries.filter((e) => e.type === 'inbox')
  if (inbox.length === 0) return { merged: 0, archived: 0 }

  const nonInbox = entries.filter((e) => e.type !== 'inbox')
  const nonInboxPrints = new Set(nonInbox.map((e) => memoryFingerprint(e.content)))
  const dups = collectDuplicateIds(entries)
  const report = evaluateRetention(projectId, nowMs)

  let merged = 0
  let archived = 0

  for (const item of inbox) {
    const print = memoryFingerprint(item.content)
    const isDupOfKnowledge = nonInboxPrints.has(print)
    const isOlderDup = dups.has(item.id)
    const verdict = report.byId.get(item.id)

    if (isDupOfKnowledge || isOlderDup) {
      if (forgetEntry(projectId, item.id)) merged++
      continue
    }
    if (verdict && verdict.verdict !== 'active') {
      try {
        archiveStorage.archive(projectId, {
          entityType: 'memory_entry',
          entityId: item.id,
          entityData: {
            id: item.id,
            type: 'inbox',
            score: verdict.score,
            reasons: verdict.reasons,
          },
          summary: `inbox triage score=${verdict.score}`,
          reason: 'retention-inbox',
        })
      } catch {
        /* best-effort */
      }
      if (forgetEntry(projectId, item.id)) archived++
    }
  }

  return { merged, archived }
}
