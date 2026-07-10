/**
 * Retention — Rho-inspired selective memory for prjct.
 *
 * microsoft/rho (Selective Language Modeling):
 *   1. Build a reference model on high-quality data
 *   2. Score candidates by excess loss vs reference
 *   3. Keep / train only high-excess signal
 *
 * prjct mapping (deterministic, 0 tokens, no new tables):
 *   1. R = judgment + living-v2 synthesis (reference-model.ts)
 *   2. excess(entry) = 1 - max_sim(entry, R\{entry}) via local embeddings (excess.ts)
 *   3. Verdict active|archive|delete from excess + usage + groundedness + floor
 *
 * Capture gate (capture-gate.ts) rejects low-excess noise at write time.
 * applyRetention soft-deletes according to verdicts (capped).
 */

import { loadIndex as loadBm25Index } from '../../domain/bm25'
import { memoryFingerprint } from '../../memory/content-fingerprint'
import { collectSupersededIds, isModelMemory, type MemoryEntry } from '../../memory/entries'
import { projectMemory } from '../../memory/project-memory'
import { archiveStorage } from '../../storage/archive-storage'
import prjctDb from '../../storage/database'
import { isIrrelevantGeneratedContext } from '../context-quality-service'
import { extractCorrectionIds, usefulnessService } from '../usefulness'
import { hardDeleteEntries } from './distill'
import {
  buildReferenceIndex,
  type ExcessResult,
  excessAgainstIndex,
  type ReferenceIndex,
} from './excess'
import { buildReferenceModel } from './reference-model'

export type RetentionVerdict = 'active' | 'archive' | 'delete'

export interface RetentionResult {
  id: string
  type: string
  verdict: RetentionVerdict
  /** 0–100; higher = more worth keeping. */
  score: number
  reasons: string[]
  /** Rho excess ∈ [0,1]; high = novel vs R. */
  excess?: number
  maxSim?: number
  nearestId?: string | null
}

export interface RetentionReport {
  evaluated: number
  active: number
  archive: number
  delete: number
  /** |R| used for this evaluation. */
  referenceSize: number
  flagged: RetentionResult[]
  byId: Map<string, RetentionResult>
}

export interface ApplyRetentionOptions {
  dryRun?: boolean
  maxArchive?: number
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
  referenceSize?: number
}

export const PROTECTED_TYPES = new Set([
  'decision',
  'gotcha',
  'learning',
  'feedback',
  'fact',
  'shipped',
  'spec',
])

const GRACE_DAYS = 30
const ACTIVE_MIN = 50
const ARCHIVE_MIN = 20

/**
 * Score composition (0–100), Rho-first:
 *   excess contribution up to 45  — THE signal (novelty vs R)
 *   usefulness up to 25
 *   recency up to 15
 *   penalties: superseded/corrected/noise/ungrounded/idle/low-excess
 */
const EXCESS_MAX = 45
const USEFULNESS_MAX_BONUS = 25
const RECENCY_MAX_BONUS = 15
const RECENCY_WINDOW_DAYS = 180
const IDLE_AFTER_DAYS = 90
const IDLE_MAX_PENALTY = 25
const IDLE_PENALTY_PER_DAY = 0.12
const SUPERSEDED_PENALTY = 40
const CORRECTED_PENALTY = 40
const NOISE_PENALTY = 30
const UNGROUNDED_PENALTY = 20
/** When excess is near-zero, push hard toward archive (redundant with R). */
const LOW_EXCESS_PENALTY = 35
const LOW_EXCESS_CUTOFF = 0.12

const MS_PER_DAY = 86_400_000
const DEFAULT_MAX_ARCHIVE = 100
const DEFAULT_MAX_DELETE = 50
const INCREMENTAL_MAX_ARCHIVE = 25
const INCREMENTAL_MAX_DELETE = 15

const PATH_RE = /\b[\w.-]+(?:\/[\w.-]+)+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|sh|toml|yml|yaml)\b/g

