/**
 * Developer evolution — typed weekly snapshots of what the agent knows about
 * the developer, plus how their delivery is trending.
 *
 * Granular facts live in `memory_entries` (preferences as `feedback`,
 * friction as `improvement-signal`, knowledge as decision/gotcha/learning);
 * `velocity_sprints` holds delivery. This service rolls both into ONE typed
 * row per ISO week in `developer_profile_snapshots` with a generated summary
 * line — so "how has the dev (and the agent's model of them) evolved?" is a
 * SELECT over snapshots, not an LLM re-read of raw history.
 *
 * Writes are idempotent per week (INSERT OR IGNORE on the epoch-week PK):
 * the first sync of a week captures it, later syncs are no-ops.
 */

import { prjctDb } from '../storage/database'
import { epochWeek, velocityStorage } from '../storage/velocity-storage'

export interface DeveloperSnapshot {
  week: number
  capturedAt: string
  preferences: number
  frictions: number
  decisions7d: number
  gotchas7d: number
  learnings7d: number
  tasksCompleted7d: number
  ships7d: number
  velocityAvg: number
  summary: string
}

interface SnapshotRow {
  week: number
  captured_at: string
  preferences: number
  frictions: number
  decisions_7d: number
  gotchas_7d: number
  learnings_7d: number
  tasks_completed_7d: number
  ships_7d: number
  velocity_avg: number
  summary: string
}

const rowToSnapshot = (r: SnapshotRow): DeveloperSnapshot => ({
  week: r.week,
  capturedAt: r.captured_at,
  preferences: r.preferences,
  frictions: r.frictions,
  decisions7d: r.decisions_7d,
  gotchas7d: r.gotchas_7d,
  learnings7d: r.learnings_7d,
  tasksCompleted7d: r.tasks_completed_7d,
  ships7d: r.ships_7d,
  velocityAvg: r.velocity_avg,
  summary: r.summary,
})

/** Count non-deleted memory entries of a type, optionally in the last 7 days. */
function countEntries(projectId: string, type: string, sinceEpochMs?: number): number {
  const sql = sinceEpochMs
    ? 'SELECT COUNT(*) AS c FROM memory_entries WHERE type = ? AND deleted_at IS NULL AND created_at >= ?'
    : 'SELECT COUNT(*) AS c FROM memory_entries WHERE type = ? AND deleted_at IS NULL'
  const params = sinceEpochMs ? [type, sinceEpochMs] : [type]
  return prjctDb.get<{ c: number }>(projectId, sql, ...params)?.c ?? 0
}

/** Deterministic one-line summary — the row's LLM/human-readable digest. */
function buildSummary(s: Omit<DeveloperSnapshot, 'summary' | 'week' | 'capturedAt'>): string {
  const knowledge = s.decisions7d + s.gotchas7d + s.learnings7d
  const delivery =
    s.ships7d > 0 || s.tasksCompleted7d > 0
      ? `shipped ${s.ships7d}, completed ${s.tasksCompleted7d} cycles`
      : 'no deliveries recorded'
  return (
    `Week digest: ${delivery}; velocity avg ${s.velocityAvg.toFixed(1)} pts/wk. ` +
    `Agent's model of the dev: ${s.preferences} standing preferences, ` +
    `${s.frictions} friction signals; +${knowledge} knowledge entries this week ` +
    `(${s.decisions7d} decisions, ${s.gotchas7d} gotchas, ${s.learnings7d} learnings).`
  )
}

/**
 * Capture this week's snapshot (idempotent — first sync of the week wins).
 * Best-effort: callers must never block on it.
 */
export async function captureDeveloperSnapshot(projectId: string): Promise<boolean> {
  const now = new Date().toISOString()
  const week = epochWeek(now)
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000
  const sinceIso = new Date(since).toISOString()

  const velocity = await velocityStorage.getMetrics(projectId)
  const fields = {
    preferences: countEntries(projectId, 'feedback'),
    frictions: countEntries(projectId, 'improvement-signal'),
    decisions7d: countEntries(projectId, 'decision', since),
    gotchas7d: countEntries(projectId, 'gotcha', since),
    learnings7d: countEntries(projectId, 'learning', since),
    tasksCompleted7d:
      prjctDb.get<{ c: number }>(
        projectId,
        'SELECT COUNT(*) AS c FROM tasks WHERE completed_at IS NOT NULL AND completed_at >= ?',
        sinceIso
      )?.c ?? 0,
    ships7d:
      prjctDb.get<{ c: number }>(
        projectId,
        'SELECT COUNT(*) AS c FROM shipped_features WHERE shipped_at >= ?',
        sinceIso
      )?.c ?? 0,
    velocityAvg: velocity.averageVelocity,
  }

  const result = prjctDb.run(
    projectId,
    `INSERT OR IGNORE INTO developer_profile_snapshots
       (week, captured_at, preferences, frictions, decisions_7d, gotchas_7d, learnings_7d,
        tasks_completed_7d, ships_7d, velocity_avg, summary)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    week,
    now,
    fields.preferences,
    fields.frictions,
    fields.decisions7d,
    fields.gotchas7d,
    fields.learnings7d,
    fields.tasksCompleted7d,
    fields.ships7d,
    fields.velocityAvg,
    buildSummary(fields)
  )
  return result.changes > 0
}

/** Last N weekly snapshots, newest first. */
export function getDeveloperEvolution(projectId: string, limit = 8): DeveloperSnapshot[] {
  return prjctDb
    .query<SnapshotRow>(
      projectId,
      'SELECT * FROM developer_profile_snapshots ORDER BY week DESC LIMIT ?',
      limit
    )
    .map(rowToSnapshot)
}

/**
 * Markdown evolution block for agent surfaces (`prjct_developer`): the weekly
 * digests newest-first plus a one-line trend comparison.
 */
export function renderDeveloperEvolution(projectId: string, limit = 6): string | null {
  const snaps = getDeveloperEvolution(projectId, limit)
  if (snaps.length === 0) return null

  const lines: string[] = ['## Evolution (weekly snapshots)']
  if (snaps.length >= 2) {
    const latest = snaps[0]
    const prior = snaps[snaps.length - 1]
    const vDelta = latest.velocityAvg - prior.velocityAvg
    const pDelta = latest.preferences - prior.preferences
    lines.push(
      `Over ${snaps.length} weeks: velocity ${vDelta >= 0 ? '+' : ''}${vDelta.toFixed(1)} pts/wk, ` +
        `standing preferences ${pDelta >= 0 ? '+' : ''}${pDelta}, ` +
        `frictions ${latest.frictions - prior.frictions >= 0 ? '+' : ''}${latest.frictions - prior.frictions}.`
    )
  }
  for (const s of snaps) {
    lines.push(`- ${s.capturedAt.slice(0, 10)} — ${s.summary}`)
  }
  return lines.join('\n')
}
