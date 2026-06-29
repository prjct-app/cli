/**
 * Auto-Updater — opt-in silent self-update for prjct (mem_899).
 *
 * OPT-IN (default off, user enables via `prjct config set auto-update on`),
 * throttled to 1/hour, runs as a detached child so the Claude session
 * never waits. Any error is swallowed + logged to update.log. Upgrade
 * path is picked by detecting how prjct was installed (npm, bun). Binary
 * installs are never self-updated here because that would require running a
 * remote installer script in the background.
 */

import { execFile, execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { resolveCliHome } from '../infrastructure/cli-home'
import { compareSemver } from '../schemas/model'
import { getConfig, setConfig } from './global-config'
import { fetchLatestVersion } from './update-checker'

const execFileP = promisify(execFile)

// Per call — honors PRJCT_CLI_HOME (see cli-home.ts).
const stateDir = (): string => path.join(resolveCliHome(), 'state')
const logPath = (): string => path.join(stateDir(), 'auto-update.log')
const THROTTLE_MS = 60 * 60 * 1000 // 1 hour

type InstallSource = 'binary' | 'npm' | 'bun' | 'unknown'

/**
 * Public entry: call from SessionStart hook. Returns immediately;
 * the actual update (if any) runs detached in the background.
 */
export function maybeAutoUpdate(currentVersion: string | undefined): void {
  if (!currentVersion) return
  if (process.env.PRJCT_NO_AUTO_UPDATE === '1') return
  if (getConfig('auto-update') !== 'on') return

  const last = getConfig('auto-update-last-check')
  if (last && Date.now() - Date.parse(last) < THROTTLE_MS) return

  // Stamp the check timestamp NOW so concurrent SessionStart hooks
  // (parallel Claude windows) don't all race to fetch.
  setConfig('auto-update-last-check', new Date().toISOString())

  // Detached fire-and-forget. Stop hook doesn't await this; the
  // session never waits.
  const child = spawn(
    process.execPath,
    [process.argv[1], '__internal-auto-update', currentVersion],
    { detached: true, stdio: 'ignore' }
  )
  child.unref()
}

/**
 * Background entry — invoked by the spawned child process. Does the
 * actual fetch + apply. Errors land in update.log.
 */
export async function runBackgroundCheck(currentVersion: string): Promise<void> {
  try {
    const latest = await fetchLatestVersion()
    if (!latest) return
    if (compareSemver(latest, currentVersion) <= 0) {
      log(`current ${currentVersion} >= latest ${latest}, no-op`)
      return
    }

    const source = detectInstallSource()
    log(`upgrade available: ${currentVersion} → ${latest} (source: ${source})`)
    await applyUpgrade(source, latest)
    log(`upgrade complete: ${currentVersion} → ${latest}`)
  } catch (err) {
    log(`auto-update failed: ${(err as Error).message}`)
  }
}

// Internals

function detectInstallSource(): InstallSource {
  // 1. Binary install lives at ~/.prjct-cli/bin/prjct
  const binaryPath = path.join(resolveCliHome(), 'bin', 'prjct')
  if (fs.existsSync(binaryPath)) {
    try {
      const stat = fs.statSync(binaryPath)
      // Standalone binary is ~60MB; the bun-shim wrapper is <5KB. If
      // it's the big one, that's the standalone install path.
      if (stat.size > 1024 * 1024) return 'binary'
    } catch {
      /* fall through */
    }
  }
  // 2. Try `npm root -g` / `bun pm bin` to find the install dir.
  // We don't need certainty — if both fail, default to npm which is
  // most common.
  try {
    const npmGlobal = execFileSync('npm', ['root', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (npmGlobal && fs.existsSync(path.join(npmGlobal, 'prjct-cli'))) return 'npm'
  } catch {
    /* ignore */
  }
  try {
    const bunBin = execFileSync('bun', ['pm', 'bin', '-g'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (bunBin && fs.existsSync(path.join(bunBin, 'prjct'))) return 'bun'
  } catch {
    /* ignore */
  }
  return 'unknown'
}

async function applyUpgrade(source: InstallSource, _targetVersion: string): Promise<void> {
  if (source === 'binary') {
    log(
      `binary install auto-update skipped for ${_targetVersion}; run the installer manually to upgrade`
    )
    return
  }
  if (source === 'bun') {
    await execFileP('bun', ['install', '-g', 'prjct-cli@latest'], {
      timeout: 120_000,
    })
    return
  }
  if (source === 'npm' || source === 'unknown') {
    await execFileP('npm', ['install', '-g', 'prjct-cli@latest'], {
      timeout: 120_000,
    })
    return
  }
}

function log(line: string): void {
  try {
    fs.mkdirSync(stateDir(), { recursive: true })
    fs.appendFileSync(logPath(), `${new Date().toISOString()} ${line}\n`)
  } catch {
    /* best-effort */
  }
}

export const _internal = {
  fetchLatestVersion,
  detectInstallSource,
  compareSemver,
  THROTTLE_MS,
}
