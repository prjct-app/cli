/**
 * Outcome Intelligence Tools Tests
 *
 * Tests outcomes_recent, estimate_accuracy, and velocity_detail backends.
 */

import { describe, expect, it } from 'bun:test'
import { calculateVelocity, projectCompletion } from '../../domain/velocity'
import { DEFAULT_VELOCITY_CONFIG } from '../../schemas/velocity'
import type { Outcome } from '../../types/outcomes'

const makeOutcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: `test-${Date.now()}-${Math.random()}`,
  task: 'Test task',
  command: 'done',
  startedAt: new Date(Date.now() - 3600000).toISOString(),
  completedAt: new Date().toISOString(),
  estimatedDuration: '1h',
  actualDuration: '1h',
  variance: '+0m',
  completedAsPlanned: true,
  qualityScore: 8,
  ...overrides,
})

describe('MCP Outcome Intelligence Tools (backend)', () => {
  describe('prjct_outcomes_recent (via getRecent)', () => {
    it('should return outcomes in chronological order', () => {
      const outcomes = [
        makeOutcome({ task: 'First', completedAt: '2024-01-01T00:00:00Z' }),
        makeOutcome({ task: 'Second', completedAt: '2024-01-02T00:00:00Z' }),
        makeOutcome({ task: 'Third', completedAt: '2024-01-03T00:00:00Z' }),
      ]

      // Simulate getRecent: slice last N
      const recent = outcomes.slice(-2)
      expect(recent.length).toBe(2)
      expect(recent[0].task).toBe('Second')
      expect(recent[1].task).toBe('Third')
    })

    it('should filter by command', () => {
      const outcomes = [
        makeOutcome({ command: 'done', task: 'Done task' }),
        makeOutcome({ command: 'ship', task: 'Ship task' }),
        makeOutcome({ command: 'done', task: 'Another done' }),
      ]

      const filtered = outcomes.filter((o) => o.command === 'done')
      expect(filtered.length).toBe(2)
    })
  })

  describe('prjct_estimate_accuracy', () => {
    it('should calculate accuracy from outcomes with variance', () => {
      const outcomes = [
        makeOutcome({ estimatedDuration: '1h', actualDuration: '1h', variance: '+0m' }),
        makeOutcome({ estimatedDuration: '1h', actualDuration: '1h 10m', variance: '+10m' }),
        makeOutcome({ estimatedDuration: '1h', actualDuration: '2h', variance: '+60m' }),
      ]

      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)
      expect(typeof metrics.estimationAccuracy).toBe('number')
      expect(metrics.estimationAccuracy).toBeGreaterThanOrEqual(0)
      expect(metrics.estimationAccuracy).toBeLessThanOrEqual(100)
    })

    it('should detect over/under estimation patterns', () => {
      const outcomes = [
        makeOutcome({
          estimatedDuration: '2h',
          actualDuration: '30m',
          variance: '-90m',
          tags: ['frontend'],
        }),
        makeOutcome({
          estimatedDuration: '2h',
          actualDuration: '45m',
          variance: '-75m',
          tags: ['frontend'],
        }),
        makeOutcome({
          estimatedDuration: '30m',
          actualDuration: '2h',
          variance: '+90m',
          tags: ['backend'],
        }),
        makeOutcome({
          estimatedDuration: '30m',
          actualDuration: '1h 30m',
          variance: '+60m',
          tags: ['backend'],
        }),
      ]

      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)
      expect(Array.isArray(metrics.overEstimated)).toBe(true)
      expect(Array.isArray(metrics.underEstimated)).toBe(true)
    })
  })

  describe('prjct_velocity_detail', () => {
    it('should return sprint-by-sprint breakdown', () => {
      const now = new Date()
      const outcomes = [
        makeOutcome({
          estimatedDuration: '1h',
          actualDuration: '1h',
          completedAt: new Date(now.getTime() - 86400000 * 10).toISOString(),
        }),
        makeOutcome({
          estimatedDuration: '2h',
          actualDuration: '2h',
          completedAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
        }),
        makeOutcome({
          estimatedDuration: '30m',
          actualDuration: '30m',
          completedAt: now.toISOString(),
        }),
      ]

      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)
      expect(metrics.sprints.length).toBeGreaterThan(0)
      expect(typeof metrics.averageVelocity).toBe('number')
      expect(['improving', 'stable', 'declining']).toContain(metrics.velocityTrend)
    })

    it('should project completion', () => {
      const projection = projectCompletion(20, 5, DEFAULT_VELOCITY_CONFIG)

      expect(projection.totalPoints).toBe(20)
      expect(projection.sprints).toBe(4)
      expect(projection.estimatedDate).toBeTruthy()
    })

    it('should handle zero velocity gracefully', () => {
      const projection = projectCompletion(20, 0, DEFAULT_VELOCITY_CONFIG)

      expect(projection.sprints).toBe(0)
      expect(projection.estimatedDate).toBe('')
    })
  })
})
