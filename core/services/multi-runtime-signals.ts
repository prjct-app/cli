/**
 * Multi-runtime signal parity — SUPERIOR mandate.
 *
 * Hosts differ (hooks APIs ≠ ASCII). What must be equal: the *signal contracts*
 * each core runtime receives via installers + skill/AGENTS surfaces.
 *
 * Core five: Claude, Codex, Gemini, Cursor, Grok.
 */

export const CORE_SUPERIORITY_RUNTIMES = ['claude', 'codex', 'gemini', 'cursor', 'grok'] as const

export type SuperiorityRuntime = (typeof CORE_SUPERIORITY_RUNTIMES)[number]

/**
 * Signal contracts every core runtime must surface (host-native form).
 * Not identical shell hooks — identical *meaning* to the agent.
 */
export const SUPERIORITY_SIGNAL_CONTRACTS = [
  'discuss-lock',
  'context-pressure',
  'land',
  'handoff-switch-accept',
  'sot-suggest-tip',
  'package-legitimacy',
  'loop-discipline-skill',
] as const

export type SuperioritySignal = (typeof SUPERIORITY_SIGNAL_CONTRACTS)[number]

/**
 * How each signal reaches each runtime today (install path / surface).
 * Used by tests + harness docs — keep honest, not aspirational.
 */
export function runtimeSignalDelivery(
  runtime: SuperiorityRuntime
): Record<SuperioritySignal, string> {
  const viaHooks = 'PRJCT_HOOKS / host hook map (prompt, session-start, pre-package, land cues)'
  const viaSkill = 'skill body / compact skill CONTRACT.loop'
  const viaCli = 'prjct work|switch|accept|ship --md'

  const common: Record<SuperioritySignal, string> = {
    'discuss-lock': `${viaCli} + startTask discussLockVerdict`,
    'context-pressure': `${viaHooks} + ship hard gate`,
    land: `${viaHooks} land-cue + land.mode pack default`,
    'handoff-switch-accept': `${viaCli} switch/accept + SessionStart handoff cue`,
    'sot-suggest-tip': `${viaCli} work related-context + prompt topical cue tip→user`,
    'package-legitimacy': `${viaHooks} pre-package + ship --allow-new-deps`,
    'loop-discipline-skill': viaSkill,
  }

  if (runtime === 'claude') {
    return {
      ...common,
      'loop-discipline-skill': 'Claude SKILL.md full body + CONTRACT.loop compact inherit',
    }
  }
  if (runtime === 'codex') {
    return {
      ...common,
      'loop-discipline-skill': 'Codex SKILL.md (buildCompactSkill) includes CONTRACT.loop',
      'package-legitimacy': 'Codex hooks.json maps PreToolUse Bash → pre-package',
    }
  }
  if (runtime === 'gemini') {
    return {
      ...common,
      'loop-discipline-skill': 'GEMINI.md global config includes CONTRACT.loop',
      'package-legitimacy': 'Gemini BeforeTool/run_shell_command maps pre-package',
    }
  }
  if (runtime === 'cursor') {
    return {
      ...common,
      'loop-discipline-skill':
        'Cursor .mdc pointer + portable skill; CONTRACT.loop in compact surfaces',
      'package-legitimacy': 'Cursor preToolUse Shell|Bash → pre-package',
    }
  }
  // grok inherits Claude Code surfaces
  return {
    ...common,
    'loop-discipline-skill': 'Grok inherits Claude skill/hooks (native Claude surface compat)',
    'package-legitimacy': 'Grok inherits Claude PreToolUse pre-package',
  }
}

/** True when every core runtime lists every superiority signal. */
export function multiRuntimeSignalParityComplete(): boolean {
  for (const r of CORE_SUPERIORITY_RUNTIMES) {
    const delivery = runtimeSignalDelivery(r)
    for (const s of SUPERIORITY_SIGNAL_CONTRACTS) {
      if (!delivery[s] || delivery[s].length < 8) return false
    }
  }
  return true
}
