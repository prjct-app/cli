/**
 * Continuous understanding — when SessionStart detects genuine git drift since
 * last sync, kick a *lightweight* refresh so agents don't re-map the whole
 * codebase every phase (GSD map-codebase thrash). Detached, best-effort.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const STAMP = 'drift-refresh-last.json'

function stampPath(cliHome: string): string {
  return path.join(cliHome, 'state', STAMP)
}

/**
 * Throttle: at most one detached refresh per hour per machine.
 */
export function shouldRefreshDrift(cliHome: string, commitsSinceSync: number): boolean {
  if (commitsSinceSync <= 0) return false
  // Only act on real drift (same threshold band as staleness warnings).
  if (commitsSinceSync < 3) return false
  try {
    const p = stampPath(cliHome)
    if (!existsSync(p)) return true
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const raw = require('node:fs').readFileSync(p, 'utf-8') as string
    const j = JSON.parse(raw) as { at?: number }
    if (!j.at) return true
    return Date.now() - j.at > 60 * 60 * 1000
  } catch {
    return true
  }
}

function writeStamp(cliHome: string): void {
  try {
    const fs = require('node:fs') as typeof import('node:fs')
    const dir = path.join(cliHome, 'state')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(stampPath(cliHome), JSON.stringify({ at: Date.now() }), 'utf-8')
  } catch {
    /* ignore */
  }
}

/**
 * Spawn `prjct sync` detached from the package entry. Never blocks SessionStart.
 */
export function maybeDetachDriftRefresh(input: {
  projectPath: string
  cliHome: string
  commitsSinceSync: number
  prjctBin?: string
}): void {
  if (!shouldRefreshDrift(input.cliHome, input.commitsSinceSync)) return
  writeStamp(input.cliHome)

  const bin = input.prjctBin ?? process.argv[1] ?? 'prjct'
  try {
    const child = spawn(process.execPath, [bin, 'sync', '--project', input.projectPath], {
      detached: true,
      stdio: 'ignore',
      cwd: input.projectPath,
      env: { ...process.env, PRJCT_DRIFT_REFRESH: '1' },
    })
    child.unref()
  } catch {
    // try bare prjct on PATH
    try {
      const child = spawn('prjct', ['sync'], {
        detached: true,
        stdio: 'ignore',
        cwd: input.projectPath,
        env: { ...process.env, PRJCT_DRIFT_REFRESH: '1' },
        shell: true,
      })
      child.unref()
    } catch {
      /* never block session */
    }
  }
}
