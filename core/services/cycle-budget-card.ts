/**
 * Per-cycle token/turn budget card — Dynasty D5 / economic moat.
 *
 * Injected ONCE at work start (and printable on land), never every turn.
 * Complements context-pressure (which escalates at 60/70%).
 */

import type { ContextPressureLevel } from './context-pressure'

export interface CycleBudgetInput {
  turns: number
  turnLimit: number
  tokensSpent: number
  /** null/0 = unmeasured */
  tokenBudget: number | null
  pressureLevel?: ContextPressureLevel
}

export interface CycleBudgetCard {
  /** One terminal line */
  line: string
  /** Markdown block for --md surfaces */
  md: string
  turnRatio: number
  tokenRatio: number
}

/**
 * Pure budget card. Always returns a card when limits exist; never null when
 * turnLimit > 0 so agents see the budget at cycle open.
 */
export function buildCycleBudgetCard(input: CycleBudgetInput): CycleBudgetCard {
  const turnLimit = Math.max(1, input.turnLimit || 15)
  const turns = Math.max(0, input.turns)
  const turnRatio = turns / turnLimit
  const tokenBudget = input.tokenBudget != null && input.tokenBudget > 0 ? input.tokenBudget : null
  const tokensSpent = Math.max(0, input.tokensSpent)
  const tokenRatio = tokenBudget ? tokensSpent / tokenBudget : 0
  const pressure = input.pressureLevel ?? 'ok'

  const turnBit = `turns ${turns}/${turnLimit}`
  const tokBit =
    tokenBudget != null
      ? `tokens ${tokensSpent}/${tokenBudget}`
      : tokensSpent > 0
        ? `tokens spent≈${tokensSpent} (no cycle budget set)`
        : 'tokens — (set maxTokensPerCycle to track)'
  const landCue =
    pressure === 'critical'
      ? 'LAND NOW · prjct land then /clear'
      : pressure === 'warn'
        ? 'plan land soon · no more exploration'
        : 'land before context dies · prjct land'

  const line = `Cycle budget: ${turnBit} · ${tokBit} · pressure=${pressure} · ${landCue}`
  const md = [
    '## Cycle budget (once per work cycle)',
    '',
    `- ${turnBit} (${Math.round(turnRatio * 100)}%)`,
    `- ${tokBit}${tokenBudget ? ` (${Math.round(tokenRatio * 100)}%)` : ''}`,
    `- pressure: **${pressure}**`,
    `- close path: \`${landCue}\``,
    '',
    '_Dynasty: cost-to-quality is a product feature — GSD thrash is not._',
  ].join('\n')

  return { line, md, turnRatio, tokenRatio }
}
