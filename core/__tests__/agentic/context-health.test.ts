/**
 * Context Health Monitor Tests
 *
 * Tests zone calculation, transitions, and compaction/isolation recommendations.
 */

import { describe, expect, it } from 'bun:test'
import { ContextHealthMonitor } from '../../agentic/context-health'
import { TokenBudgetCoordinator } from '../../agentic/token-budget'

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a coordinator and consume a specific percentage of the input budget.
 */
function createWithUsage(usagePercent: number): {
  coordinator: TokenBudgetCoordinator
  monitor: ContextHealthMonitor
} {
  const coordinator = new TokenBudgetCoordinator('opus')
  const tokensToUse = Math.floor(coordinator.inputBudget * (usagePercent / 100))

  // Consume tokens across categories to reach the target usage
  // Use 'files' category since it has the largest allocation
  coordinator.record('files', tokensToUse)

  const monitor = new ContextHealthMonitor(coordinator)
  return { coordinator, monitor }
}

// =============================================================================
// Zone Calculation
// =============================================================================

describe('ContextHealthMonitor — Zone Calculation', () => {
  it('should be in smart zone at 0% usage', () => {
    const { monitor } = createWithUsage(0)
    expect(monitor.getZone()).toBe('smart')
  })

  it('should be in smart zone at 39% usage', () => {
    const { monitor } = createWithUsage(39)
    expect(monitor.getZone()).toBe('smart')
  })

  it('should be in warning zone at 41% usage', () => {
    const { monitor } = createWithUsage(41)
    expect(monitor.getZone()).toBe('warning')
  })

  it('should be in warning zone at 59% usage', () => {
    const { monitor } = createWithUsage(59)
    expect(monitor.getZone()).toBe('warning')
  })

  it('should be in dumb zone at 61% usage', () => {
    const { monitor } = createWithUsage(61)
    expect(monitor.getZone()).toBe('dumb')
  })

  it('should be in dumb zone at 90% usage', () => {
    const { monitor } = createWithUsage(90)
    expect(monitor.getZone()).toBe('dumb')
  })
})

// =============================================================================
// Status
// =============================================================================

describe('ContextHealthMonitor — Status', () => {
  it('should return full status with zone and usage', () => {
    const { monitor, coordinator } = createWithUsage(45)
    const status = monitor.getStatus()

    expect(status.zone).toBe('warning')
    expect(status.usagePercent).toBeGreaterThan(40)
    expect(status.usagePercent).toBeLessThan(50)
    expect(status.budgetTokens).toBe(coordinator.inputBudget)
    expect(status.usedTokens).toBeGreaterThan(0)
    expect(status.recommendation).toContain('sub-agents')
  })

  it('should have no recommendation in smart zone', () => {
    const { monitor } = createWithUsage(20)
    const status = monitor.getStatus()

    expect(status.zone).toBe('smart')
    expect(status.recommendation).toBeNull()
  })

  it('should recommend compaction in dumb zone', () => {
    const { monitor } = createWithUsage(65)
    const status = monitor.getStatus()

    expect(status.zone).toBe('dumb')
    expect(status.recommendation).toContain('Compact now')
  })
})

// =============================================================================
// Zone Transitions
// =============================================================================

describe('ContextHealthMonitor — Zone Transitions', () => {
  it('should detect smart → warning transition', () => {
    const coordinator = new TokenBudgetCoordinator('opus')
    const monitor = new ContextHealthMonitor(coordinator)

    // Start in smart zone
    expect(monitor.checkTransition()).toBeNull()

    // Push into warning zone
    const tokensToWarning = Math.floor(coordinator.inputBudget * 0.45)
    coordinator.record('files', tokensToWarning)

    const transition = monitor.checkTransition()
    expect(transition).not.toBeNull()
    expect(transition!.from).toBe('smart')
    expect(transition!.to).toBe('warning')
    expect(transition!.action).toBe('compact_recommended')
  })

  it('should detect warning → dumb transition', () => {
    const coordinator = new TokenBudgetCoordinator('opus')
    // Pre-consume to be in warning zone
    coordinator.record('files', Math.floor(coordinator.inputBudget * 0.45))
    const monitor = new ContextHealthMonitor(coordinator)

    // Force initial zone detection
    monitor.checkTransition() // sets _lastZone to warning from smart initial

    // Push into dumb zone
    coordinator.record('files', Math.floor(coordinator.inputBudget * 0.2))

    const transition = monitor.checkTransition()
    expect(transition).not.toBeNull()
    expect(transition!.from).toBe('warning')
    expect(transition!.to).toBe('dumb')
    expect(transition!.action).toBe('compact_required')
  })

  it('should return null when zone does not change', () => {
    const coordinator = new TokenBudgetCoordinator('opus')
    const monitor = new ContextHealthMonitor(coordinator)

    expect(monitor.checkTransition()).toBeNull()
    expect(monitor.checkTransition()).toBeNull()
  })

  it('should track all transitions', () => {
    const coordinator = new TokenBudgetCoordinator('opus')
    const monitor = new ContextHealthMonitor(coordinator)

    // Smart → Warning
    coordinator.record('files', Math.floor(coordinator.inputBudget * 0.45))
    monitor.checkTransition()

    // Warning → Dumb
    coordinator.record('files', Math.floor(coordinator.inputBudget * 0.2))
    monitor.checkTransition()

    const transitions = monitor.getTransitions()
    expect(transitions).toHaveLength(2)
    expect(transitions[0].from).toBe('smart')
    expect(transitions[0].to).toBe('warning')
    expect(transitions[1].from).toBe('warning')
    expect(transitions[1].to).toBe('dumb')
  })
})

// =============================================================================
// Compaction & Isolation
// =============================================================================

describe('ContextHealthMonitor — Compaction & Isolation', () => {
  it('should not recommend compaction in smart zone', () => {
    const { monitor } = createWithUsage(20)
    expect(monitor.shouldCompact()).toBe(false)
  })

  it('should recommend compaction in warning zone', () => {
    const { monitor } = createWithUsage(45)
    expect(monitor.shouldCompact()).toBe(true)
  })

  it('should recommend compaction in dumb zone', () => {
    const { monitor } = createWithUsage(70)
    expect(monitor.shouldCompact()).toBe(true)
  })

  it('should not recommend isolation in smart zone', () => {
    const { monitor } = createWithUsage(20)
    expect(monitor.shouldIsolate()).toBe(false)
  })

  it('should recommend isolation in warning zone', () => {
    const { monitor } = createWithUsage(45)
    expect(monitor.shouldIsolate()).toBe(true)
  })

  it('should recommend isolation in dumb zone', () => {
    const { monitor } = createWithUsage(70)
    expect(monitor.shouldIsolate()).toBe(true)
  })
})

// =============================================================================
// Metrics
// =============================================================================

describe('ContextHealthMonitor — Metrics', () => {
  it('should track compaction events', () => {
    const { monitor } = createWithUsage(0)

    expect(monitor.compactionCount).toBe(0)
    monitor.recordCompaction()
    monitor.recordCompaction()
    expect(monitor.compactionCount).toBe(2)
  })

  it('should track sub-agent spawns', () => {
    const { monitor } = createWithUsage(0)

    expect(monitor.subAgentSpawnCount).toBe(0)
    monitor.recordSubAgentSpawn()
    expect(monitor.subAgentSpawnCount).toBe(1)
  })
})
