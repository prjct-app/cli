/**
 * Intent detection + small parse helpers for `prjct workflow <args>`.
 *
 * Alpha.10 removed the bilingual NL patterns; today every intent is a
 * single English keyword. The dispatcher in `workflow.ts` reads the
 * resulting `WorkflowIntent` and routes to one of the handlers in
 * `./rule-actions.ts`.
 */

import type { WorkflowRule } from '../../types/storage.js'

export type IntentType =
  | 'view'
  | 'add'
  | 'remove'
  | 'disable'
  | 'gate'
  | 'instruction'
  | 'help'
  | 'reset'
  | 'init'
  | 'create'
  | 'list'
  | 'delete'
  | 'run'

export interface WorkflowIntent {
  type: IntentType
  /** The remaining args after the intent keyword was consumed */
  args: string
  /** Confidence: 'exact' for keyword matches, 'fuzzy' for NL patterns */
  confidence: 'exact' | 'fuzzy'
}

const INTENT_PATTERNS: Array<{ type: IntentType; patterns: RegExp }> = [
  { type: 'help', patterns: /^help\b/i },
  { type: 'add', patterns: /^add\b/i },
  { type: 'gate', patterns: /^gate\b/i },
  { type: 'instruction', patterns: /^instruction\b/i },
  { type: 'remove', patterns: /^rm\b/i },
  { type: 'reset', patterns: /^reset\b/i },
  { type: 'init', patterns: /^init\b/i },
  { type: 'create', patterns: /^(?:create|new)\b/i },
  { type: 'list', patterns: /^list\b/i },
  { type: 'delete', patterns: /^delete\b/i },
  { type: 'run', patterns: /^run\b/i },
  { type: 'disable', patterns: /^disable\b/i },
  { type: 'view', patterns: /^(?:show|view)\b/i },
]

export function detectIntent(input: string): WorkflowIntent {
  const trimmed = input.trim()

  for (const { type, patterns } of INTENT_PATTERNS) {
    const match = trimmed.match(patterns)
    if (match) {
      const consumed = match[0]
      const args = trimmed.slice(consumed.length).trim()
      return { type, args, confidence: 'exact' }
    }
  }

  // No keyword matched — treat as view (lists current rules) rather
  // than silently misinterpreting. `prjct workflow help` is always
  // available for discovery.
  return { type: 'view', args: trimmed, confidence: 'exact' }
}

/**
 * Parse a quoted or unquoted action string from input.
 * Returns [action, rest] where rest is the remaining unparsed input.
 */
export function parseAction(input: string): [string, string] {
  const trimmed = input.trim()
  if (trimmed.startsWith('"')) {
    const endQuote = trimmed.indexOf('"', 1)
    if (endQuote === -1) return [trimmed.slice(1), '']
    return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
  }
  if (trimmed.startsWith("'")) {
    const endQuote = trimmed.indexOf("'", 1)
    if (endQuote === -1) return [trimmed.slice(1), '']
    return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
  }
  // Unquoted: take everything up to 'before' or 'after' keyword
  const match = trimmed.match(/^(.+?)\s+(before|after)\s+/i)
  if (match) return [match[1].trim(), trimmed.slice(match[1].length).trim()]
  return [trimmed, '']
}

/**
 * Search rules by action, description, command, or numeric id.
 * Returns rules whose fields contain the query (case-insensitive).
 */
export function searchRules(rules: WorkflowRule[], query: string): WorkflowRule[] {
  const lower = query.toLowerCase()
  return rules.filter((r) => {
    return (
      r.action.toLowerCase().includes(lower) ||
      (r.description?.toLowerCase().includes(lower) ?? false) ||
      r.command.toLowerCase().includes(lower) ||
      String(r.id) === lower
    )
  })
}
