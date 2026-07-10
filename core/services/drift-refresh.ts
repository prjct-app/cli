/**
 * Continuous understanding — when SessionStart detects genuine git drift since
 * last sync, kick a *lightweight* refresh so agents don't re-map the whole
 * codebase every phase (GSD map-codebase thrash). Detached, best-effort.
 *
 * SUPERIOR: not warn-forever — we stamp schedule + apply so SessionStart can
 * report "refresh applied" and stop permanent stale banners after sync lands.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const STAMP = 'drift-refresh-last.json'

export interface DriftRefreshStamp {
  /** When a detached refresh was last scheduled. */
  scheduledAt?: number
  /** When sync completed under PRJCT_WORLD_MODEL_REFRESH (applied). */
  appliedAt?: number
  /** commitsSinceSync at schedule time. */
  commitsAtSchedule?: number
}

function stampPath(cliHome: string): string {
  return path.join(cliHome, 'state', STAMP)
}

export function readDriftStamp(cliHome: string): DriftRefreshStamp {
  try {
    const p = stampPath(cliHome)
    if (!existsSync(p)) return {}
    return JSON.parse(readFileSync(p, 'utf-8')) as DriftRefreshStamp
  } catch {
    return {}
  }
}

function writeDriftStamp(cliHome: string, patch: DriftRefreshStamp): void {
  try {
    const dir = path.join(cliHome, 'state')
    mkdirSync(dir, { recursive: true })
    const prev = readDriftStamp(cliHome)
    writeFileSync(stampPath(cliHome), JSON.stringify({ ...prev, ...patch }), 'utf-8')
  } catch {
    /* ignore */
  }
}

/**
 * Throttle: at most one detached refresh per hour per machine when drift ≥ 3.
 */
export function shouldRefreshDrift(cliHome: string, commitsSinceSync: number): boolean {
  if (commitsSinceSync <= 0) return false
  if (commitsSinceSync < 3) return false
  try {
    const j = readDriftStamp(cliHome)
    // Prefer scheduledAt; fall back to legacy `at` field if present.
    const last = j.scheduledAt ?? (j as { at?: number }).at
    if (!last) return true
    return Date.now() - last > 60 * 60 * 1000
  } catch {
    return true
  }
}

/**
 * After a successful world-model sync, mark refresh applied so SessionStart
 * stops looking like permanent staleness.
 */
export function markDriftRefreshApplied(cliHome: string): void {
  writeDriftStamp(cliHome, { appliedAt: Date.now() })
}

/**
 * Pure notice: did a recent apply clear the permanent-stale look?
 * applied after schedule within the last hour → "refresh applied".
 */
export function driftStaleResolved(stamp: DriftRefreshStamp, now = Date.now()): boolean {
  if (!stamp.appliedAt || !stamp.scheduledAt) return false
  if (stamp.appliedAt < stamp.scheduledAt) return false
  return now - stamp.appliedAt < 60 * 60 * 1000
}

/**
 * SessionStart line for drift — SUPERIOR to warn-forever.
 */
export function formatDriftNotice(input: {
  warning: string
  commitsSinceSync: number
  stamp: DriftRefreshStamp
  refreshScheduled: boolean
}): string {
  if (driftStaleResolved(input.stamp)) {
    return (
      `**World model refreshed:** drift was ${input.commitsSinceSync}+ commits; ` +
      `architecture/risk/work-scope sync applied. Stale banner cleared.`
    )
  }
  if (input.refreshScheduled) {
    return (
      `**Understanding may be stale:** ${input.warning} — background world-model refresh ` +
      `scheduled (BM25 + import graph + architecture). Prefer \`prjct sync\` if this persists after ~1 min.`
    )
  }
  return (
    `**Understanding may be stale:** ${input.warning} — run \`prjct sync\` before big calls ` +
    `to refresh architecture/risk/work-scope.`
  )
}

/**
 * Spawn `prjct sync` detached from the package entry. Never blocks SessionStart.
 *
 * Live world model: `sync` already rebuilds BM25 + import graph + co-change
 * and refreshes architecture/risk analysis signals — one detached path, not a
 * second map-codebase thrash. PRJCT_DRIFT_REFRESH marks the spawn for telemetry.
 */
export function maybeDetachDriftRefresh(input: {
  projectPath: string
  cliHome: string
  commitsSinceSync: number
  prjctBin?: string
}): boolean {
  if (!shouldRefreshDrift(input.cliHome, input.commitsSinceSync)) return false
  writeDriftStamp(input.cliHome, {
    scheduledAt: Date.now(),
    commitsAtSchedule: input.commitsSinceSync,
  })

  const bin = input.prjctBin ?? process.argv[1] ?? 'prjct'
  const env = {
    ...process.env,
    PRJCT_DRIFT_REFRESH: '1',
    // Hint to sync that this is continuous-understanding refresh (world model).
    PRJCT_WORLD_MODEL_REFRESH: '1',
  }
  try {
    const child = spawn(process.execPath, [bin, 'sync', '--project', input.projectPath], {
      detached: true,
      stdio: 'ignore',
      cwd: input.projectPath,
      env,
    })
    child.unref()
    return true
  } catch {
    try {
      const child = spawn('prjct', ['sync'], {
        detached: true,
        stdio: 'ignore',
        cwd: input.projectPath,
        env,
        shell: true,
      })
      child.unref()
      return true
    } catch {
      return false
    }
  }
}
