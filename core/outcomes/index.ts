/**
 * Outcomes Module
 *
 * Records and analyzes execution outcomes for learning.
 *
 * @example
 * ```typescript
 * import { outcomeRecorder, outcomeAnalyzer } from './outcomes'
 *
 * // Record an outcome
 * await outcomeRecorder.record(projectId, {
 *   sessionId: 'session_123',
 *   command: '/p:now',
 *   task: 'implement auth',
 *   startedAt: '2025-12-09T14:00:00Z',
 *   completedAt: '2025-12-09T16:30:00Z',
 *   estimatedDuration: '2h',
 *   actualDuration: '2h 30m',
 *   variance: '+30m',
 *   completedAsPlanned: true,
 *   qualityScore: 4,
 *   agentUsed: 'backend-specialist',
 *   tags: ['auth', 'backend']
 * })
 *
 * // Analyze outcomes
 * const summary = await outcomeAnalyzer.summarize(projectId)
 * const patterns = await outcomeAnalyzer.detectPatterns(projectId)
 * ```
 */

export { OutcomeRecorder, default as outcomeRecorder } from './recorder'
export { OutcomeAnalyzer, default as outcomeAnalyzer } from './analyzer'
export * from '../types'
