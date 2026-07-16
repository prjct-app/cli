/**
 * Context-pressure cues — signal-density guard, NOT a forced session killer.
 *
 * Policy (product, 2026-07): long sessions are fine. What we protect is that
 * the window does not fill with junk (broad Grep, re-research, padded recall).
 * Hosts (Codex/Claude) already show real context % — when THAT hits 100%, the
 * host may need a new window. prjct must not invent a second, earlier "you
 * must land / clear" ritual that thrash-ends productive work.
 *
 * Uses turn count + optional token budget as a soft proxy only.
 * Soft cues at 60%/70% of cycle budget. Ship hard-block is OFF by default
 * (opt-in: LocalConfig.contextPressure.hardBlockShip === true).
 */

import type { LocalConfig } from '../types/config'

const DEFAULT_TURN_SOFT = 15
const WARN_RATIO = 0.6
const CRITICAL_RATIO = 0.7

export type ContextPressureLevel = 'ok' | 'warn' | 'critical'

/** Minimal task shape — full CurrentTask or a slim ActiveTaskView projection. */
export interface ContextPressureTask {
  turnCount?: number
  tokensIn?: number
  tokensOut?: number
  description?: string
}

export interface ContextPressureVerdict {
  level: ContextPressureLevel
  /** Short hook line; null when nothing to say. */
  cue: string | null
  turns: number
  limit: number
  ratio: number
}

/**
 * Prefer configured maxTurnsPerCycle; fall back to the stuck threshold so
 * projects without an explicit budget still get soft density cues.
 */
export function contextPressureVerdict(
  config: LocalConfig | null | undefined,
  task: ContextPressureTask | null | undefined
): ContextPressureVerdict {
  const turns = task?.turnCount ?? 0
  const limit =
    config?.maxTurnsPerCycle && config.maxTurnsPerCycle > 0
      ? config.maxTurnsPerCycle
      : DEFAULT_TURN_SOFT
  const ratio = limit > 0 ? turns / limit : 0

  if (!task || turns <= 0) {
    return { level: 'ok', cue: null, turns, limit, ratio: 0 }
  }

  // Token budget twin (when present) can escalate independently.
  const tokenBudget = config?.maxTokensPerCycle ?? 0
  const spent = (task.tokensIn ?? 0) + (task.tokensOut ?? 0)
  const tokenRatio = tokenBudget > 0 ? spent / tokenBudget : 0
  const effective = Math.max(ratio, tokenRatio)

  if (effective >= CRITICAL_RATIO) {
    return {
      level: 'critical',
      turns,
      limit,
      ratio: effective,
      cue: `# prjct: context density (high ~${Math.round(effective * 100)}%)
Session continues — do NOT force land/clear just because the cycle is long.
Protect the window: no broad Grep/Glob thrash, no re-research from zero, pull memory by id (\`prjct context memory mem_N\`), prefer compact format.
Persist durable signal with \`prjct remember\` / land when YOU choose hygiene — not as a kill switch.
Host "Context 100%" is the real window limit; until then keep working with high-signal tools only.`,
    }
  }

  if (effective >= WARN_RATIO) {
    return {
      level: 'warn',
      turns,
      limit,
      ratio: effective,
      cue: `# prjct: context density (~${Math.round(effective * 100)}%)
Keep the chat — prefer high-signal tools only:
1. Finish the current slice (no new rabbit holes)
2. Recall compact / by-id — do not re-index the tree
3. Optional hygiene later: \`prjct land\` then \`prjct prime\` if the HOST context is actually full
Do not treat this as "session must end".`,
    }
  }

  return { level: 'ok', cue: null, turns, limit, ratio: effective }
}

/**
 * Ship hard-block. Default OFF — long sessions are valid.
 * Opt-in per project: config.contextPressure.hardBlockShip === true AND critical.
 */
export function contextPressureBlocksExpansion(
  v: ContextPressureVerdict,
  config?: LocalConfig | null
): boolean {
  if (config?.contextPressure?.hardBlockShip === true && v.level === 'critical') {
    return true
  }
  return false
}

/**
 * Host-agnostic one-liner for statusline / doctor.
 * Empty string when ok (no noise on the chrome).
 */
export function contextPressureStatusLine(v: ContextPressureVerdict): string {
  if (v.level === 'critical') {
    return `ctx:${Math.round(v.ratio * 100)}% density — compact tools only`
  }
  if (v.level === 'warn') {
    return `ctx:${Math.round(v.ratio * 100)}% density — prefer compact`
  }
  return ''
}

/**
 * Prefer compact tool use (pull-by-id, no thrash) — NOT "must land/new window".
 */
export function contextPressureRequiresCompactPath(v: ContextPressureVerdict): boolean {
  return v.level === 'warn' || v.level === 'critical'
}
