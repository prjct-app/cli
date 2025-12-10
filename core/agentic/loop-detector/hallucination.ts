/**
 * Hallucination Detection
 * ANTI-HALLUCINATION: Patterns that indicate Claude may be hallucinating
 */

import type { HallucinationPattern, HallucinationResult } from './types'

/**
 * ANTI-HALLUCINATION: Patterns that indicate Claude may be hallucinating
 * These patterns detect contradictory or impossible statements
 */
export const HALLUCINATION_PATTERNS: HallucinationPattern[] = [
  // Contradictory file operations
  { pattern: /file.*not found.*created/i, type: 'contradiction', description: 'Claims file created but also not found' },
  { pattern: /created.*but.*error/i, type: 'contradiction', description: 'Claims success but also error' },
  { pattern: /successfully.*failed/i, type: 'contradiction', description: 'Contradictory success/failure' },

  // Impossible task states
  {
    pattern: /already.*completed.*completing/i,
    type: 'state',
    description: 'Completing already-completed task',
  },
  { pattern: /no task.*marking complete/i, type: 'state', description: 'Completing non-existent task' },
  { pattern: /no.*active.*done with/i, type: 'state', description: 'Finishing task that doesnt exist' },

  // Invented data
  {
    pattern: /version.*updated.*no package/i,
    type: 'invented',
    description: 'Version update without package.json',
  },
  { pattern: /committed.*nothing to commit/i, type: 'invented', description: 'Commit without changes' },
  { pattern: /pushed.*no remote/i, type: 'invented', description: 'Push without remote' },
]

/**
 * Get suggestion for handling detected hallucination
 */
export function getHallucinationSuggestion(type: string): string {
  const suggestions: Record<string, string> = {
    contradiction: 'Verify file/resource state before reporting. Use Read tool to check actual state.',
    state: 'Check current task state from now.md before assuming completion.',
    invented: 'Verify prerequisites exist (package.json, git remote) before claiming actions.',
  }
  return suggestions[type] || 'Verify actual state before proceeding.'
}

/**
 * Detect potential hallucination patterns in output
 */
export function detectHallucination(output: string): HallucinationResult {
  if (!output || typeof output !== 'string') {
    return { detected: false }
  }

  for (const { pattern, type, description } of HALLUCINATION_PATTERNS) {
    if (pattern.test(output)) {
      return {
        detected: true,
        type,
        pattern: pattern.source,
        description,
        message: `Potential hallucination detected: ${description}`,
        suggestion: getHallucinationSuggestion(type),
      }
    }
  }

  return { detected: false }
}
