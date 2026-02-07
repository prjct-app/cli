/**
 * Token Budget Coordinator
 *
 * Centrally manages the global token budget across all context-loading components.
 * Ensures the combined prompt stays within the model's context window
 * and reserves space for the output.
 *
 * Budget formula: inputBudget = modelContextWindow * 0.65
 * Priority: state (P1) > injection context (P2) > file content (P3)
 *
 * @see PRJ-266
 */

// =============================================================================
// Model Context Windows
// =============================================================================

/** Context window sizes by model identifier (in tokens) */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Claude models (short names from model.ts)
  opus: 200_000,
  sonnet: 200_000,
  haiku: 200_000,
  // Gemini models
  '2.5-pro': 1_000_000,
  '2.5-flash': 1_000_000,
  '2.0-flash': 1_000_000,
  // Full model IDs (for direct API usage)
  'claude-opus-4.5': 200_000,
  'claude-sonnet-4.5': 200_000,
  'claude-haiku-4.5': 200_000,
  'claude-opus-4-6': 200_000,
  // Default fallback
  default: 200_000,
}

/** Ratio of context window reserved for input (rest for output) */
export const INPUT_RATIO = 0.65

// =============================================================================
// Budget Categories
// =============================================================================

/** Budget category identifiers ordered by priority */
export type BudgetCategory = 'state' | 'injection' | 'files'

/** Budget allocation result for each category */
export interface BudgetAllocation {
  state: number
  injection: number
  files: number
  inputBudget: number
  outputReserve: number
  contextWindow: number
}

/** Usage tracking per category */
export interface BudgetUsage {
  category: BudgetCategory
  allocated: number
  used: number
  remaining: number
}

// =============================================================================
// Default Allocation Ratios (within input budget)
// =============================================================================

interface AllocationConfig {
  ratio: number
  minimum: number
}

const ALLOCATION_CONFIG: Record<BudgetCategory, AllocationConfig> = {
  /** P1: State — current task, queue, patterns (highest priority) */
  state: { ratio: 0.02, minimum: 1_500 },
  /** P2: Injection — agents, skills, modules, checklists */
  injection: { ratio: 0.08, minimum: 8_000 },
  /** P3: Files — codebase file content (lowest priority, gets remainder) */
  files: { ratio: 0.9, minimum: 20_000 },
}

/** Priority order for budget distribution */
const PRIORITY_ORDER: BudgetCategory[] = ['state', 'injection', 'files']

// =============================================================================
// TokenBudgetCoordinator
// =============================================================================

export class TokenBudgetCoordinator {
  private readonly _contextWindow: number
  private readonly _inputBudget: number
  private readonly _outputReserve: number
  private readonly _allocations: Map<BudgetCategory, number> = new Map()
  private readonly _used: Map<BudgetCategory, number> = new Map()

  constructor(model?: string) {
    this._contextWindow = getContextWindow(model)
    this._inputBudget = Math.floor(this._contextWindow * INPUT_RATIO)
    this._outputReserve = this._contextWindow - this._inputBudget
    this.distributeBudget()
  }

  /** Distribute input budget across categories by priority */
  private distributeBudget(): void {
    let remaining = this._inputBudget

    for (const category of PRIORITY_ORDER) {
      const config = ALLOCATION_CONFIG[category]

      if (category === 'files') {
        // Lowest priority gets whatever remains
        this._allocations.set(category, Math.max(remaining, 0))
      } else {
        const allocation = Math.max(config.minimum, Math.floor(this._inputBudget * config.ratio))
        const granted = Math.min(allocation, remaining)
        this._allocations.set(category, granted)
        remaining -= granted
      }

      this._used.set(category, 0)
    }
  }

  /** Get the full budget allocation */
  getAllocation(): BudgetAllocation {
    return {
      state: this._allocations.get('state') ?? 0,
      injection: this._allocations.get('injection') ?? 0,
      files: this._allocations.get('files') ?? 0,
      inputBudget: this._inputBudget,
      outputReserve: this._outputReserve,
      contextWindow: this._contextWindow,
    }
  }

  /**
   * Request tokens from a category.
   * Returns actual tokens granted (may be less than requested if budget is exhausted).
   */
  request(category: BudgetCategory, requestedTokens: number): number {
    const allocated = this._allocations.get(category) ?? 0
    const currentUsed = this._used.get(category) ?? 0
    const available = Math.max(0, allocated - currentUsed)
    const granted = Math.min(requestedTokens, available)
    this._used.set(category, currentUsed + granted)
    return granted
  }

  /** Record token usage for a category */
  record(category: BudgetCategory, tokensUsed: number): void {
    const current = this._used.get(category) ?? 0
    this._used.set(category, current + tokensUsed)
  }

  /** Get usage details for a category */
  getUsage(category: BudgetCategory): BudgetUsage {
    const allocated = this._allocations.get(category) ?? 0
    const used = this._used.get(category) ?? 0
    return {
      category,
      allocated,
      used,
      remaining: Math.max(0, allocated - used),
    }
  }

  /** Get allocation for a specific category */
  getAllocationFor(category: BudgetCategory): number {
    return this._allocations.get(category) ?? 0
  }

  /** Get total remaining input budget across all categories */
  get totalRemaining(): number {
    let totalUsed = 0
    for (const v of this._used.values()) {
      totalUsed += v
    }
    return Math.max(0, this._inputBudget - totalUsed)
  }

  /** Check if total usage exceeds input budget */
  get isOverBudget(): boolean {
    let totalUsed = 0
    for (const v of this._used.values()) {
      totalUsed += v
    }
    return totalUsed > this._inputBudget
  }

  /** Context window size */
  get contextWindow(): number {
    return this._contextWindow
  }

  /** Total input budget */
  get inputBudget(): number {
    return this._inputBudget
  }

  /** Output token reserve */
  get outputReserve(): number {
    return this._outputReserve
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Get context window size for a model identifier */
export function getContextWindow(model?: string): number {
  if (!model) return MODEL_CONTEXT_WINDOWS.default
  return MODEL_CONTEXT_WINDOWS[model] ?? MODEL_CONTEXT_WINDOWS.default
}

/** Calculate input budget for a model */
export function calculateInputBudget(model?: string): number {
  return Math.floor(getContextWindow(model) * INPUT_RATIO)
}

/** Calculate output reserve for a model */
export function calculateOutputReserve(model?: string): number {
  const contextWindow = getContextWindow(model)
  return contextWindow - Math.floor(contextWindow * INPUT_RATIO)
}
