/**
 * Token Budget Estimator
 * Estimates token usage and provides context filtering for large projects.
 *
 * This prevents context overflow by:
 * - Estimating token count before sending to Claude
 * - Prioritizing critical context over nice-to-have
 * - Truncating or summarizing when needed
 *
 * @version 1.0.0
 */

export interface TokenEstimate {
  total: number
  breakdown: {
    projectContext: number
    agentContext: number
    skillContext: number
    userPrompt: number
    systemPrompt: number
  }
  withinBudget: boolean
  recommendations: string[]
}

export interface ContextSection {
  name: string
  content: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  tokens: number
}

/**
 * Approximate tokens per character ratio
 * Claude uses ~4 characters per token on average for English text
 * Code tends to be slightly more efficient (~3.5 chars/token)
 */
const CHARS_PER_TOKEN = 3.8

/**
 * Default token budgets by model
 */
const TOKEN_BUDGETS = {
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  'claude-opus-4': 200000,
  default: 100000, // Conservative default
}

/**
 * Estimate tokens from string content
 */
export function estimateTokens(content: string): number {
  if (!content) return 0
  return Math.ceil(content.length / CHARS_PER_TOKEN)
}

/**
 * Get token budget for a model
 */
export function getTokenBudget(model: string = 'default'): number {
  return TOKEN_BUDGETS[model as keyof typeof TOKEN_BUDGETS] || TOKEN_BUDGETS.default
}

/**
 * Estimate total context tokens
 */
export function estimateContext(sections: ContextSection[]): TokenEstimate {
  const breakdown = {
    projectContext: 0,
    agentContext: 0,
    skillContext: 0,
    userPrompt: 0,
    systemPrompt: 0,
  }

  let total = 0

  for (const section of sections) {
    const tokens = estimateTokens(section.content)
    section.tokens = tokens
    total += tokens

    // Categorize for breakdown
    if (section.name.includes('agent')) {
      breakdown.agentContext += tokens
    } else if (section.name.includes('skill')) {
      breakdown.skillContext += tokens
    } else if (section.name.includes('user') || section.name.includes('prompt')) {
      breakdown.userPrompt += tokens
    } else if (section.name.includes('system')) {
      breakdown.systemPrompt += tokens
    } else {
      breakdown.projectContext += tokens
    }
  }

  const budget = getTokenBudget()
  const withinBudget = total < budget * 0.8 // Leave 20% buffer for response

  const recommendations: string[] = []

  if (!withinBudget) {
    recommendations.push(`Context exceeds safe limit (${total} tokens vs ${Math.floor(budget * 0.8)} budget)`)

    // Find sections that can be reduced
    const lowPriority = sections.filter(s => s.priority === 'low')
    if (lowPriority.length > 0) {
      const lowTokens = lowPriority.reduce((sum, s) => sum + s.tokens, 0)
      recommendations.push(`Remove low-priority sections to save ~${lowTokens} tokens`)
    }

    const mediumPriority = sections.filter(s => s.priority === 'medium')
    if (mediumPriority.length > 0) {
      const medTokens = mediumPriority.reduce((sum, s) => sum + s.tokens, 0)
      recommendations.push(`Consider summarizing medium-priority sections (~${medTokens} tokens)`)
    }
  }

  return {
    total,
    breakdown,
    withinBudget,
    recommendations,
  }
}

/**
 * Filter context to fit within budget
 */
export function filterContext(
  sections: ContextSection[],
  maxTokens?: number
): { filtered: ContextSection[]; removed: string[]; totalTokens: number } {
  const budget = maxTokens || getTokenBudget() * 0.8

  // Sort by priority (critical first)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...sections].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  const filtered: ContextSection[] = []
  const removed: string[] = []
  let totalTokens = 0

  for (const section of sorted) {
    const sectionTokens = estimateTokens(section.content)

    if (totalTokens + sectionTokens <= budget) {
      filtered.push({ ...section, tokens: sectionTokens })
      totalTokens += sectionTokens
    } else if (section.priority === 'critical') {
      // Critical sections are always included, even if over budget
      filtered.push({ ...section, tokens: sectionTokens })
      totalTokens += sectionTokens
    } else {
      removed.push(section.name)
    }
  }

  return { filtered, removed, totalTokens }
}

/**
 * Summarize content to reduce tokens
 */
export function summarizeForTokens(content: string, targetTokens: number): string {
  const currentTokens = estimateTokens(content)

  if (currentTokens <= targetTokens) {
    return content
  }

  // Calculate target character count
  const targetChars = targetTokens * CHARS_PER_TOKEN

  // Split into lines and take priority lines
  const lines = content.split('\n')

  // Keep headers and first lines of sections
  const priorityLines: string[] = []
  let charCount = 0

  for (const line of lines) {
    const isHeader = line.startsWith('#') || line.startsWith('**')
    const isImportant = line.includes('CRITICAL') || line.includes('IMPORTANT') || line.includes('TODO')

    if (isHeader || isImportant) {
      priorityLines.push(line)
      charCount += line.length + 1
    } else if (charCount < targetChars * 0.8) {
      priorityLines.push(line)
      charCount += line.length + 1
    }

    if (charCount >= targetChars) {
      break
    }
  }

  if (priorityLines.length < lines.length) {
    priorityLines.push('')
    priorityLines.push(`[... ${lines.length - priorityLines.length} lines truncated for context limit ...]`)
  }

  return priorityLines.join('\n')
}

/**
 * Create context sections from project state
 */
export function createContextSections(
  projectContext: string,
  agentContext: string,
  skillContext: string,
  userPrompt: string
): ContextSection[] {
  return [
    { name: 'user-prompt', content: userPrompt, priority: 'critical', tokens: 0 },
    { name: 'agent-context', content: agentContext, priority: 'high', tokens: 0 },
    { name: 'project-context', content: projectContext, priority: 'medium', tokens: 0 },
    { name: 'skill-context', content: skillContext, priority: 'medium', tokens: 0 },
  ]
}

/**
 * Format token estimate for display
 */
export function formatEstimate(estimate: TokenEstimate): string {
  const lines = [
    '📊 Token Budget',
    '',
    `Total: ${estimate.total.toLocaleString()} tokens`,
    '',
    'Breakdown:',
    `  Project: ${estimate.breakdown.projectContext.toLocaleString()}`,
    `  Agents: ${estimate.breakdown.agentContext.toLocaleString()}`,
    `  Skills: ${estimate.breakdown.skillContext.toLocaleString()}`,
    `  Prompt: ${estimate.breakdown.userPrompt.toLocaleString()}`,
    '',
    `Status: ${estimate.withinBudget ? '✅ Within budget' : '⚠️ Over budget'}`,
  ]

  if (estimate.recommendations.length > 0) {
    lines.push('')
    lines.push('Recommendations:')
    for (const rec of estimate.recommendations) {
      lines.push(`  - ${rec}`)
    }
  }

  return lines.join('\n')
}

export default {
  estimateTokens,
  getTokenBudget,
  estimateContext,
  filterContext,
  summarizeForTokens,
  createContextSections,
  formatEstimate,
}
