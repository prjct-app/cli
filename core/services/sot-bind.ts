/**
 * SoT hard-bind — Dynasty D3.
 *
 * Living-apply already tags decision/gotcha/fact as SoT (tip→user BINDING).
 * This module **code-enforces** that on H2+ active work: high-confidence SoT
 * preventive memory on the file under edit DENIES Edit|Write until supersede
 * or conflict:override — without requiring conflictMode=strict.
 *
 * SUGGEST types (pattern/anti-pattern/learning) never deny via this path.
 */

import type { HarnessLevel } from '../schemas/state'
import type { ConflictCandidate } from './decision-conflict'

/** Types that living-apply classifies as Source of Truth. */
export const SOT_BIND_TYPES = new Set([
  'decision',
  'gotcha',
  'fact',
  'spec',
  'identity',
  'voice',
  'glossary',
])

export type SotBindAction = 'none' | 'warn' | 'deny'
export type SotBindReason = 'none' | 'h2-sot-deny' | 'h1-sot-warn' | 'override' | 'no-sot'

export interface SotBindVerdict {
  action: SotBindAction
  reason: SotBindReason
  memoryIds: string[]
  message: string
}

export function isSotBindType(type: string): boolean {
  return SOT_BIND_TYPES.has(type)
}

/**
 * Filter conflict candidates to high-confidence SoT only (not SUGGEST).
 */
export function filterSotCandidates(
  candidates: readonly ConflictCandidate[],
  overriddenIds?: Iterable<string>
): ConflictCandidate[] {
  const overridden = new Set(overriddenIds ?? [])
  return candidates.filter(
    (c) => isSotBindType(c.type) && c.confidence === 'high' && c.id && !overridden.has(c.id)
  )
}

/**
 * Pure SoT bind gate.
 * - H2/H3: deny high-confidence SoT on the file (hard-bind)
 * - H1: warn only (nudge)
 * - H0/null: none
 * - override ids: filtered out before action
 */
export function sotBindVerdict(input: {
  harnessLevel: HarnessLevel | null | undefined
  candidates: readonly ConflictCandidate[]
  overriddenIds?: Iterable<string>
  fileLabel?: string
}): SotBindVerdict {
  const sot = filterSotCandidates(input.candidates, input.overriddenIds)
  if (sot.length === 0) {
    return { action: 'none', reason: 'no-sot', memoryIds: [], message: '' }
  }

  const level = input.harnessLevel ?? null
  const fileBit = input.fileLabel ? ` on \`${input.fileLabel}\`` : ''
  const primary = sot[0]!
  const ids = sot.map((c) => c.id)
  const recovery =
    'To supersede: `prjct remember decision "…why…" --tags supersedes:' +
    primary.id +
    '`. To lift for this memory: `prjct remember feedback "override conflict ' +
    primary.id +
    ': <why>" --tags conflict:override,memory:' +
    primary.id +
    '`.'

  if (level === 'H2' || level === 'H3') {
    const reason = `SoT hard-bind (${level})${fileBit}: must not contradict [${primary.type}] ${truncate(primary.content, 80)} (\`${primary.id}\`)`
    return {
      action: 'deny',
      reason: 'h2-sot-deny',
      memoryIds: ids,
      message: [
        `⛔ prjct SoT bind: ${reason}`,
        `Memories: ${ids.join(', ')}`,
        recovery,
        'H2+ work is bound to living Source-of-Truth. Supersede or override before Edit|Write.',
      ].join(' '),
    }
  }

  if (level === 'H1') {
    return {
      action: 'warn',
      reason: 'h1-sot-warn',
      memoryIds: ids,
      message: [
        '# prjct: SoT soft-bind (H1)',
        '',
        `High-confidence SoT on this file${fileBit}:`,
        ...sot.slice(0, 3).map((c) => `- **[${c.type}]** ${truncate(c.content, 100)} \`${c.id}\``),
        '',
        recovery,
        '',
        '> H2+ would hard-block. On H1 this is advisory — supersede if intentional.',
      ].join('\n'),
    }
  }

  return { action: 'none', reason: 'none', memoryIds: ids, message: '' }
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}
