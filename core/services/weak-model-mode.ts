/**
 * Weak-model product mode — intensify harness when the user/agent runs on a
 * weaker model (not only the CI weak-model bench).
 *
 * Config: judgment.weakModelMode = off | on
 * When on: conflictMode floors to strict, quality floors for H2+, prime/session
 * banner tells the agent to lean on prjct judgment harder.
 */

import type { LocalConfig } from '../types/config'
import type { ConflictMode } from './decision-conflict'
import { effectiveConflictMode } from './decision-conflict'
import type { QualityCeremony } from './judgment-orchestrator'

export type WeakModelMode = 'off' | 'on'

export function effectiveWeakModelMode(config: LocalConfig | null | undefined): WeakModelMode {
  return config?.judgment?.weakModelMode === 'on' ? 'on' : 'off'
}

/**
 * Conflict intensity under weak-model mode: force strict when on, unless the
 * user explicitly set judgment.conflictMode=off (escape hatch).
 * Pack defaults alone do not keep the gate quiet under weak-model product mode.
 */
export function conflictModeWithWeakModel(config: LocalConfig | null | undefined): ConflictMode {
  const explicit = config?.judgment?.conflictMode
  if (explicit === 'off') return 'off'
  if (effectiveWeakModelMode(config) === 'on') return 'strict'
  return effectiveConflictMode(config)
}

/** Quality ceremony floor when weak-model mode is on. */
export function qualityFloorWithWeakModel(
  quality: QualityCeremony,
  weakOrConfig: WeakModelMode | LocalConfig | null | undefined
): QualityCeremony {
  const weak: WeakModelMode =
    weakOrConfig === 'on' || weakOrConfig === 'off'
      ? weakOrConfig
      : effectiveWeakModelMode(weakOrConfig)
  if (weak !== 'on') return quality
  if (quality === 'none') return 'standard'
  if (quality === 'standard') return 'full'
  return quality
}

export function weakModelBanner(): string {
  return [
    '# prjct: WEAK-MODEL PRODUCT MODE',
    'Harness intensified: conflict gate → strict (unless conflictMode=off), quality ceremony elevated, lean on SQLite judgment (receipts/gotchas/decisions) over model instinct.',
    'North star: weak-model + prjct ≥ good-model alone on cadence + quality.',
  ].join('\n')
}

export function weakModelOneLiner(): string {
  return 'Weak-model product mode ON — strict conflict + elevated quality; compound judgment over thrash.'
}
