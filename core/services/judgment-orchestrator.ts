/**
 * Quality orchestrator (P0) — automatic judgment when required; never auto-ship.
 *
 * Doctrine:
 *  - Human asks for features only. Quality opens/injects itself when intensity
 *    is standard|full (or harness forces full).
 *  - `prjct ship` stays human-only. This module never calls ship.
 *  - Pure CLI steps only (open ledger, next card text). Host agent runs
 *    RED/BLUE / challenge following the card.
 */

import type { JudgmentLedger, ReviewIntensity } from '../schemas/judgment'
import { judgmentLedgerStorage } from '../storage/judgment-ledger-storage'
import { getTimestamp } from '../utils/date-helper'
import { computeCommittedChangeset, computeWorkingTreeChangeset } from './delivery-geometry'
import {
  buildNextAction,
  createLedger,
  type IntensitySignals,
  intensityFromChangeset,
  type NextActionCard,
} from './precision-judgment'

/** Ship is human-only — never auto-invoke. Shared by skill + orchestration. */
export const SHIP_USER_ONLY =
  'Ship is user-only. Do not run `prjct ship` unless the user explicitly asked to ship/publish this turn.'

export type QualityCeremony = 'none' | 'standard' | 'full'

export function qualityFromIntensity(intensity: ReviewIntensity): QualityCeremony {
  if (intensity === 'skip') return 'none'
  if (intensity === 'standard') return 'standard'
  return 'full'
}

export function intensityFromQuality(q: QualityCeremony): ReviewIntensity {
  if (q === 'none') return 'skip'
  if (q === 'standard') return 'standard'
  return 'full'
}

export interface EnsureLedgerResult {
  /** Whether a new ledger was created. */
  opened: boolean
  intensity: ReviewIntensity
  quality: QualityCeremony
  ledger: JudgmentLedger | null
  next: NextActionCard
}

/**
 * Resolve intensity from git changeset + harness signals (working tree preferred
 * mid-cycle; committed range for ship-like views).
 */
export async function resolveWorkIntensity(
  projectPath: string,
  signals: IntensitySignals = {}
): Promise<{ intensity: ReviewIntensity; files: number; loc: number }> {
  let files = 0
  let loc = 0
  try {
    const wt = await computeWorkingTreeChangeset(projectPath)
    if (wt && (wt.files > 0 || wt.loc > 0)) {
      files = wt.files
      loc = wt.loc
    } else {
      const cs = await computeCommittedChangeset(projectPath)
      if (cs) {
        files = cs.files
        loc = cs.loc
      }
    }
  } catch {
    /* no git — intensity from signals only */
  }
  const { intensity } = intensityFromChangeset({ files, loc }, signals)
  return { intensity, files, loc }
}

/**
 * Ensure an active judgment ledger exists when quality is required.
 * Idempotent: reuses in_progress / approved ledger; never opens on skip.
 * Does NOT run ship.
 */
export async function ensureJudgmentLedger(input: {
  projectId: string
  projectPath: string
  target?: string
  signals?: IntensitySignals
  /** Force intensity (e.g. from orchestration quality field). */
  forceIntensity?: ReviewIntensity
}): Promise<EnsureLedgerResult> {
  const resolved = await resolveWorkIntensity(input.projectPath, input.signals ?? {})
  const intensity = input.forceIntensity ?? resolved.intensity
  const quality = qualityFromIntensity(intensity)

  const existing = judgmentLedgerStorage.get(input.projectId)
  if (quality === 'none') {
    const next = buildNextAction(existing, intensity)
    return { opened: false, intensity, quality, ledger: existing, next }
  }

  if (existing && (existing.verdict === 'in_progress' || existing.verdict === 'approved')) {
    const next = buildNextAction(existing, existing.intensity)
    return { opened: false, intensity: existing.intensity, quality, ledger: existing, next }
  }

  const target =
    input.target?.trim() ||
    (await defaultBranchTarget(input.projectPath)) ||
    `work-${getTimestamp().slice(0, 10)}`

  let deliveryTier: 'trivial' | 'normal' | 'large' | undefined
  try {
    const { tierOf } = await import('./delivery-geometry')
    deliveryTier = tierOf({ files: resolved.files, loc: resolved.loc })
  } catch {
    deliveryTier = undefined
  }

  const ledger = createLedger({
    target,
    intensity,
    deliveryTier,
    now: getTimestamp(),
  })
  judgmentLedgerStorage.set(input.projectId, ledger)
  const next = buildNextAction(ledger, intensity)
  return { opened: true, intensity, quality, ledger, next }
}

/**
 * Markdown block for prompt/stop inject. Never mentions running ship.
 * Returns null when no quality work is pending (skip or approved).
 */
export function formatQualityInject(
  card: NextActionCard,
  ledger: JudgmentLedger | null
): string | null {
  if (card.intensity === 'skip') return null
  if (ledger?.verdict === 'approved') {
    return [
      '# prjct: quality ready',
      '',
      `- Judgment ledger \`${ledger.id.slice(0, 8)}\` → **APPROVED** (intensity=${ledger.intensity}).`,
      `- ${SHIP_USER_ONLY}`,
      '- Do not invent a ship step. Wait for the user to ask to ship/publish.',
    ].join('\n')
  }

  if (card.kind === 'skip_ship') return null

  const lines = [
    '# prjct: quality orchestrator (automatic)',
    '',
    `- **kind**: \`${card.kind}\` · intensity **${card.intensity}** · round ${card.fixRound}/${card.maxFixRounds}`,
    `- **directive**: ${card.directive}`,
    '',
    '### Steps (run these — human does not type judgment)',
    ...card.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    `_${SHIP_USER_ONLY}_`,
  ]
  if (card.judgeCharters) {
    lines.push(
      '',
      '### Charters',
      `RED: ${card.judgeCharters.red}`,
      '',
      `BLUE: ${card.judgeCharters.blue}`
    )
  }
  if (card.rankedFixIds.length) {
    lines.push('', `### Blast rank: ${card.rankedFixIds.join(' → ')}`)
  }
  return lines.join('\n')
}

/**
 * Build inject text for the current project (prompt/stop). Pure read + format.
 * Opens nothing — call ensureJudgmentLedger on work start.
 */
export function qualityInjectForProject(projectId: string): string | null {
  const ledger = judgmentLedgerStorage.get(projectId)
  const intensity = ledger?.intensity ?? 'skip'
  if (!ledger && intensity === 'skip') return null
  const card = buildNextAction(
    ledger,
    intensity === 'skip' && ledger ? ledger.intensity : intensity
  )
  // If no ledger and we don't know intensity, skip inject (work start will open)
  if (!ledger) {
    // Still inject if somehow quality was required but ledger missing mid-cycle
    return null
  }
  return formatQualityInject(card, ledger)
}

async function defaultBranchTarget(projectPath: string): Promise<string | null> {
  try {
    const { getGitBranch } = await import('../session/git-helpers')
    return (await getGitBranch(projectPath)) ?? null
  } catch {
    return null
  }
}

/** Test helper: hard-require quality for ship when intensity is not skip. */
export function shipRequiresQuality(intensity: ReviewIntensity): boolean {
  return intensity !== 'skip'
}
