/**
 * Gate result cache.
 *
 * Skips re-running a gate when the inputs that would change its outcome
 * (files changed, active task tags, branch) haven't moved since the last
 * green run. Default TTL is 1 h — gates guard pre-flight, so stale cache
 * is much cheaper than re-running `tsc` on every task start.
 *
 * Only gate PASSES are cached. Failures always re-run so the user sees a
 * fresh error. This matches the mental model: "we know it's green, skip
 * the check" rather than "we know it's red, skip the check".
 */

import crypto from 'node:crypto'
import { prjctDb } from '../storage/database'

const DEFAULT_TTL_MS = 60 * 60 * 1000

interface CacheRow {
  rule_id: number
  context_hash: string
  ran_at: string
  ttl_ms: number
}

export function hashContext(parts: {
  filesChanged: string[]
  tags: Record<string, string>
  branch: string
}): string {
  const normalized = JSON.stringify({
    files: [...parts.filesChanged].sort(),
    tags: Object.fromEntries(Object.entries(parts.tags).sort()),
    branch: parts.branch,
  })
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

export const gateCache = {
  /** Return true if a fresh pass is on record for this (rule, context). */
  isFresh(projectId: string, ruleId: number, contextHash: string): boolean {
    const row = prjctDb.get<CacheRow>(
      projectId,
      'SELECT rule_id, context_hash, ran_at, ttl_ms FROM workflow_rule_cache WHERE rule_id = ? AND context_hash = ?',
      ruleId,
      contextHash
    )
    if (!row) return false
    const ranAt = new Date(row.ran_at).getTime()
    if (Number.isNaN(ranAt)) return false
    return Date.now() - ranAt < row.ttl_ms
  },

  record(projectId: string, ruleId: number, contextHash: string, ttlMs = DEFAULT_TTL_MS): void {
    prjctDb.run(
      projectId,
      `INSERT OR REPLACE INTO workflow_rule_cache (rule_id, context_hash, ran_at, ttl_ms)
       VALUES (?, ?, ?, ?)`,
      ruleId,
      contextHash,
      new Date().toISOString(),
      ttlMs
    )
  },

  /** Called when the rule changes so stale caches can't haunt us. */
  invalidate(projectId: string, ruleId: number): void {
    prjctDb.run(projectId, 'DELETE FROM workflow_rule_cache WHERE rule_id = ?', ruleId)
  },
}
