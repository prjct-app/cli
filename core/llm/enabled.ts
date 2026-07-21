/**
 * Opt-in gate for the owned-loop LLM surface (`prjct llm`).
 *
 * Default: OFF. Guest mode (Claude/Grok/Codex/…) is unaffected either way.
 * Enabling only unlocks brain profile config — there is no agent loop yet.
 *
 * Resolution (first match wins):
 *   1. PRJCT_OWNED_LLM=0|false|off  → forced OFF
 *   2. PRJCT_OWNED_LLM=1|true|on    → forced ON
 *   3. global.json `owned-llm` = on|off
 *   4. default OFF
 */

import { getConfig, setConfig } from '../services/global-config'

export const OWNED_LLM_ENV = 'PRJCT_OWNED_LLM'
export const OWNED_LLM_CONFIG_KEY = 'owned-llm'

export function isOwnedLlmEnabled(): boolean {
  const env = process.env[OWNED_LLM_ENV]?.trim().toLowerCase()
  if (env === '0' || env === 'false' || env === 'off') return false
  if (env === '1' || env === 'true' || env === 'on') return true
  return getConfig(OWNED_LLM_CONFIG_KEY) === 'on'
}

/** Persist enable/disable in global.json (machine-local). Env still overrides. */
export function setOwnedLlmEnabled(on: boolean): void {
  setConfig(OWNED_LLM_CONFIG_KEY, on ? 'on' : 'off')
}

export function ownedLlmEnableHint(): string {
  return (
    'Owned LLM is opt-in and OFF by default (no change to guest harnesses).\n' +
    'Enable:  prjct llm enable\n' +
    '   or:   PRJCT_OWNED_LLM=1 prjct llm …\n' +
    'Disable: prjct llm disable'
  )
}
