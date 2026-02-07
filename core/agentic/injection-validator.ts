/**
 * Injection Validator
 *
 * Validates data before auto-injection into LLM prompts.
 * Corrupted or oversized data gets safe fallbacks instead of broken context.
 *
 * @module agentic/injection-validator
 */

import type { z } from 'zod'

// =============================================================================
// Token Budget Configuration
// =============================================================================

/** Configurable token budgets per injection section */
export interface InjectionBudgets {
  /** Auto-injected context (task + queue + patterns) */
  autoContext: number
  /** Per-agent content in orchestrator */
  agentContent: number
  /** Per-skill content in orchestrator */
  skillContent: number
  /** State data section */
  stateData: number
  /** Memories section */
  memories: number
  /** Total prompt ceiling (all sections combined) */
  totalPrompt: number
}

/** Default budgets (in estimated tokens, ~4 chars per token) */
export const DEFAULT_BUDGETS: InjectionBudgets = {
  autoContext: 500,
  agentContent: 400,
  skillContent: 500,
  stateData: 1000,
  memories: 600,
  totalPrompt: 8000,
}

// Approximate chars-per-token ratio
const CHARS_PER_TOKEN = 4

// =============================================================================
// Safe Injection
// =============================================================================

/**
 * Validate data against a Zod schema before injection.
 * Returns validated data on success, or the fallback on failure.
 */
export function safeInject<T>(data: unknown, schema: z.ZodType<T>, fallback: T): T {
  const result = schema.safeParse(data)
  if (result.success) {
    return result.data
  }
  return fallback
}

/**
 * Validate and stringify data for prompt injection.
 * Returns formatted string on success, or fallback string on failure.
 */
export function safeInjectString<T>(
  data: unknown,
  schema: z.ZodType<T>,
  formatter: (valid: T) => string,
  fallbackString: string
): string {
  const result = schema.safeParse(data)
  if (result.success) {
    return formatter(result.data)
  }
  return fallbackString
}

// =============================================================================
// Token-Aware Truncation
// =============================================================================

/**
 * Truncate text to fit within a token budget.
 * Uses char-based estimation (~4 chars/token).
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  return `${text.substring(0, maxChars)}\n... (truncated to ~${maxTokens} tokens)`
}

/**
 * Estimate token count for a string.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

// =============================================================================
// Skill Filtering
// =============================================================================

/** Domain keywords for matching skills to task domains */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['react', 'vue', 'svelte', 'css', 'html', 'ui', 'component', 'frontend', 'web', 'dom'],
  backend: ['api', 'server', 'backend', 'endpoint', 'route', 'middleware', 'database', 'sql'],
  testing: ['test', 'spec', 'jest', 'vitest', 'cypress', 'playwright', 'coverage', 'assert'],
  devops: ['docker', 'ci', 'cd', 'deploy', 'kubernetes', 'terraform', 'pipeline', 'github-actions'],
  docs: ['documentation', 'readme', 'guide', 'tutorial', 'markdown'],
  design: ['design', 'ux', 'ui', 'figma', 'wireframe', 'layout', 'accessibility'],
}

/**
 * Filter skills by relevance to detected task domains.
 * Returns only skills whose content matches the task's domains.
 */
export function filterSkillsByDomains(
  skills: { name: string; content: string }[],
  detectedDomains: string[]
): { name: string; content: string }[] {
  if (detectedDomains.length === 0 || skills.length === 0) return skills

  // Build keyword set from detected domains
  const relevantKeywords = new Set<string>()
  for (const domain of detectedDomains) {
    const keywords = DOMAIN_KEYWORDS[domain.toLowerCase()]
    if (keywords) {
      for (const kw of keywords) relevantKeywords.add(kw)
    }
    // Also add the domain name itself
    relevantKeywords.add(domain.toLowerCase())
  }

  return skills.filter((skill) => {
    const text = `${skill.name} ${skill.content}`.toLowerCase()
    // Keep skill if any relevant keyword appears in its name or content
    for (const kw of relevantKeywords) {
      if (text.includes(kw)) return true
    }
    return false
  })
}

// =============================================================================
// Section Budget Tracker
// =============================================================================

/**
 * Tracks cumulative token usage across injection sections.
 * Allows checking remaining budget before adding more content.
 */
export class InjectionBudgetTracker {
  private used = 0
  private budgets: InjectionBudgets

  constructor(budgets: Partial<InjectionBudgets> = {}) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets }
  }

  /** Add content and return it (possibly truncated to fit budget) */
  addSection(content: string, sectionBudget: number): string {
    const truncated = truncateToTokenBudget(content, sectionBudget)
    const tokens = estimateTokens(truncated)

    // Check total budget
    if (this.used + tokens > this.budgets.totalPrompt) {
      const remaining = this.budgets.totalPrompt - this.used
      if (remaining <= 0) return ''
      const fitted = truncateToTokenBudget(truncated, remaining)
      this.used += estimateTokens(fitted)
      return fitted
    }

    this.used += tokens
    return truncated
  }

  /** Get remaining token budget */
  get remaining(): number {
    return Math.max(0, this.budgets.totalPrompt - this.used)
  }

  /** Get total tokens used */
  get totalUsed(): number {
    return this.used
  }

  /** Get the budgets config */
  get config(): InjectionBudgets {
    return this.budgets
  }
}
