/**
 * Hard loop guard — the deterministic stop a frontier model self-imposes, given
 * to every rig. When `config.maxTurnsPerCycle` is set and the active cycle has
 * ground past it without the human acknowledging (`prjct work --extend`), prjct
 * STOPS it: the per-turn block escalates to ⛔, and the pre-edit hook denies
 * further edits on any host whose PreToolUse contract honors a deny decision.
 *
 * This is the ONE place the threshold logic lives — the per-turn escalation and
 * the edit-deny both read this verdict, so they can never disagree. prjct still
 * never owns the loop: it returns a decision the host's own contract honors, and
 * the consent override (`--extend`) keeps it advisory-by-consent, not a jailer.
 */

import type { CurrentTask } from '../schemas/state'
import type { LocalConfig } from '../types/config'

export interface LoopGuardVerdict {
  /** True when the cycle is over budget and not acknowledged → stop. */
  stopped: boolean
  turns: number
  limit: number
  /** Human-facing stop message (empty when not stopped). */
  message: string
}

export function loopGuardVerdict(
  config: LocalConfig | null,
  task: CurrentTask | null
): LoopGuardVerdict {
  const limit = config?.maxTurnsPerCycle ?? 0
  const turns = task?.turnCount ?? 0
  const acknowledged = Boolean(task?.turnLimitAcknowledgedAt)
  const stopped = limit > 0 && !!task && turns >= limit && !acknowledged
  const desc = task?.description ?? 'this cycle'
  const message = stopped
    ? `⛔ prjct hard stop: ${turns} turns on cycle "${desc}" (limit ${limit}). You are looping — STOP. Re-plan, split it, or ship the slice that already works, then \`prjct status done\`. To consciously continue THIS cycle: \`prjct work --extend\`.`
    : ''
  return { stopped, turns, limit, message }
}
