/**
 * Token economics as a product score — daily/cycle spend vs budget.
 * Surfaced on prime + harness (existing verbs only).
 */

import { prjctDb } from '../storage/database'

export interface TokenEconomics {
  /** Tokens attributed to tasks updated in the last 24h (in+out). */
  tokens24h: number
  /** Tokens on the active cycle if any. */
  cycleTokens: number
  cycleBudget: number | null
  /** 0–100 health: under budget / low spend = higher. */
  score: number
  line: string
}

export function buildTokenEconomics(
  projectId: string,
  opts: {
    cycleTokensIn?: number
    cycleTokensOut?: number
    maxTokensPerCycle?: number | null
  } = {}
): TokenEconomics {
  const since = Date.now() - 24 * 60 * 60 * 1000
  let tokens24h = 0
  try {
    // tasks.tokens_in/out may be null; sum best-effort for recently updated rows
    const rows = prjctDb.query<{ tin: number | null; tout: number | null }>(
      projectId,
      `SELECT tokens_in AS tin, tokens_out AS tout FROM tasks
       WHERE updated_at IS NOT NULL AND updated_at >= ?
       LIMIT 200`,
      new Date(since).toISOString()
    )
    for (const r of rows) {
      tokens24h += (r.tin ?? 0) + (r.tout ?? 0)
    }
  } catch {
    // fallback: sum all non-null (legacy DBs without updated_at filter)
    try {
      const row = prjctDb.get<{ s: number }>(
        projectId,
        `SELECT COALESCE(SUM(COALESCE(tokens_in,0)+COALESCE(tokens_out,0)),0) AS s FROM tasks`
      )
      tokens24h = row?.s ?? 0
    } catch {
      tokens24h = 0
    }
  }

  const cycleTokens = (opts.cycleTokensIn ?? 0) + (opts.cycleTokensOut ?? 0)
  const cycleBudget = opts.maxTokensPerCycle ?? null

  // Score: reward measured low thrash; penalize over-budget cycles.
  let score = 70
  if (tokens24h === 0 && cycleTokens === 0) {
    score = 80 // unknown/unmeasured — not a failure
  } else if (cycleBudget && cycleBudget > 0) {
    const ratio = cycleTokens / cycleBudget
    if (ratio <= 0.5) score = 100
    else if (ratio <= 0.8) score = 85
    else if (ratio <= 1.0) score = 70
    else if (ratio <= 1.2) score = 45
    else score = 25
  } else if (tokens24h < 50_000) score = 90
  else if (tokens24h < 200_000) score = 75
  else if (tokens24h < 500_000) score = 55
  else score = 35

  const budgetBit =
    cycleBudget != null && cycleBudget > 0
      ? `cycle=${cycleTokens}/${cycleBudget}`
      : cycleTokens > 0
        ? `cycle=${cycleTokens}`
        : 'cycle=—'
  const line = `Token economics: 24h≈${tokens24h} · ${budgetBit} · score=${score}/100 (compound judgment > fresh-window thrash)`

  return { tokens24h, cycleTokens, cycleBudget, score, line }
}
