/**
 * Managed session continuity — local equivalent of Claude "Managed Agents"
 * (stateful, long-running sessions without hosting the model).
 *
 * Loop:
 *   land  → stamp continuity SoT + synthesize hand-off (existing land-synthesis)
 *   prime → restore full resume card (cycle, hand-off, pressure, next actions)
 *   SessionStart (cold) → short cue pointing at prime when a stamp is fresh
 *
 * Doctrine: prjct owns the Body (SQLite stamp + memory); agents own the HOW.
 * Cross-window / cross-machine continuity rides the same project DB + optional
 * cloud sync of memory/events — never a hosted model session.
 */

import { projectMemory } from '../memory/project-memory'
import { prjctDb } from '../storage/database'
import type { LocalConfig } from '../types/config'
import { getTimestamp } from '../utils/date-helper'
import { contextPressureVerdict } from './context-pressure'
import { contextTiersOneLiner } from './context-tiers'

export const SESSION_CONTINUITY_KEY = 'session:continuity'
export const SESSION_CLOSE_TOPIC = 'session-close'

/** Fresh stamp window for SessionStart resume cue (7 days). */
export const CONTINUITY_FRESH_MS = 7 * 24 * 60 * 60 * 1000

export interface SessionContinuityStamp {
  version: 1
  landedAt: string
  projectId: string
  cycleId: string | null
  cycleDescription: string | null
  turns: number | null
  tokensIn: number | null
  tokensOut: number | null
  pressureLevel: 'ok' | 'warn' | 'critical' | null
  handoffWrote: boolean
  receiptWrote: boolean
  /** Short next actions for the next window. */
  nextActions: string[]
  /** First ~280 chars of synthesized hand-off for offline resume. */
  handoffPreview: string | null
}

export interface StampSessionContinuityInput {
  projectId: string
  projectPath: string
  config?: LocalConfig | null
  cycleId?: string | null
  cycleDescription?: string | null
  turns?: number | null
  tokensIn?: number | null
  tokensOut?: number | null
  handoffWrote?: boolean
  receiptWrote?: boolean
  handoffContent?: string | null
}

/**
 * Write the continuity stamp at land. Overwrites previous stamp (latest wins).
 */
export function stampSessionContinuity(input: StampSessionContinuityInput): SessionContinuityStamp {
  const pressure = contextPressureVerdict(input.config ?? null, {
    turnCount: input.turns ?? undefined,
    tokensIn: input.tokensIn ?? undefined,
    tokensOut: input.tokensOut ?? undefined,
    description: input.cycleDescription ?? undefined,
  })

  const nextActions: string[] = []
  if (input.cycleId || input.cycleDescription) {
    nextActions.push(
      'Resume open cycle with `prjct prime` then continue work (or `prjct status done` if finished).'
    )
    nextActions.push('Journal progress: `prjct log "what you tried"`.')
  } else {
    nextActions.push('No open cycle — `prjct work "<intent>"` or `prjct next --md` for frontier.')
  }
  nextActions.push('Pull L2 on demand: `prjct search` / `prjct guard` / MCP — never stuff into L0.')
  nextActions.push('Audit gates: `prjct context artifacts --md`.')

  const preview = input.handoffContent?.trim() ? input.handoffContent.trim().slice(0, 280) : null

  const stamp: SessionContinuityStamp = {
    version: 1,
    landedAt: getTimestamp(),
    projectId: input.projectId,
    cycleId: input.cycleId ?? null,
    cycleDescription: input.cycleDescription ?? null,
    turns: input.turns ?? null,
    tokensIn: input.tokensIn ?? null,
    tokensOut: input.tokensOut ?? null,
    pressureLevel: pressure.level === 'ok' ? (input.turns ? 'ok' : null) : pressure.level,
    handoffWrote: Boolean(input.handoffWrote),
    receiptWrote: Boolean(input.receiptWrote),
    nextActions,
    handoffPreview: preview,
  }

  prjctDb.setDoc(input.projectId, SESSION_CONTINUITY_KEY, stamp)
  return stamp
}

export function loadSessionContinuity(projectId: string): SessionContinuityStamp | null {
  try {
    const raw = prjctDb.getDoc<SessionContinuityStamp>(projectId, SESSION_CONTINUITY_KEY)
    if (!raw || raw.version !== 1 || !raw.landedAt) return null
    return raw
  } catch {
    return null
  }
}

export function isContinuityFresh(
  stamp: SessionContinuityStamp | null,
  nowMs: number = Date.now()
): boolean {
  if (!stamp?.landedAt) return false
  const t = Date.parse(stamp.landedAt)
  if (!Number.isFinite(t)) return false
  return nowMs - t <= CONTINUITY_FRESH_MS
}

/**
 * Latest session-close hand-off body from memory (topic session-close).
 * Best-effort FTS / recall — never throws.
 */
export function loadLastSessionCloseContent(projectId: string): string | null {
  try {
    // Prefer entries tagged topic=session-close via FTS then filter tags.
    const hits = projectMemory.searchFts(projectId, ['session', 'close', 'land-auto'], 12)
    for (const h of hits) {
      if (h.type !== 'context') continue
      const tags = h.tags ?? {}
      if (tags.topic === SESSION_CLOSE_TOPIC || tags.source === 'land-auto') {
        return h.content
      }
      if (h.content.startsWith('Session close:')) return h.content
    }
    // Fallback: recent context recall
    const recent = projectMemory.recall(projectId, { types: ['context'], limit: 8 })
    for (const e of recent) {
      const tags = e.tags ?? {}
      if (tags.topic === SESSION_CLOSE_TOPIC || tags.source === 'land-auto') return e.content
      if (e.content.startsWith('Session close:')) return e.content
    }
  } catch {
    /* ignore */
  }
  return null
}

