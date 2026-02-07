/**
 * Token Budget Coordinator Tests
 *
 * Tests for:
 * - Budget calculation from model context windows
 * - Priority-based allocation (state > injection > files)
 * - Token request/record tracking
 * - Overflow detection and prevention
 * - Different model allocations
 *
 * @see PRJ-266
 */

import { describe, expect, it } from 'bun:test'
import { budgetsFromCoordinator } from '../../agentic/injection-validator'
import {
  calculateInputBudget,
  calculateOutputReserve,
  getContextWindow,
  INPUT_RATIO,
  MODEL_CONTEXT_WINDOWS,
  TokenBudgetCoordinator,
} from '../../agentic/token-budget'

// =============================================================================
// getContextWindow
// =============================================================================

describe('getContextWindow', () => {
  it('should return 200K for Claude models', () => {
    expect(getContextWindow('opus')).toBe(200_000)
    expect(getContextWindow('sonnet')).toBe(200_000)
    expect(getContextWindow('haiku')).toBe(200_000)
  })

  it('should return 1M for Gemini models', () => {
    expect(getContextWindow('2.5-pro')).toBe(1_000_000)
    expect(getContextWindow('2.5-flash')).toBe(1_000_000)
  })

  it('should return default for unknown models', () => {
    expect(getContextWindow('unknown-model')).toBe(MODEL_CONTEXT_WINDOWS.default)
  })

  it('should return default when no model specified', () => {
    expect(getContextWindow()).toBe(MODEL_CONTEXT_WINDOWS.default)
    expect(getContextWindow(undefined)).toBe(MODEL_CONTEXT_WINDOWS.default)
  })

  it('should support full model IDs', () => {
    expect(getContextWindow('claude-opus-4-6')).toBe(200_000)
    expect(getContextWindow('claude-sonnet-4.5')).toBe(200_000)
  })
})

// =============================================================================
// calculateInputBudget / calculateOutputReserve
// =============================================================================

describe('calculateInputBudget', () => {
  it('should return 65% of context window', () => {
    const budget = calculateInputBudget('sonnet')
    expect(budget).toBe(Math.floor(200_000 * INPUT_RATIO))
    expect(budget).toBe(130_000)
  })

  it('should return larger budget for Gemini models', () => {
    const budget = calculateInputBudget('2.5-pro')
    expect(budget).toBe(Math.floor(1_000_000 * INPUT_RATIO))
    expect(budget).toBe(650_000)
  })
})

describe('calculateOutputReserve', () => {
  it('should reserve 35% for output', () => {
    const reserve = calculateOutputReserve('sonnet')
    expect(reserve).toBe(200_000 - 130_000)
    expect(reserve).toBe(70_000)
  })
})

// =============================================================================
// TokenBudgetCoordinator — Allocation
// =============================================================================

describe('TokenBudgetCoordinator allocation', () => {
  it('should create coordinator with default model', () => {
    const coordinator = new TokenBudgetCoordinator()
    const allocation = coordinator.getAllocation()

    expect(allocation.contextWindow).toBe(200_000)
    expect(allocation.inputBudget).toBe(130_000)
    expect(allocation.outputReserve).toBe(70_000)
  })

  it('should distribute budget across three categories', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const allocation = coordinator.getAllocation()

    expect(allocation.state).toBeGreaterThan(0)
    expect(allocation.injection).toBeGreaterThan(0)
    expect(allocation.files).toBeGreaterThan(0)
  })

  it('should allocate all input budget (no waste)', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const allocation = coordinator.getAllocation()

    const totalAllocated = allocation.state + allocation.injection + allocation.files
    expect(totalAllocated).toBe(allocation.inputBudget)
  })

  it('should give files the largest allocation', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const allocation = coordinator.getAllocation()

    expect(allocation.files).toBeGreaterThan(allocation.state)
    expect(allocation.files).toBeGreaterThan(allocation.injection)
  })

  it('should give state minimum 1500 tokens', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const allocation = coordinator.getAllocation()

    expect(allocation.state).toBeGreaterThanOrEqual(1_500)
  })

  it('should give injection minimum 8000 tokens', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const allocation = coordinator.getAllocation()

    expect(allocation.injection).toBeGreaterThanOrEqual(8_000)
  })

  it('should give larger allocations for Gemini models', () => {
    const claudeCoord = new TokenBudgetCoordinator('sonnet')
    const geminiCoord = new TokenBudgetCoordinator('2.5-pro')

    const claudeAlloc = claudeCoord.getAllocation()
    const geminiAlloc = geminiCoord.getAllocation()

    expect(geminiAlloc.files).toBeGreaterThan(claudeAlloc.files)
    expect(geminiAlloc.inputBudget).toBeGreaterThan(claudeAlloc.inputBudget)
  })
})

