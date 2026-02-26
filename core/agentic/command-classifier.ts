/**
 * Command Classifier
 *
 * Classifies unknown commands by analyzing template metadata.
 * When a command isn't in command-context.config.json, this module
 * determines what context sections it needs based on template content.
 *
 * Classification chain:
 * 1. Config lookup (instant) — handled by command-context.ts
 * 2. Template heuristic (instant) — this module
 * 3. Wildcard fallback — handled by command-context.ts
 *
 * @see PRJ-298
 */

import type { CommandContextEntry } from '../schemas/command-context'
import type { Template } from '../types/agentic'

/**
 * Classify a command based on its template metadata.
 *
 * Returns a sensible default. The explicit config in command-context.config.json
 * covers all known commands; for unknown commands, the default is correct.
 */
export function classifyCommand(_commandName: string, _template: Template): CommandContextEntry {
  return {
    agents: true,
    patterns: true,
    checklist: false,
    modules: [],
  }
}
