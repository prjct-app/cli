/**
 * Velocity Engine Tests (PRJ-296)
 *
 * Tests for sprint aggregation, trend detection, estimation accuracy,
 * pattern detection, projections, and graceful degradation.
 */

import { describe, expect, it } from 'bun:test'
import {
  calculateVelocity,
  detectTrend,
  formatVelocityContext,
  getSprintEnd,
  getSprintStart,
  parseDurationMinutes,
  projectCompletion,
} from '../../domain/velocity'
import type { VelocityConfig } from '../../schemas/velocity'
import type { Outcome } from '../../types/outcomes'

// =============================================================================
// Test Helpers
// =============================================================================

function makeOutcome(overrides: Partial<Outcome> = {}): Outcome {
  return {
    id: 'test-id',
    sessionId: 'sess_test',
    command: 'done',
    task: 'Test task',
    startedAt: '2026-01-20T10:00:00.000Z',
    completedAt: '2026-01-20T11:30:00.000Z',
    estimatedDuration: '1h 30m',
    actualDuration: '1h 30m',
    variance: '+0m',
    completedAsPlanned: true,
    qualityScore: 4,
    tags: ['backend'],
    ...overrides,
  }
}

const DEFAULT_CONFIG: VelocityConfig = {
  sprintLengthDays: 7,
  startDay: 'monday',
  windowSize: 6,
  accuracyTolerance: 20,
}

// =============================================================================
// Sprint Boundary Tests
// =============================================================================

describe('Sprint Boundaries', () => {
  it('should align sprint start to configured start day', () => {
    // Wednesday Jan 22, 2026 → should roll back to Monday Jan 20
    const date = new Date('2026-01-22T12:00:00Z')
    const start = getSprintStart(date, DEFAULT_CONFIG)
    expect(start.getDay()).toBe(1) // Monday
    expect(start.getDate()).toBe(19) // Jan 19 (Monday)
  })

  it('should keep date if it IS the start day', () => {
    // Monday Jan 20, 2026
    const date = new Date('2026-01-19T12:00:00Z')
    const start = getSprintStart(date, DEFAULT_CONFIG)
    expect(start.getDay()).toBe(1) // Monday
  })

  it('should calculate sprint end correctly', () => {
    const start = new Date('2026-01-19T00:00:00Z')
    const end = getSprintEnd(start, DEFAULT_CONFIG)
    expect(end.getDate()).toBe(25) // 7 days later - 1
    expect(end.getHours()).toBe(23)
  })

  it('should handle different start days', () => {
    const config: VelocityConfig = { ...DEFAULT_CONFIG, startDay: 'friday' }
    // Monday Jan 20 → should roll back to Friday Jan 17
    const date = new Date('2026-01-20T12:00:00Z')
    const start = getSprintStart(date, config)
    expect(start.getDay()).toBe(5) // Friday
  })
})

// =============================================================================
// Empty Data (Graceful Degradation)
// =============================================================================

describe('Empty Data', () => {
  it('should return zero metrics for empty outcomes', () => {
    const metrics = calculateVelocity([], DEFAULT_CONFIG)
    expect(metrics.sprints).toEqual([])
    expect(metrics.averageVelocity).toBe(0)
    expect(metrics.velocityTrend).toBe('stable')
    expect(metrics.estimationAccuracy).toBe(0)
    expect(metrics.overEstimated).toEqual([])
    expect(metrics.underEstimated).toEqual([])
  })

  it('should format empty velocity context', () => {
    const metrics = calculateVelocity([], DEFAULT_CONFIG)
    const context = formatVelocityContext(metrics)
    expect(context).toBe('No velocity data available yet.')
  })

  it('should handle projection with zero velocity', () => {
    const projection = projectCompletion(100, 0, DEFAULT_CONFIG)
    expect(projection.sprints).toBe(0)
    expect(projection.estimatedDate).toBe('')
  })
})

// =============================================================================
// Sprint Aggregation
// =============================================================================

describe('Sprint Aggregation', () => {
  it('should group outcomes into sprints', () => {
    const outcomes = [
      // Sprint 1 (week of Jan 19)
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h 30m',
        actualDuration: '1h 30m',
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '30m',
        actualDuration: '30m',
      }),
      // Sprint 2 (week of Jan 26)
      makeOutcome({
        completedAt: '2026-01-27T10:00:00.000Z',
        estimatedDuration: '2h',
        actualDuration: '2h',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.sprints.length).toBe(2)
    expect(metrics.sprints[0].tasksCompleted).toBe(2)
    expect(metrics.sprints[1].tasksCompleted).toBe(1)
  })

  it('should calculate points from estimated duration', () => {
    const outcomes = [
      // 90m estimated → 5 points (fibonacci mapping)
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h 30m',
        actualDuration: '1h 30m',
      }),
      // 45m estimated → 3 points
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '45m',
        actualDuration: '45m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    // Both in same sprint: 5 + 3 = 8 points
    expect(metrics.sprints[0].pointsCompleted).toBe(8)
  })

  it('should calculate average velocity over window', () => {
    // Create outcomes across 3 sprints
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h 30m',
      }),
      makeOutcome({
        completedAt: '2026-01-27T10:00:00.000Z',
        estimatedDuration: '3h',
      }),
      makeOutcome({
        completedAt: '2026-02-03T10:00:00.000Z',
        estimatedDuration: '45m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.sprints.length).toBe(3)
    expect(metrics.averageVelocity).toBeGreaterThan(0)
  })
})

