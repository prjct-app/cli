/**
 * Injection Validator
 *
 * Validates data before auto-injection into LLM prompts.
 * Corrupted or oversized data gets safe fallbacks instead of broken context.
 *
 * @module agentic/injection-validator
 */

import type { z } from 'zod'
import type { TokenBudgetCoordinator } from './token-budget'

// =============================================================================
// Token Budget Configuration
// =============================================================================

import type { InjectionBudgets } from '../types/agentic.js'

/** Default budgets (in estimated tokens, ~4 chars per token) */
export const DEFAULT_BUDGETS: InjectionBudgets = {
  autoContext: 500,
  stateData: 1000,
  memories: 600,
  totalPrompt: 8000,
}

/**
 * Create injection budgets from a TokenBudgetCoordinator.
 * Uses the coordinator's injection allocation as the totalPrompt ceiling,
 * keeping per-section budgets at their defaults.
 *
 * @see PRJ-266
 */
export function budgetsFromCoordinator(coordinator: TokenBudgetCoordinator): InjectionBudgets {
  const injectionBudget = coordinator.getAllocationFor('injection')
  return {
    ...DEFAULT_BUDGETS,
    totalPrompt: injectionBudget,
  }
}

import { CHARS_PER_TOKEN } from '../constants/token'

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
