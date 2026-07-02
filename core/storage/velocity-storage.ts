/**
 * Velocity Storage (PRJ-296, restored under Schema v2)
 *
 * Velocity — how much the developer is actually delivering — is COMPUTED from
 * the typed tables (`tasks.completed_at` + `shipped_features.shipped_at`) and
 * persisted as weekly rollups in the typed `velocity_sprints` table. The
 * legacy kv blob's write path had been amputated (zero `saveMetrics` callers),
 * so every reader silently got DEFAULT_VELOCITY_METRICS; migration 54 retired
 * that blob and `recompute()` (called on every sync) now keeps the sprints
 * fresh from real delivery data.
 *
 * A "sprint" is an ISO epoch-week (`floor(epoch-days / 7)`), so sprint numbers
 * are stable across machines. Points = ships (a ship is the unit of delivered
 * value) + completed work cycles.
 *
 * Extends StorageManager solely for `publishEntityEvent` (the sync wire).
 */

import type { SprintVelocity, VelocityMetrics, VelocityTrend } from '../schemas/velocity'
import { DEFAULT_VELOCITY_METRICS } from '../schemas/velocity'
import { prjctDb } from './database'
import { StorageManager } from './storage-manager'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Stable cross-machine sprint number: whole weeks since the Unix epoch.
 * Returns null for unparseable timestamps — sync-pulled rows can carry '' or
 * garbage, and a single NaN week key used to throw in weekStartIso and kill
 * BOTH velocity and the weekly dev snapshot on every sync thereafter.
 */
export function epochWeek(dateIso: string): number | null {
  const t = new Date(dateIso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor(t / WEEK_MS)
}

function weekStartIso(week: number): string {
  return new Date(week * WEEK_MS).toISOString()
}

function weekEndIso(week: number): string {
  return new Date((week + 1) * WEEK_MS - 1).toISOString()
}

interface SprintRow {
  sprint_number: number
  points_completed: number
  tasks_completed: number
  estimation_accuracy: number
  avg_variance: number
  started_at: string | null
  ended_at: string | null
}

interface VelocityStoreData {
  metrics: VelocityMetrics
  lastUpdated: string
}

class VelocityStorage extends StorageManager<VelocityStoreData> {
  constructor() {
    super('velocity.json')
  }

  // Vestigial abstract-method implementations — the blob path is unused; kept
  // only so `publishEntityEvent` (the sync surface) stays available.
  protected getDefault(): VelocityStoreData {
    return { metrics: DEFAULT_VELOCITY_METRICS, lastUpdated: '' }
  }

  protected getEventType(action: 'update' | 'create' | 'delete'): string {
    return `velocity.${action}d`
  }

  // Domain Methods

  /**
   * Recompute weekly sprints from the typed delivery tables and upsert them.
   * Cheap (two grouped SELECTs) — safe to run on every sync.
   */
  async recompute(projectId: string): Promise<void> {
    // Completed work cycles per week (tasks.completed_at is ISO text; the
    // division happens in JS after a grouped fetch to keep SQL portable).
    const taskRows = prjctDb.query<{ completed_at: string }>(
      projectId,
      'SELECT completed_at FROM tasks WHERE completed_at IS NOT NULL'
    )
    const shipRows = prjctDb.query<{ shipped_at: string }>(
      projectId,
      'SELECT shipped_at FROM shipped_features'
    )

    const byWeek = new Map<number, { tasks: number; ships: number }>()
    for (const r of taskRows) {
      const w = epochWeek(r.completed_at)
      if (w === null) continue // malformed timestamp — skip the row, not the sprint rebuild
      const cur = byWeek.get(w) ?? { tasks: 0, ships: 0 }
      cur.tasks++
      byWeek.set(w, cur)
    }
    for (const r of shipRows) {
      const w = epochWeek(r.shipped_at)
      if (w === null) continue
      const cur = byWeek.get(w) ?? { tasks: 0, ships: 0 }
      cur.ships++
      byWeek.set(w, cur)
    }

    for (const [week, agg] of byWeek) {
      prjctDb.run(
        projectId,
        `INSERT INTO velocity_sprints
           (sprint_number, points_completed, tasks_completed, estimation_accuracy, avg_variance, started_at, ended_at)
         VALUES (?, ?, ?, 0, 0, ?, ?)
         ON CONFLICT(sprint_number) DO UPDATE SET
           points_completed = excluded.points_completed,
           tasks_completed = excluded.tasks_completed,
           started_at = excluded.started_at,
           ended_at = excluded.ended_at`,
        week,
        agg.ships + agg.tasks,
        agg.tasks,
        weekStartIso(week),
        weekEndIso(week)
      )
    }

    const metrics = await this.getMetrics(projectId)
    await this.publishEntityEvent(projectId, 'velocity', 'updated', {
      averageVelocity: metrics.averageVelocity,
      trend: metrics.velocityTrend,
      sprintCount: metrics.sprints.length,
    })
  }

  /**
   * Velocity metrics from the typed sprints: recent sprints, average velocity
   * (last 6 weeks), and the trend (last 3 weeks vs the 3 before).
   */
  async getMetrics(projectId: string): Promise<VelocityMetrics> {
    const rows = prjctDb.query<SprintRow>(
      projectId,
      'SELECT * FROM velocity_sprints ORDER BY sprint_number DESC LIMIT 12'
    )
    if (rows.length === 0) return DEFAULT_VELOCITY_METRICS

    const sprints: SprintVelocity[] = rows
      .slice()
      .reverse()
      .map((r) => ({
        sprintNumber: r.sprint_number,
        startDate: r.started_at ?? weekStartIso(r.sprint_number),
        endDate: r.ended_at ?? weekEndIso(r.sprint_number),
        pointsCompleted: r.points_completed,
        tasksCompleted: r.tasks_completed,
        avgVariance: r.avg_variance,
        estimationAccuracy: r.estimation_accuracy,
      }))

    const recent = rows.slice(0, 6)
    const averageVelocity =
      recent.reduce((sum, r) => sum + r.points_completed, 0) / Math.max(1, recent.length)

    const last3 = rows.slice(0, 3).reduce((s, r) => s + r.points_completed, 0)
    const prev3 = rows.slice(3, 6).reduce((s, r) => s + r.points_completed, 0)
    let velocityTrend: VelocityTrend = 'stable'
    // Balanced windows only: with 4-5 sprints, last-3 vs prev-1/2 compared a
    // 3-week sum against a smaller one and reported flat delivery "improving".
    if (rows.length >= 6) {
      if (last3 > prev3 * 1.15) velocityTrend = 'improving'
      else if (last3 < prev3 * 0.85) velocityTrend = 'declining'
    }

    return {
      sprints,
      averageVelocity,
      velocityTrend,
      // No estimation data exists yet (tasks carry no point estimates) —
      // honest zeros rather than invented accuracy.
      estimationAccuracy: 0,
      overEstimated: [],
      underEstimated: [],
      lastUpdated: new Date().toISOString(),
    }
  }
}

export const velocityStorage = new VelocityStorage()
