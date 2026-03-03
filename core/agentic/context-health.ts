/**
 * Context Health Monitor
 *
 * Wraps TokenBudgetCoordinator with zone awareness based on
 * Dex Horthy's context management research. Monitors usage as a
 * percentage of inputBudget and classifies into zones:
 *
 * - Smart (0-40%): Quality output, full exploration
 * - Warning (40-60%): Degrading quality, use sub-agents
 * - Dumb (60%+): Severe degradation, compact immediately
 *
 * All percentages are relative to inputBudget (not full context window).
 *
 * @module agentic/context-health
 */

import type { ContextHealthStatus, ContextZone, ZoneTransition } from '../types/agentic'
import { getTimestamp } from '../utils/date-helper'
import type { TokenBudgetCoordinator } from './token-budget'

// =============================================================================
// Zone Thresholds
// =============================================================================

/** Percentage thresholds for zone transitions (relative to inputBudget) */
const ZONE_THRESHOLDS = {
  smart: 40,
  warning: 60,
} as const

// =============================================================================
// Recommendations
// =============================================================================

const ZONE_RECOMMENDATIONS: Record<ContextZone, string | null> = {
  smart: null,
  warning:
    'Context usage elevated. Use sub-agents for exploration. Consider compacting conversation.',
  dumb: 'Context critically high. STOP expanding context. Work only with referenced files. Compact now.',
}

// =============================================================================
// ContextHealthMonitor
// =============================================================================

export class ContextHealthMonitor {
  private readonly _coordinator: TokenBudgetCoordinator
  private _lastZone: ContextZone = 'smart'
  private _transitions: ZoneTransition[] = []
  private _compactionCount = 0
  private _subAgentSpawnCount = 0

  constructor(coordinator: TokenBudgetCoordinator) {
    this._coordinator = coordinator
  }

  /** Calculate current usage percentage relative to inputBudget */
  private getUsagePercent(): number {
    const budget = this._coordinator.inputBudget
    if (budget === 0) return 0
    const used = budget - this._coordinator.totalRemaining
    return (used / budget) * 100
  }

  /** Derive zone from usage percentage */
  private deriveZone(usagePercent: number): ContextZone {
    if (usagePercent >= ZONE_THRESHOLDS.warning) return 'dumb'
    if (usagePercent >= ZONE_THRESHOLDS.smart) return 'warning'
    return 'smart'
  }

  /** Get current context health status */
  getStatus(): ContextHealthStatus {
    const budget = this._coordinator.inputBudget
    const usagePercent = this.getUsagePercent()
    const zone = this.deriveZone(usagePercent)
    const used = budget - this._coordinator.totalRemaining

    return {
      zone,
      usagePercent: Math.round(usagePercent * 10) / 10,
      usedTokens: used,
      budgetTokens: budget,
      recommendation: ZONE_RECOMMENDATIONS[zone],
    }
  }

  /** Quick zone check */
  getZone(): ContextZone {
    return this.deriveZone(this.getUsagePercent())
  }

  /** Detect zone changes since last check, returns transition or null */
  checkTransition(): ZoneTransition | null {
    const usagePercent = this.getUsagePercent()
    const currentZone = this.deriveZone(usagePercent)

    if (currentZone === this._lastZone) return null

    const transition: ZoneTransition = {
      from: this._lastZone,
      to: currentZone,
      usagePercent: Math.round(usagePercent * 10) / 10,
      timestamp: getTimestamp(),
      action: this.getTransitionAction(currentZone),
    }

    this._transitions.push(transition)
    this._lastZone = currentZone

    return transition
  }

  /** Returns true when context should be compacted (entering warning zone) */
  shouldCompact(): boolean {
    const zone = this.getZone()
    return zone !== 'smart'
  }

  /** Returns true when sub-agents should be used for isolation */
  shouldIsolate(): boolean {
    const zone = this.getZone()
    return zone === 'warning' || zone === 'dumb'
  }

  /** Get all recorded transitions */
  getTransitions(): ZoneTransition[] {
    return [...this._transitions]
  }

  /** Record a compaction event */
  recordCompaction(): void {
    this._compactionCount++
  }

  /** Record a sub-agent spawn */
  recordSubAgentSpawn(): void {
    this._subAgentSpawnCount++
  }

  /** Get compaction count */
  get compactionCount(): number {
    return this._compactionCount
  }

  /** Get sub-agent spawn count */
  get subAgentSpawnCount(): number {
    return this._subAgentSpawnCount
  }

  /** Suggested action for a zone transition */
  private getTransitionAction(toZone: ContextZone): string | null {
    switch (toZone) {
      case 'warning':
        return 'compact_recommended'
      case 'dumb':
        return 'compact_required'
      default:
        return null
    }
  }
}
