/**
 * Auto-Updater — opt-in silent self-update for prjct (mem_899).
 *
 * OPT-IN (default off, user enables via `prjct config set auto-update on`),
 * throttled to 1/hour, runs as a detached child so the Claude session
 * never waits. Any error is swallowed + logged to update.log. Upgrade
 * path is picked by detecting how prjct was installed (binary, npm, bun).
 */

import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { resolveCliHome } from '../infrastructure/cli-home'
import { getConfig, setConfig } from './global-config'

const execFileP = promisify(execFile)

// Per call — honors PRJCT_CLI_HOME (see cli-home.ts).
const stateDir = (): string => path.join(resolveCliHome(), 'state')
const logPath = (): string => path.join(stateDir(), 'auto-update.log')
const THROTTLE_MS = 60 * 60 * 1000 // 1 hour
const NPM_REGISTRY = 'https://registry.npmjs.org/prjct-cli/latest'

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

async function fetchLatestVersion(): Promise<string | null> {
  try {
    // 6s timeout — npm registry should answer fast or not at all
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 6000)
    const res = await fetch(NPM_REGISTRY, { signal: ac.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = (await res.json()) as { version?: string }
    return typeof json.version === 'string' ? json.version : null
  } catch {
    return null
  }
}

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
    const npmGlobal = String(require('node:child_process').execSync('npm root -g')).trim()
    if (npmGlobal && fs.existsSync(path.join(npmGlobal, 'prjct-cli'))) return 'npm'
  } catch {
    /* ignore */
  }
  try {
    const bunBin = String(require('node:child_process').execSync('bun pm bin -g')).trim()
    if (bunBin && fs.existsSync(path.join(bunBin, 'prjct'))) return 'bun'
  } catch {
    /* ignore */
  }
  return 'unknown'
}

async function applyUpgrade(source: InstallSource, _targetVersion: string): Promise<void> {
  if (source === 'binary') {
    // Re-run install-via-claude.sh — it handles platform detection,
    // checksum, atomic swap. Fetch over curl since we know git might
    // not be present on the user's box.
    const url =
      'https://raw.githubusercontent.com/jlopezlira/prjct-cli/main/scripts/install-via-claude.sh'
    await execFileP('bash', ['-c', `curl -sSL '${url}' | bash`], {
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    })
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

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
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
