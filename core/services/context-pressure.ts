/**
 * Context-pressure cues — beat GSD's context-window utilization guard without
 * needing proprietary host metrics.
 *
 * Uses turn count + optional token budget (already on the active task) as a
 * host-agnostic proxy. At 60%/70% of the cycle turn budget (or stuck threshold),
 * inject land/compact pressure so agents close the loop instead of rotting.
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
 * projects without an explicit budget still get pressure cues.
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
      cue: `# prjct: CONTEXT PRESSURE (critical ~${Math.round(effective * 100)}%) — HARD GATE
Session is full — STOP expanding scope. \`prjct ship\` is blocked until you \`prjct land\` then \`/clear\` or new window + \`prjct prime\`.
Compact path (MUST): (1) finish or pause the open slice (2) \`prjct land\` (3) fresh window + \`prjct prime\` — do NOT re-research from zero.
Fresh compound judgment (SQLite) beats GSD fresh-window thrash. Override ship only with explicit consent: \`prjct ship --force-pressure\`.`,
    }
  }

  if (effective >= WARN_RATIO) {
    return {
      level: 'warn',
      turns,
      limit,
      ratio: effective,
      cue: `# prjct: context pressure (~${Math.round(effective * 100)}%) — compact path
Context budget low. Mandatory close plan THIS window:
1. Finish the current slice only (no new exploration / no multi-file rabbit holes)
2. \`prjct land\` before context dies
3. Next window: \`prjct prime\` (not a blank chat)
Do not open broad Grep/Glob or spawn research subagents until after land+prime.`,
    }
  }

  return { level: 'ok', cue: null, turns, limit, ratio: effective }
}

/** Critical pressure blocks ship / expansion — superior to banner-only guards. */
export function contextPressureBlocksExpansion(v: ContextPressureVerdict): boolean {
  return v.level === 'critical'
}

/**
 * Host-agnostic one-liner for statusline / doctor / Codex status_line.
 * Empty string when ok (no noise on the chrome).
 */
export function contextPressureStatusLine(v: ContextPressureVerdict): string {
  if (v.level === 'critical') {
    return `ctx:${Math.round(v.ratio * 100)}% CRITICAL → land then prime`
  }
  if (v.level === 'warn') {
    return `ctx:${Math.round(v.ratio * 100)}% → land/prime soon`
  }
  return ''
}

/**
 * True when agents MUST take the compact path (land → fresh → prime)
 * before expanding scope — warn OR critical.
 */
export function contextPressureRequiresCompactPath(v: ContextPressureVerdict): boolean {
  return v.level === 'warn' || v.level === 'critical'
}