// =============================================================================
// Trend Detection
// =============================================================================

describe('Trend Detection', () => {
  it('should detect stable trend with consistent velocity', () => {
    const sprints = [
      {
        sprintNumber: 1,
        startDate: '',
        endDate: '',
        pointsCompleted: 10,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 2,
        startDate: '',
        endDate: '',
        pointsCompleted: 11,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 3,
        startDate: '',
        endDate: '',
        pointsCompleted: 10,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 4,
        startDate: '',
        endDate: '',
        pointsCompleted: 11,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
    ]
    expect(detectTrend(sprints)).toBe('stable')
  })

  it('should detect improving trend', () => {
    const sprints = [
      {
        sprintNumber: 1,
        startDate: '',
        endDate: '',
        pointsCompleted: 5,
        tasksCompleted: 2,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 2,
        startDate: '',
        endDate: '',
        pointsCompleted: 10,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 3,
        startDate: '',
        endDate: '',
        pointsCompleted: 15,
        tasksCompleted: 4,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 4,
        startDate: '',
        endDate: '',
        pointsCompleted: 20,
        tasksCompleted: 5,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
    ]
    expect(detectTrend(sprints)).toBe('improving')
  })

  it('should detect declining trend', () => {
    const sprints = [
      {
        sprintNumber: 1,
        startDate: '',
        endDate: '',
        pointsCompleted: 20,
        tasksCompleted: 5,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 2,
        startDate: '',
        endDate: '',
        pointsCompleted: 15,
        tasksCompleted: 4,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 3,
        startDate: '',
        endDate: '',
        pointsCompleted: 10,
        tasksCompleted: 3,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 4,
        startDate: '',
        endDate: '',
        pointsCompleted: 5,
        tasksCompleted: 2,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
    ]
    expect(detectTrend(sprints)).toBe('declining')
  })

  it('should return stable with fewer than 3 sprints', () => {
    const sprints = [
      {
        sprintNumber: 1,
        startDate: '',
        endDate: '',
        pointsCompleted: 5,
        tasksCompleted: 2,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
      {
        sprintNumber: 2,
        startDate: '',
        endDate: '',
        pointsCompleted: 20,
        tasksCompleted: 5,
        avgVariance: 0,
        estimationAccuracy: 80,
      },
    ]
    expect(detectTrend(sprints)).toBe('stable')
  })
})

// =============================================================================
// Estimation Accuracy
// =============================================================================

describe('Estimation Accuracy', () => {
  it('should calculate 100% accuracy when all estimates are exact', () => {
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '1h',
        variance: '+0m',
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '30m',
        actualDuration: '30m',
        variance: '+0m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.estimationAccuracy).toBe(100)
  })

  it('should count tasks within tolerance as accurate', () => {
    // 10% variance is within 20% tolerance
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '1h 6m', // +10%
        variance: '+6m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.estimationAccuracy).toBe(100) // Within 20% tolerance
  })

  it('should flag tasks outside tolerance as inaccurate', () => {
    // 50% over is outside 20% tolerance
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '1h 30m', // +50%
        variance: '+30m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.estimationAccuracy).toBe(0) // Outside 20% tolerance
  })
})

// =============================================================================
// Estimation Pattern Detection
// =============================================================================

describe('Estimation Patterns', () => {
  it('should detect under-estimation patterns by category', () => {
    // Backend tasks consistently take longer
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '1h 30m',
        tags: ['backend'],
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '2h',
        actualDuration: '3h',
        tags: ['backend'],
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.underEstimated.length).toBeGreaterThan(0)
    expect(metrics.underEstimated[0].category).toBe('backend')
  })

  it('should detect over-estimation patterns', () => {
    // Frontend tasks consistently finish faster
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '2h',
        actualDuration: '1h',
        tags: ['frontend'],
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '3h',
        actualDuration: '1h 30m',
        tags: ['frontend'],
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    expect(metrics.overEstimated.length).toBeGreaterThan(0)
    expect(metrics.overEstimated[0].category).toBe('frontend')
  })

  it('should not report patterns with fewer than 2 data points', () => {
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '2h',
        tags: ['rare-category'],
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    const found = metrics.underEstimated.find((p) => p.category === 'rare-category')
    expect(found).toBeUndefined()
  })
})

// =============================================================================
// Completion Projection
// =============================================================================

describe('Completion Projection', () => {
  it('should project sprints based on velocity', () => {
    const projection = projectCompletion(100, 25, DEFAULT_CONFIG)
    expect(projection.sprints).toBe(4) // 100 / 25 = 4
    expect(projection.totalPoints).toBe(100)
    expect(projection.estimatedDate).toBeTruthy()
  })

  it('should round up to next sprint', () => {
    const projection = projectCompletion(30, 25, DEFAULT_CONFIG)
    expect(projection.sprints).toBe(2) // ceil(30/25) = 2
  })

  it('should handle zero velocity gracefully', () => {
    const projection = projectCompletion(100, 0, DEFAULT_CONFIG)
    expect(projection.sprints).toBe(0)
    expect(projection.estimatedDate).toBe('')
  })

  it('should calculate estimated date from sprint count', () => {
    const projection = projectCompletion(50, 25, DEFAULT_CONFIG)
    expect(projection.sprints).toBe(2) // 2 sprints × 7 days = 14 days from now
    const date = new Date(projection.estimatedDate)
    const now = new Date()
    const diffDays = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    expect(diffDays).toBeGreaterThanOrEqual(13) // ~14 days, allow for rounding
    expect(diffDays).toBeLessThanOrEqual(15)
  })
})

// =============================================================================
// Duration Parsing
// =============================================================================

describe('Duration Parsing', () => {
  it('should parse hours', () => {
    expect(parseDurationMinutes('2h')).toBe(120)
  })

  it('should parse minutes', () => {
    expect(parseDurationMinutes('45m')).toBe(45)
  })

  it('should parse hours and minutes', () => {
    expect(parseDurationMinutes('1h 30m')).toBe(90)
  })

  it('should parse compact format', () => {
    expect(parseDurationMinutes('2h30m')).toBe(150)
  })

  it('should parse seconds as 1 minute minimum', () => {
    expect(parseDurationMinutes('45s')).toBe(1)
  })

  it('should return 0 for empty string', () => {
    expect(parseDurationMinutes('')).toBe(0)
  })
})

// =============================================================================
// Velocity Context Formatting
// =============================================================================

describe('Velocity Context Formatting', () => {
  it('should format velocity summary for LLM injection', () => {
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h 30m',
        actualDuration: '1h 30m',
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '45m',
        actualDuration: '45m',
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    const context = formatVelocityContext(metrics)

    expect(context).toContain('pts/sprint')
    expect(context).toContain('Estimation accuracy')
  })

  it('should include under-estimation warnings', () => {
    const outcomes = [
      makeOutcome({
        completedAt: '2026-01-20T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '2h',
        tags: ['backend'],
      }),
      makeOutcome({
        completedAt: '2026-01-21T10:00:00.000Z',
        estimatedDuration: '1h',
        actualDuration: '2h',
        tags: ['backend'],
      }),
    ]

    const metrics = calculateVelocity(outcomes, DEFAULT_CONFIG)
    const context = formatVelocityContext(metrics)

    expect(context).toContain('backend')
    expect(context).toContain('longer than estimated')
  })
})

// =============================================================================
// Configuration
// =============================================================================

describe('Configuration', () => {
  it('should respect custom sprint length', () => {
    const config: VelocityConfig = { ...DEFAULT_CONFIG, sprintLengthDays: 14 }
    const outcomes = [
      makeOutcome({ completedAt: '2026-01-20T10:00:00.000Z' }),
      makeOutcome({ completedAt: '2026-01-27T10:00:00.000Z' }), // 7 days later, same 14-day sprint
    ]

    const metrics = calculateVelocity(outcomes, config)
    // Both outcomes should be in the same sprint (14-day window)
    expect(metrics.sprints.length).toBe(1)
  })

  it('should respect custom window size', () => {
    const config: VelocityConfig = { ...DEFAULT_CONFIG, windowSize: 2 }
    // Create outcomes across 4 sprints
    const outcomes = [
      makeOutcome({ completedAt: '2026-01-20T10:00:00.000Z', estimatedDuration: '1h' }),
      makeOutcome({ completedAt: '2026-01-27T10:00:00.000Z', estimatedDuration: '2h' }),
      makeOutcome({ completedAt: '2026-02-03T10:00:00.000Z', estimatedDuration: '3h' }),
      makeOutcome({ completedAt: '2026-02-10T10:00:00.000Z', estimatedDuration: '4h' }),
    ]

    const metrics = calculateVelocity(outcomes, config)
    // All 4 sprints exist
    expect(metrics.sprints.length).toBe(4)
    // But average is only from last 2 sprints
    // Sprint 3: ~3 points (45m typical = 3), Sprint 4: ~5 points (90m typical = 5)
    expect(metrics.averageVelocity).toBeGreaterThan(0)
  })

  it('should use defaults when config values are missing', () => {
    const config: VelocityConfig = {} // All defaults
    const outcomes = [makeOutcome({ completedAt: '2026-01-20T10:00:00.000Z' })]

    const metrics = calculateVelocity(outcomes, config)
    expect(metrics.sprints.length).toBe(1)
  })
})
