/**
 * Discuss-lock — product decisions before plan/code on high-stakes work.
 *
 * Beats open-GSD's discuss-phase theater without a new verb: when harness
 * level is H2+ and SDD is advisory/strict, `prjct work` requires a REVIEWED
 * intent/spec (the product lock) before the cycle starts. Trivial/H0–H1 stay
 * DIRECT. SDD `off` never blocks (opt-out remains possible).
 */

import type { HarnessLevel } from '../schemas/state'
import type { LocalConfig } from '../types/config'

export type DiscussLockMode = 'off' | 'advisory' | 'strict'

export interface DiscussLockVerdict {
  /** True → startTask must refuse until a reviewed spec is linked. */
  blocked: boolean
  /** Human-facing reason (empty when not blocked). */
  message: string
  /** Why the lock applied (telemetry / tests). */
  reason: 'sdd-strict' | 'discuss-h2' | 'none'
}

export function effectiveDiscussSddMode(config: LocalConfig | null | undefined): DiscussLockMode {
  return config?.sdd?.mode ?? 'off'
}

/**
 * H2/H3 work needs a product lock when SDD is on (advisory or strict).
 * Strict already blocks every cycle; advisory only blocks high harness levels.
 */
export function discussLockVerdict(input: {
  sddMode: DiscussLockMode
  harnessLevel: HarnessLevel
  hasSpecId: boolean
  specStatus?: string | null
}): DiscussLockVerdict {
  const { sddMode, harnessLevel, hasSpecId, specStatus } = input
  if (sddMode === 'off') {
    return { blocked: false, message: '', reason: 'none' }
  }

  const highStakes = harnessLevel === 'H2' || harnessLevel === 'H3'
  const enforceAll = sddMode === 'strict'
  const enforceHigh = sddMode === 'advisory' && highStakes

  if (!enforceAll && !enforceHigh) {
    return { blocked: false, message: '', reason: 'none' }
  }

  const reason = enforceAll ? 'sdd-strict' : 'discuss-h2'
  if (!hasSpecId) {
    return {
      blocked: true,
      reason,
      message:
        reason === 'sdd-strict'
          ? 'Strict SDD: an intent/spec is required before work. Run `prjct intent "<title>"`, pass `prjct audit-spec <id>`, then `prjct work --spec <id>`. (Relax with `prjct sdd advisory` or `off`.) SUPERIOR to GSD discuss theater: code-enforced, SQLite-backed.'
          : `Discuss-lock (${harnessLevel}): lock product decisions before code. Run \`prjct intent "<title>"\` → \`prjct audit-spec <id>\` → \`prjct work --spec <id>\`. SUPERIOR to GSD discuss-before-plan: code-enforced on H2+, not markdown ceremony. Relax: \`prjct sdd off\`.`,
    }
  }

  if (specStatus === 'draft') {
    return {
      blocked: true,
      reason,
      message: `Discuss-lock: linked spec is still draft — run \`prjct audit-spec\` until reviewed before implementing.`,
    }
  }

  return { blocked: false, message: '', reason: 'none' }
}
