/**
 * Install consolidation — the durable fix for the "4 parallel prjct installs"
 * footgun the README warns about. After Phase 1 has updated every detected
 * install, the user still has N copies across pnpm/bun/npm/yarn/brew at the
 * same version, with one shadowing the rest in PATH. This removes the
 * redundant non-winner copies so the machine ends with ONE canonical install.
 *
 * Destructive — the README explicitly warns aggressive cleanup can brick a
 * shell, so removal is gated behind a strict safety model and (by default)
 * a TTY confirmation; non-interactive runs warn only.
 */

import { execSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import {
  detectInstallerFromRunningBinary,
  getAllInstalledLocations,
  isHomebrewInstall,
  type PkgManagerName,
} from './package-managers'

/** How aggressively `prjct update` consolidates parallel installs. */
export type CleanupMode = 'auto' | 'force' | 'off'

/** PM-native global uninstall (preferred over rm — keeps PM metadata sane). */
const UNINSTALL_ARGS: Record<PkgManagerName, string> = {
  npm: 'npm uninstall -g prjct-cli',
  pnpm: 'pnpm remove -g prjct-cli',
  bun: 'bun remove -g prjct-cli',
  yarn: 'yarn global remove prjct-cli',
}

export interface CleanupPlan {
  /** the PM that owns the PATH-winning binary — never removed */
  winner: PkgManagerName | 'brew' | null
  /** redundant copies safe to remove */
  removable: Array<{ pm: PkgManagerName | 'brew'; version: string }>
  /** copies left alone, with a human reason */
  skipped: Array<{ pm: string; reason: string }>
}

/** realpath of the prjct binary the user's shell actually runs, or null. */
function pathWinnerReal(): string | null {
  try {
    const p = execSync('command -v prjct', { stdio: 'pipe', shell: '/bin/sh' }).toString().trim()
    if (!p) return null
    try {
      return realpathSync(p)
    } catch {
      return p
    }
  } catch {
    return null
  }
}

/** The dev source tree (npm/bun link) — never remove it. */
function sourceRoot(): string {
  try {
    return realpathSync(path.resolve(__dirname, '..', '..', '..'))
  } catch {
    return ''
  }
}

/**
 * Pure: decide which copies are safe to remove. Never removes the PATH
 * winner, the dev checkout, or anything whose ownership can't be proven
 * (getAllInstalledLocations already verifies `prjct-cli/package.json`).
 */
export function planCleanup(): CleanupPlan {
  const winnerReal = pathWinnerReal()
  const winnerPm = detectInstallerFromRunningBinary()
  const src = sourceRoot()
  const skipped: CleanupPlan['skipped'] = []

  // Gate #1: a provable winner is mandatory. Without it we cannot know
  // which copy to keep → refuse to remove anything.
  if (!winnerReal && !winnerPm) {
    return {
      winner: null,
      removable: [],
      skipped: [
        { pm: '(all)', reason: 'cannot resolve the PATH-winning binary — refusing to remove' },
      ],
    }
  }

  const brewWinner = winnerReal?.includes('/Cellar/') || winnerReal?.includes('/homebrew/')
  const winner: CleanupPlan['winner'] = brewWinner ? 'brew' : winnerPm

  const removable: CleanupPlan['removable'] = []
  for (const loc of getAllInstalledLocations()) {
    if (loc.pm.name === winnerPm) {
      skipped.push({ pm: loc.pm.name, reason: 'PATH winner — kept' })
      continue
    }
    // Gate: never remove the dev source tree (npm/bun link).
    const root = loc.pm.getInstallRoot()
    if (root && src) {
      let resolved = path.join(root, 'prjct-cli')
      try {
        resolved = realpathSync(resolved)
      } catch {
        /* ignore */
      }
      if (resolved === src) {
        skipped.push({ pm: loc.pm.name, reason: 'resolves to the dev source tree (link) — kept' })
        continue
      }
    }
    removable.push({ pm: loc.pm.name, version: loc.version })
  }

  // Brew: only if a brew copy exists AND it is not the winner.
  if (isHomebrewInstall() && !brewWinner) {
    removable.push({ pm: 'brew', version: '(homebrew)' })
  } else if (isHomebrewInstall() && brewWinner) {
    skipped.push({ pm: 'brew', reason: 'PATH winner — kept' })
  }

  return { winner, removable, skipped }
}

function removeOne(pm: PkgManagerName | 'brew'): { ok: boolean; error?: string } {
  const cmd = pm === 'brew' ? 'brew uninstall prjct-cli' : UNINSTALL_ARGS[pm]
  try {
    execSync(cmd, { stdio: 'pipe', shell: '/bin/sh' })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: `${pm}: ${(e as Error).message.split('\n')[0]}` }
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  try {
    const a = await new Promise<string>((res) => rl.question(`${question} [y/N] `, res))
    return /^y(es)?$/i.test(a.trim())
  } finally {
    rl.close()
  }
}

/**
 * Consolidate parallel installs. Returns details/errors to merge into the
 * update Cleanup phase (no new top-level phase — keeps the 3-phase shape).
 *
 *   mode 'off'   → skip entirely
 *   mode 'force' → remove without asking (used by `--yes`)
 *   mode 'auto'  → TTY: preview + confirm; non-TTY: warn only, remove nothing
 */
export async function consolidateInstalls(
  mode: CleanupMode,
  dryRun: boolean,
  assumeYes: boolean
): Promise<{ details: string[]; errors: string[] }> {
  const details: string[] = []
  const errors: string[] = []

  if (mode === 'off') {
    details.push('Install consolidation skipped (--no-cleanup)')
    return { details, errors }
  }

  const plan = planCleanup()

  if (plan.removable.length === 0) {
    details.push(
      plan.skipped.some((s) => s.pm === '(all)')
        ? `Consolidation skipped — ${plan.skipped[0].reason}`
        : 'Single install — nothing to consolidate'
    )
    return { details, errors }
  }

  const list = plan.removable.map((r) => `${r.pm} (${r.version})`).join(', ')
  details.push(`Winner: ${plan.winner ?? 'unknown'} — redundant copies: ${list}`)

  if (dryRun) {
    for (const r of plan.removable) details.push(`Would remove ${r.pm} copy`)
    return { details, errors }
  }

  const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true
  const proceed =
    mode === 'force' ||
    assumeYes ||
    (interactive &&
      (await confirm(
        `Remove ${plan.removable.length} redundant prjct install(s) [${list}], keeping ${plan.winner}?`
      )))

  if (!proceed) {
    if (interactive) {
      details.push('Consolidation declined — left all installs in place')
    } else {
      details.push(
        `Multiple installs detected [${list}]. Run \`prjct upgrade --yes\` to consolidate (kept ${plan.winner}).`
      )
    }
    return { details, errors }
  }

  for (const r of plan.removable) {
    const res = removeOne(r.pm)
    if (res.ok) details.push(`Removed redundant ${r.pm} install`)
    else errors.push(res.error ?? `failed to remove ${r.pm}`)
  }
  for (const s of plan.skipped) details.push(`Kept ${s.pm}: ${s.reason}`)

  return { details, errors }
}
