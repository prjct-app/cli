/**
 * Agents Module
 *
 * Agent performance tracking and intelligent routing.
 *
 * @example
 * ```typescript
 * import { agentPerformanceTracker } from './agents'
 *
 * // Record task completion
 * await agentPerformanceTracker.recordTask(projectId, {
 *   agentName: 'fe',
 *   taskType: 'frontend',
 *   success: true,
 *   estimatedDuration: '2h',
 *   actualDuration: '1h 45m',
 *   qualityScore: 4,
 *   completedAt: new Date().toISOString()
 * })
 *
 * // Get agent suggestion
 * const suggestion = await agentPerformanceTracker.suggestAgent(projectId, 'frontend')
 * // { agentName: 'fe', confidence: 0.9, reason: 'Best success rate...' }
 * ```
 */

export * from '../types'
export { AgentPerformanceTracker, default as agentPerformanceTracker } from './performance'
