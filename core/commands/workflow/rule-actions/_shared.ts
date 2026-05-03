/**
 * Shared constants + helpers for the workflow rule-action handlers.
 */

export const VALID_RULE_COMMANDS = ['task', 'done', 'ship', 'sync'] as const
export const RULE_POSITIONS = ['before', 'after'] as const
export const MAX_LISTED_MATCHES = 5

export type RulePosition = (typeof RULE_POSITIONS)[number]

/**
 * Common shape for `addRule` calls — every handler passed the same
 * `description: null, enabled: true, sortOrder: 0` defaults plus a
 * fresh ISO timestamp. Centralised so a future schema change touches
 * one site.
 */
export function newRuleDefaults(): {
  description: null
  enabled: true
  sortOrder: 0
  createdAt: string
} {
  return {
    description: null,
    enabled: true,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
  }
}
