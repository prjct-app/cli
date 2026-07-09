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
      cue: `# prjct: CONTEXT PRESSURE (critical ~${Math.round(effective * 100)}%)
Session is filling — STOP expanding scope. \`prjct land\` now, then \`/clear\` or new window + \`prjct prime\`. Fresh context with compound judgment beats a rotten long thread (GSD-class discipline, SQLite-backed).`,
    }
  }

  if (effective >= WARN_RATIO) {
    return {
      level: 'warn',
      turns,
      limit,
      ratio: effective,
      cue: `# prjct: context pressure (~${Math.round(effective * 100)}%)
Plan the close: finish the slice, \`prjct land\`, avoid more exploration in this window.`,
    }
  }

  return { level: 'ok', cue: null, turns, limit, ratio: effective }
}
