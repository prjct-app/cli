/**
 * Self-heal — re-installs hooks + global CLAUDE.md when the running
 * binary's version differs from the last successful sync.
 *
 * Why this exists: `npm install -g prjct-cli` only updates the binary.
 * `scripts/postinstall.js` is best-effort and disabled on many client
 * machines by `--ignore-scripts` or corporate security policies, so we
 * cannot rely on it to refresh `~/.claude/settings.json` hooks or the
 * `<!-- prjct:start -->` block in `~/.claude/CLAUDE.md` after an upgrade.
 *
 * The fix is runtime: every prjct invocation reads a tiny stamp file at
 * `~/.prjct-cli/state/installed-version`. If it matches the bundled
 * version → fast no-op (one fs read, microseconds). If it differs →
 * re-run `installGlobalConfig()` + `settings-installer.install()` and
 * rewrite the stamp.
 *
 * Idempotency comes from the installers themselves:
 *   - settings-installer: every entry tagged `_prjctManaged: true`,
 *     dedupes on re-run.
 *   - command-installer: rewrites the `<!-- prjct:start -->` block
 *     between markers; user content outside the markers is preserved.
 *
 * Failure mode: every step is wrapped — a self-heal failure must NEVER
 * block the user's command. Worst case the user keeps the stale config
 * until the next invocation.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const STAMP_DIR = path.join(os.homedir(), '.prjct-cli', 'state')
const STAMP_PATH = path.join(STAMP_DIR, 'installed-version')

function readStamp(): string | null {
  try {
    return fs.readFileSync(STAMP_PATH, 'utf-8').trim()
  } catch {
    return null
  }
}

function writeStamp(version: string): void {
  try {
    fs.mkdirSync(STAMP_DIR, { recursive: true })
    fs.writeFileSync(STAMP_PATH, version, 'utf-8')
  } catch {
    // best-effort
  }
}

/**
 * Cheap check — single fs read. Use this to gate the slow path.
 * Returns true when the stamp matches the running version (no work needed).
 */
export function isSyncCurrent(currentVersion: string): boolean {
  if (!currentVersion) return true
  return readStamp() === currentVersion
}

/**
 * Run the actual re-sync. Caller is expected to have checked
 * `isSyncCurrent` first; calling this on the hot path is wasteful but
 * not incorrect — the underlying installers are idempotent.
 *
 * Errors are swallowed by design.
 */
export async function runSelfHeal(currentVersion: string): Promise<void> {
  if (!currentVersion) return
  if (process.env.PRJCT_NO_SELF_SYNC === '1') return

  try {
    const { installGlobalConfig } = await import('./command-installer')
    await installGlobalConfig()
  } catch {
    // best-effort
  }

  try {
    const settingsInstaller = await import('../services/settings-installer')
    await settingsInstaller.install()
  } catch {
    // best-effort
  }

  writeStamp(currentVersion)
}

/**
 * One-shot helper: cheap-check + slow-path. Safe to call from hot paths
 * — when the stamp matches the running version this returns
 * immediately after a single fs read.
 */
export async function selfHealIfStale(currentVersion: string): Promise<void> {
  if (process.env.PRJCT_NO_SELF_SYNC === '1') return
  if (isSyncCurrent(currentVersion)) return
  await runSelfHeal(currentVersion)
}
