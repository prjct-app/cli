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

// Keywords that indicate code-modifying commands
const CODE_KEYWORDS = [
  'build',
  'create',
  'add',
  'implement',
  'fix',
  'refactor',
  'update',
  'modify',
  'change',
  'write',
  'generate',
  'scaffold',
  'migrate',
  'optimize',
  'improve',
  'enhance',
  'redesign',
  'rewrite',
]

// Keywords that indicate read-only / info commands
const INFO_KEYWORDS = [
  'list',
  'show',
  'get',
  'status',
  'info',
  'check',
  'view',
  'display',
  'describe',
  'explain',
  'analyze',
  'report',
  'dashboard',
]

// Keywords that indicate quality/verification commands
const QUALITY_KEYWORDS = [
  'test',
  'verify',
  'validate',
  'review',
  'audit',
  'check',
  'lint',
  'ship',
  'deploy',
  'release',
  'complete',
  'done',
  'finish',
]

// Tools that indicate code modification
const CODE_TOOLS = ['Write', 'Edit', 'Bash']

/**
 * Count keyword matches using word boundaries to avoid substring false positives.
 */
function countMatches(text: string, keywords: string[]): number {
  return keywords.filter((k) => new RegExp(`\\b${k}\\b`).test(text)).length
}

/**
 * Classify a command based on its template metadata.
 * Analyzes the command name, description, allowed tools, and content
 * to determine what context sections are relevant.
 *
 * Priority: code-modifying > quality/verification > info/read-only > default
 */
export function classifyCommand(commandName: string, template: Template): CommandContextEntry {
  const description = (template.frontmatter?.description || '').toLowerCase()
  const content = template.content.toLowerCase()
  const allowedTools = template.frontmatter?.['allowed-tools'] || []
  const combined = `${commandName} ${description} ${content}`

  const codeScore = countMatches(combined, CODE_KEYWORDS)
  const infoScore = countMatches(combined, INFO_KEYWORDS)
  const qualityScore = countMatches(combined, QUALITY_KEYWORDS)
  const hasCodeTools = allowedTools.some((t: string) => CODE_TOOLS.includes(t))

  // Code-modifying command: needs agents + patterns + checklists
  if (hasCodeTools && codeScore > 0) {
    return {
      agents: true,
      patterns: true,
      checklist: qualityScore > 0,
      modules: [],
    }
  }

  // Quality/verification command: needs patterns + checklists
  // Quality takes priority over info when quality score is higher
  if (qualityScore > 0 && qualityScore >= infoScore) {
    return {
      agents: false,
      patterns: true,
      checklist: true,
      modules: [],
    }
  }

  // Info/read-only command: needs nothing
  if (infoScore > 0 && codeScore === 0) {
    return {
      agents: false,
      patterns: false,
      checklist: false,
      modules: [],
    }
  }

  // Default for unknown: agents + patterns (sensible default)
  return {
    agents: true,
    patterns: true,
    checklist: false,
    modules: [],
  }
}