// =============================================================================
// TokenBudgetCoordinator — Request/Record
// =============================================================================

describe('TokenBudgetCoordinator request/record', () => {
  it('should grant tokens up to allocation', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const stateAlloc = coordinator.getAllocationFor('state')

    const granted = coordinator.request('state', 500)
    expect(granted).toBe(500)

    const usage = coordinator.getUsage('state')
    expect(usage.used).toBe(500)
    expect(usage.remaining).toBe(stateAlloc - 500)
  })

  it('should cap grants at available budget', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const stateAlloc = coordinator.getAllocationFor('state')

    // Request more than allocated
    const granted = coordinator.request('state', stateAlloc + 1000)
    expect(granted).toBe(stateAlloc)
  })

  it('should track cumulative usage', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')

    coordinator.request('state', 500)
    coordinator.request('state', 300)

    const usage = coordinator.getUsage('state')
    expect(usage.used).toBe(800)
  })

  it('should return 0 when budget exhausted', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const stateAlloc = coordinator.getAllocationFor('state')

    coordinator.request('state', stateAlloc)
    const granted = coordinator.request('state', 100)
    expect(granted).toBe(0)
  })

  it('should record usage independently', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')

    coordinator.record('files', 5000)
    const usage = coordinator.getUsage('files')
    expect(usage.used).toBe(5000)
  })

  it('should track total remaining across categories', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const inputBudget = coordinator.inputBudget

    coordinator.request('state', 500)
    coordinator.request('injection', 2000)
    coordinator.request('files', 10000)

    expect(coordinator.totalRemaining).toBe(inputBudget - 500 - 2000 - 10000)
  })
})

// =============================================================================
// TokenBudgetCoordinator — Overflow Detection
// =============================================================================

describe('TokenBudgetCoordinator overflow detection', () => {
  it('should not be over budget initially', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    expect(coordinator.isOverBudget).toBe(false)
  })

  it('should detect overflow when usage exceeds input budget', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const inputBudget = coordinator.inputBudget

    // Force overflow via record (bypasses allocation cap)
    coordinator.record('files', inputBudget + 1)
    expect(coordinator.isOverBudget).toBe(true)
  })

  it('should prevent overflow via request mechanism', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')

    // Exhaust state budget
    const stateAlloc = coordinator.getAllocationFor('state')
    const granted = coordinator.request('state', stateAlloc + 50000)

    // Should only get what was allocated
    expect(granted).toBe(stateAlloc)
    expect(coordinator.isOverBudget).toBe(false)
  })
})

// =============================================================================
// budgetsFromCoordinator integration
// =============================================================================

describe('budgetsFromCoordinator', () => {
  it('should create injection budgets from coordinator', () => {
    const coordinator = new TokenBudgetCoordinator('sonnet')
    const budgets = budgetsFromCoordinator(coordinator)

    expect(budgets.totalPrompt).toBe(coordinator.getAllocationFor('injection'))
    // Per-section budgets remain at defaults
    expect(budgets.autoContext).toBe(500)
    expect(budgets.agentContent).toBe(400)
    expect(budgets.skillContent).toBe(500)
    expect(budgets.stateData).toBe(1000)
    expect(budgets.memories).toBe(600)
  })

  it('should give larger injection budget for Gemini models', () => {
    const claudeBudgets = budgetsFromCoordinator(new TokenBudgetCoordinator('sonnet'))
    const geminiBudgets = budgetsFromCoordinator(new TokenBudgetCoordinator('2.5-pro'))

    expect(geminiBudgets.totalPrompt).toBeGreaterThan(claudeBudgets.totalPrompt)
  })
})

// =============================================================================
// Different models get different allocations
// =============================================================================

describe('model-specific allocations', () => {
  it('should give Gemini 5x the file budget of Claude', () => {
    const claude = new TokenBudgetCoordinator('sonnet')
    const gemini = new TokenBudgetCoordinator('2.5-pro')

    const claudeFiles = claude.getAllocationFor('files')
    const geminiFiles = gemini.getAllocationFor('files')

    // Gemini has 1M context vs Claude 200K = 5x
    expect(geminiFiles / claudeFiles).toBeCloseTo(5, 0)
  })

  it('should maintain 65/35 split across all models', () => {
    for (const model of ['opus', 'sonnet', 'haiku', '2.5-pro', '2.5-flash']) {
      const coordinator = new TokenBudgetCoordinator(model)
      const allocation = coordinator.getAllocation()
      const ratio = allocation.inputBudget / allocation.contextWindow
      expect(ratio).toBeCloseTo(INPUT_RATIO, 2)
    }
  })
})
