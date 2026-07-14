/**
 * Rho retention dry-run on land — Dynasty D5.
 *
 * Closes the dogfood loop: every `prjct land` shows what retention would
 * archive/delete vs live vault mass — never grow-forever without a signal.
 * Pure orchestration over applyRetention({ dryRun: true }) + vaultHealth.
 */

import { type ApplyRetentionResult, applyRetention } from './retention'
import { type VaultHealth, vaultHealth } from './retention/purge'

export interface LandRhoReport {
  health: VaultHealth
  retention: ApplyRetentionResult
  /** live mass before dry-run (soft-deleted excluded) */
  live: number
  wouldArchive: number
  wouldDelete: number
  line: string
  md: string
}

/**
 * Best-effort dry-run. Never throws — land must not fail because Rho hiccuped.
 */
export function runLandRhoDryRun(projectId: string): LandRhoReport | null {
  try {
    const health = vaultHealth(projectId)
    const retention = applyRetention(projectId, {
      dryRun: true,
      maxArchive: 50,
      maxDelete: 50,
    })
    const live = health.live
    const wouldArchive = retention.wouldArchive
    const wouldDelete = retention.wouldDelete
    const line =
      `Memory mass (Rho dry-run): live=${live} soft=${health.softDeleted} arch=${health.archives}` +
      ` · would archive=${wouldArchive} delete=${wouldDelete}` +
      ` · R=${retention.referenceSize ?? '—'}` +
      (wouldArchive + wouldDelete > 0
        ? ' · run `prjct sync` to apply retention/purge'
        : ' · vault healthy (no purge candidates)')

    const md = [
      '## Memory mass (Rho dry-run)',
      '',
      `| Signal | Value |`,
      `|---|---:|`,
      `| Live | ${live} |`,
      `| Soft-deleted | ${health.softDeleted} |`,
      `| Archives | ${health.archives} |`,
      `| Would archive | ${wouldArchive} |`,
      `| Would delete | ${wouldDelete} |`,
      `| Reference \\|R\\| | ${retention.referenceSize ?? 0} |`,
      '',
      `**${line}**`,
      '',
    ].join('\n')

    return {
      health,
      retention,
      live,
      wouldArchive,
      wouldDelete,
      line,
      md,
    }
  } catch {
    return null
  }
}