export interface ResumeCardInput {
  stamp: SessionContinuityStamp | null
  /** Live open cycle description (may differ from stamp if work continued). */
  liveCycleDescription?: string | null
  liveCycleId?: string | null
  journal?: string[]
  sessionCloseContent?: string | null
  pendingHandoffCue?: string | null
}

/**
 * Full managed-session resume card for `prjct prime`.
 */
export function formatSessionResumeCard(input: ResumeCardInput): string {
  const lines: string[] = [
    '# Managed session resume',
    '',
    '_Local continuity (Claude Managed Agents pattern without hosting the model). Land stamps SoT; prime restores it._',
    '',
  ]

  const stamp = input.stamp
  if (stamp && isContinuityFresh(stamp)) {
    const ago = formatRelativeIso(stamp.landedAt)
    lines.push(`**Last land:** ${stamp.landedAt.slice(0, 19)} (${ago})`)
    lines.push(
      `- Hand-off: ${stamp.handoffWrote ? 'written' : 'none'} · Receipt: ${stamp.receiptWrote ? 'written' : 'none'}`
    )
    if (stamp.turns != null) {
      lines.push(
        `- Last cycle budget signal: turns=${stamp.turns}` +
          (stamp.tokensIn != null || stamp.tokensOut != null
            ? ` · tokens in=${stamp.tokensIn ?? 0} out=${stamp.tokensOut ?? 0}`
            : '') +
          (stamp.pressureLevel ? ` · pressure=${stamp.pressureLevel}` : '')
      )
    }
    lines.push('')
  } else if (stamp) {
    lines.push(
      `**Last land:** ${stamp.landedAt.slice(0, 19)} (stale >7d) — treat as historical; re-land after work.`
    )
    lines.push('')
  } else {
    lines.push(
      '**No land stamp yet.** After meaningful work run `prjct land` so the next window resumes cleanly.'
    )
    lines.push('')
  }

  const cycleDesc = input.liveCycleDescription ?? stamp?.cycleDescription
  if (cycleDesc) {
    lines.push(`**Active / last cycle:** ${cycleDesc}`)
    if (input.liveCycleId) lines.push(`- id: \`${input.liveCycleId.slice(0, 8)}\``)
    if (input.journal && input.journal.length > 0) {
      lines.push('**Journal (recent):**')
      for (const j of input.journal) lines.push(`- ${j.slice(0, 120)}`)
    }
    lines.push('')
  } else {
    lines.push('**No open cycle** on this workspace.')
    lines.push('')
  }

  const close = input.sessionCloseContent ?? stamp?.handoffPreview
  if (close) {
    lines.push('## Last session hand-off')
    lines.push('')
    // Keep resume card bounded — full body is in memory.
    const body = close.length > 900 ? `${close.slice(0, 897)}…` : close
    lines.push(body)
    lines.push('')
    lines.push('_Full entry: `prjct context memory session-close` / topic `session-close`._')
    lines.push('')
  }

  if (input.pendingHandoffCue) {
    lines.push('## Multi-agent handoff')
    lines.push('')
    lines.push(input.pendingHandoffCue)
    lines.push('')
  }

  if (stamp?.nextActions?.length) {
    lines.push('## Next actions')
    lines.push('')
    for (const a of stamp.nextActions) lines.push(`- ${a}`)
    lines.push('')
  }

  lines.push('## Context diet')
  lines.push('')
  lines.push(contextTiersOneLiner())
  lines.push('')
  lines.push(
    'Default surface: `work` + `ship` (user text confirm). Deeper: `prjct brief` · `prjct search` · `prjct guard` · `prjct context artifacts --md`.'
  )

  return lines.join('\n')
}

/**
 * One short SessionStart cue when a fresh stamp exists (cold start only).
 */
export function formatContinuitySessionCue(stamp: SessionContinuityStamp | null): string | null {
  if (!stamp || !isContinuityFresh(stamp)) return null
  const ago = formatRelativeIso(stamp.landedAt)
  const cycle = stamp.cycleDescription
    ? ` · cycle "${stamp.cycleDescription.slice(0, 50)}${stamp.cycleDescription.length > 50 ? '…' : ''}"`
    : ''
  return [
    '# prjct: managed session continuity',
    `Last land ${ago}${cycle}. Restore full state: \`prjct prime --md\` (work graph + hand-off + next actions).`,
    stamp.handoffWrote
      ? 'Hand-off is in SQLite (`topic:session-close`) — do not re-discover from chat history.'
      : 'No hand-off body last land — prime still restores cycle/frontier if open.',
  ].join('\n')
}

/**
 * Closing lines for `prjct land` — product narrative for next window.
 */
export function formatLandContinuityFooter(stamp: SessionContinuityStamp): string {
  return [
    '',
    '## Managed session continuity',
    '',
    `- Stamped at \`${stamp.landedAt.slice(0, 19)}\` (SoT key \`${SESSION_CONTINUITY_KEY}\`).`,
    '- **Next window / machine:** `prjct prime --md` restores cycle + last hand-off + next actions.',
    '- Cross-device: same project DB / cloud sync of memory — no hosted model session required.',
    `- Context diet: ${contextTiersOneLiner()}`,
  ].join('\n')
}

function formatRelativeIso(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return iso
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}