export interface RetentionInputs {
  entries: MemoryEntry[]
  usefulness: Map<string, number>
  supersededIds: Set<string>
  correctedIds: Set<string>
  indexedPaths: Set<string> | null
  nowMs: number
  /** Prebuilt reference index (required for Rho excess). */
  refIndex: ReferenceIndex
}

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
    /* first run */
  }

  const R = buildReferenceModel(entries)
  const refIndex = buildReferenceIndex(R)

  return {
    entries,
    usefulness: usefulnessService.decayedScores(projectId, nowMs),
    supersededIds: collectSupersededIds(entries),
    correctedIds,
    indexedPaths,
    nowMs,
    refIndex,
  }
}

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

  // ── Rho core: excess vs R ──────────────────────────────────────────
  const ex: ExcessResult = excessAgainstIndex(entry.content, inputs.refIndex, entry.id)
  // Exact/near fingerprint dups among full corpus still count
  const corpusDup = duplicateIds.has(entry.id)
  if (corpusDup && !ex.exactDup) {
    reasons.push('duplicate of newer entry')
  }

  // Start from excess — high novelty is the keep signal (Rho).
  let score = ex.excess * EXCESS_MAX
  reasons.push(`excess ${ex.excess.toFixed(2)} (sim ${ex.maxSim.toFixed(2)})`)

  if (ex.exactDup || ex.nearDup || ex.excess < LOW_EXCESS_CUTOFF) {
    score -= LOW_EXCESS_PENALTY
    reasons.push(
      ex.exactDup
        ? `exact dup of ${ex.nearestId}`
        : ex.nearDup
          ? `near-dup of ${ex.nearestId}`
          : 'low excess vs reference'
    )
  }

  // ── Real usage ─────────────────────────────────────────────────────
  const usefulness = inputs.usefulness.get(entry.id) ?? 0
  if (usefulness > 0) {
    const bonus = Math.min(USEFULNESS_MAX_BONUS, usefulness * 8)
    score += bonus
    reasons.push(`used (+${Math.round(bonus)})`)
  }

  const ageDays = Math.max(0, (inputs.nowMs - Date.parse(entry.rememberedAt)) / MS_PER_DAY)
  if (Number.isFinite(ageDays)) {
    const recency = Math.max(0, RECENCY_MAX_BONUS * (1 - ageDays / RECENCY_WINDOW_DAYS))
    score += recency
  }

  if (usefulness <= 0 && Number.isFinite(ageDays) && ageDays > IDLE_AFTER_DAYS) {
    const idle = Math.min(IDLE_MAX_PENALTY, (ageDays - IDLE_AFTER_DAYS) * IDLE_PENALTY_PER_DAY)
    if (idle > 0) {
      score -= idle
      reasons.push(`idle ${Math.round(ageDays)}d`)
    }
  }

  // ── Groundedness / refutation ──────────────────────────────────────
  const superseded = inputs.supersededIds.has(entry.id)
  if (superseded) {
    score -= SUPERSEDED_PENALTY
    reasons.push('superseded')
  }
  if (inputs.correctedIds.has(entry.id)) {
    score -= CORRECTED_PENALTY
    reasons.push('corrected')
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

  // Corpus-level exact older dup
  if (corpusDup) {
    score -= 20
  }

  score = Math.max(0, Math.min(100, score))

  let verdict: RetentionVerdict =
    score >= ACTIVE_MIN ? 'active' : score >= ARCHIVE_MIN ? 'archive' : 'delete'

  // Grace: brand-new high-stakes knowledge gets time to be used —
  // unless already known-dead (dup/superseded/near-dup of R).
  const knownDead = corpusDup || ex.exactDup || ex.nearDup || superseded
  if (verdict !== 'active' && ageDays < GRACE_DAYS && !knownDead) {
    verdict = 'active'
    reasons.push('grace period')
  }

  if (verdict === 'delete' && PROTECTED_TYPES.has(entry.type)) {
    verdict = 'archive'
    reasons.push('protected type')
  }

  return {
    id: entry.id,
    type: entry.type,
    verdict,
    score: Math.round(score),
    reasons,
    excess: ex.excess,
    maxSim: ex.maxSim,
    nearestId: ex.nearestId,
  }
}

export function evaluateRetention(projectId: string, nowMs: number): RetentionReport {
  const inputs = collectRetentionInputs(projectId, nowMs)
  const duplicateIds = collectDuplicateIds(inputs.entries)

  const report: RetentionReport = {
    evaluated: inputs.entries.length,
    active: 0,
    archive: 0,
    delete: 0,
    referenceSize: inputs.refIndex.entries.length,
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

export function shouldEmbedEntry(entry: MemoryEntry, retention?: RetentionResult | null): boolean {
  if (!isModelMemory(entry)) return false
  if (entry.content.trim().length === 0) return false
  if (retention && retention.verdict !== 'active') return false
  // Rho: do not embed zero-excess near-dups of R
  if (retention && retention.excess !== undefined && retention.excess < 0.05) return false
  return true
}

function forgetEntry(projectId: string, id: string): boolean {
  if (projectMemory.forget(projectId, id)) return true
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
            excess: r.excess,
            reasons: r.reasons,
            verdict: r.verdict,
          },
          summary: `retention archive [${r.type}] excess=${r.excess?.toFixed(2) ?? '?'} score=${r.score}`,
          reason: 'retention-archive',
        })
      } catch {
        /* best-effort */
      }
      if (forgetEntry(projectId, r.id)) archived++
      else skipped++
    }

    // Delete verdict = no future value (not even statistical): HARD-delete.
    // Protected types never reach here (floored to archive).
    const deleteBatch = toDelete.slice(0, maxDelete)
    skipped += Math.max(0, toDelete.length - deleteBatch.length)
    const hardIds: string[] = []
    for (const r of deleteBatch) {
      if (PROTECTED_TYPES.has(r.type)) {
        skipped++
        continue
      }
      hardIds.push(r.id)
    }
    if (hardIds.length > 0) {
      deleted = hardDeleteEntries(projectId, hardIds)
      skipped += hardIds.length - deleted
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
    referenceSize: report.referenceSize,
  }
}

export function applyRetentionIncremental(projectId: string): ApplyRetentionResult {
  return applyRetention(projectId, {
    maxArchive: INCREMENTAL_MAX_ARCHIVE,
    maxDelete: INCREMENTAL_MAX_DELETE,
  })
}

export function triageInbox(
  projectId: string,
  nowMs: number = Date.now()
): { merged: number; archived: number } {
  const entries = projectMemory.allEntriesForIndex(projectId)
  const inbox = entries.filter((e) => e.type === 'inbox')
  if (inbox.length === 0) return { merged: 0, archived: 0 }

  const R = buildReferenceModel(entries)
  const refIndex = buildReferenceIndex(R)
  const report = evaluateRetention(projectId, nowMs)

  let merged = 0
  let archived = 0

  for (const item of inbox) {
    const ex = excessAgainstIndex(item.content, refIndex)
    if (ex.exactDup || ex.nearDup || ex.excess < 0.15) {
      if (forgetEntry(projectId, item.id)) merged++
      continue
    }
    const verdict = report.byId.get(item.id)
    if (verdict && verdict.verdict !== 'active') {
      try {
        archiveStorage.archive(projectId, {
          entityType: 'memory_entry',
          entityId: item.id,
          entityData: {
            id: item.id,
            type: 'inbox',
            score: verdict.score,
            excess: verdict.excess,
            reasons: verdict.reasons,
          },
          summary: `inbox triage excess=${verdict.excess?.toFixed(2) ?? '?'}`,
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

export type { CaptureGateResult } from './capture-gate'
// Re-exports for tests and capture path
export { captureGate } from './capture-gate'
export type { ExcessResult } from './excess'
export { CAPTURE_MIN_EXCESS, computeExcess, NEAR_DUP_SIM } from './excess'
export type { PurgeResult, VaultHealth } from './purge'
export {
  DEFAULT_SOFT_DELETED_PURGE_DAYS,
  isAutoSource,
  purgeOrphanRememberEvents,
  purgeSoftDeleted,
  runVaultPurge,
  trimAutoSourceCap,
  vaultHealth,
} from './purge'
export { buildReferenceModel, isReferenceEligible, REFERENCE_CAP } from './reference-model'
