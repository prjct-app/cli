/**
 * Outcome Storage Tests (PRJ-283)
 *
 * Tests for unified outcome storage:
 * - Feature outcome CRUD
 * - Task outcome CRUD
 * - Migration from shipped.json
 * - Aggregation
 * - Markdown generation
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import type { FeatureOutcome } from '../../schemas/outcomes'
import { prjctDb } from '../../storage/database'
import type { ShippedJson } from '../../types'
import { OutcomeStorage } from '../../workflows/outcome-storage'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string
let storage: OutcomeStorage

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)
const originalGetFilePath = pathManager.getFilePath.bind(pathManager)

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-outcome-storage-test-'))
  testProjectId = `test-outcome-${Date.now()}`

  pathManager.getGlobalProjectPath = (projectId: string) => {
    return path.join(tmpRoot!, projectId)
  }

  pathManager.getFilePath = (projectId: string, layer: string, filename: string) => {
    return path.join(tmpRoot!, projectId, layer, filename)
  }

  // Create directories
  const progressPath = path.join(tmpRoot!, testProjectId, 'progress')
  const syncPath = path.join(tmpRoot!, testProjectId, 'sync')
  await fs.mkdir(progressPath, { recursive: true })
  await fs.mkdir(syncPath, { recursive: true })

  storage = new OutcomeStorage()
})

afterEach(async () => {
  prjctDb.close()
  storage.clearCache()

  pathManager.getGlobalProjectPath = originalGetGlobalProjectPath
  pathManager.getFilePath = originalGetFilePath

  if (tmpRoot) {
    await fs.rm(tmpRoot, { recursive: true, force: true })
    tmpRoot = null
  }
})

// =============================================================================
// Helpers
// =============================================================================

function createFeatureOutcome(overrides: Partial<FeatureOutcome> = {}): FeatureOutcome {
  return {
    id: `out_feat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    featureId: `feat-${Date.now()}`,
    featureName: 'Test Feature',
    prdId: null,
    effort: {
      estimated: { hours: 2, confidence: 'medium' as const, source: 'manual' as const },
      actual: { hours: 2.5 },
      variance: { hours: 0.5, percentage: 25 },
    },
    success: {
      metrics: [],
      acceptanceCriteria: [],
      overallSuccess: 'met' as const,
      successScore: 85,
    },
    learnings: {
      whatWorked: ['Type-first approach'],
      whatDidnt: [],
      surprises: [],
      recommendations: [],
    },
    roi: {
      valueDelivered: 7,
      userImpact: 'medium' as const,
      businessImpact: 'medium' as const,
      roiScore: 28,
      worthIt: 'definitely' as const,
    },
    rating: 4 as const,
    startedAt: new Date().toISOString(),
    shippedAt: new Date().toISOString(),
    ...overrides,
  } as FeatureOutcome
}

// =============================================================================
// Feature Outcome Tests
// =============================================================================

describe('Feature Outcomes', () => {
  it('adds and retrieves feature outcome', async () => {
    const outcome = createFeatureOutcome({ featureName: 'Auth Flow' })

    await storage.addFeatureOutcome(testProjectId, outcome)

    const outcomes = await storage.getFeatureOutcomes(testProjectId)
    expect(outcomes.length).toBe(1)
    expect(outcomes[0].featureName).toBe('Auth Flow')
  })

  it('prepends new outcomes (most recent first)', async () => {
    const first = createFeatureOutcome({ featureName: 'First' })
    const second = createFeatureOutcome({ featureName: 'Second' })

    await storage.addFeatureOutcome(testProjectId, first)
    await storage.addFeatureOutcome(testProjectId, second)

    const outcomes = await storage.getFeatureOutcomes(testProjectId)
    expect(outcomes.length).toBe(2)
    expect(outcomes[0].featureName).toBe('Second')
  })

  it('returns recent outcomes with limit', async () => {
    for (let i = 0; i < 5; i++) {
      await storage.addFeatureOutcome(
        testProjectId,
        createFeatureOutcome({
          featureName: `Feature ${i}`,
          shippedAt: new Date(Date.now() + i * 1000).toISOString(),
        })
      )
    }

    const recent = await storage.getRecentOutcomes(testProjectId, 3)
    expect(recent.length).toBe(3)
  })
})

// =============================================================================
// Task Outcome Tests
// =============================================================================

describe('Task Outcomes', () => {
  it('adds and retrieves task outcomes', async () => {
    await storage.addTaskOutcome(testProjectId, {
      id: 'task-out-1',
      taskId: 'task-1',
      description: 'Test task outcome',
      actualMinutes: 30,
      completedAsPlanned: true,
      qualityScore: 4 as const,
      blockers: [],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    })

    const outcomes = await storage.getTaskOutcomes(testProjectId)
    expect(outcomes.length).toBe(1)
    expect(outcomes[0].description).toBe('Test task outcome')
  })
})

// =============================================================================
// Aggregation Tests
// =============================================================================

describe('Aggregation', () => {
  it('computes aggregates automatically on add', async () => {
    await storage.addFeatureOutcome(testProjectId, createFeatureOutcome({ featureName: 'A' }))
    await storage.addFeatureOutcome(testProjectId, createFeatureOutcome({ featureName: 'B' }))

    const aggregates = await storage.getAggregates(testProjectId)
    expect(aggregates).toBeDefined()
    expect(aggregates!.totalFeatures).toBe(2)
  })

  it('recomputes aggregates on reaggregate', async () => {
    await storage.addFeatureOutcome(testProjectId, createFeatureOutcome())
    await storage.reaggregate(testProjectId)

    const data = await storage.read(testProjectId)
    expect(data.lastAggregated).toBeDefined()
  })
})

// =============================================================================
// Migration Tests
// =============================================================================

describe('Migration from shipped.json', () => {
  it('converts shipped features to feature outcomes', () => {
    const shipped: ShippedJson = {
      shipped: [
        {
          id: 'ship-1',
          name: 'Auth Feature',
          version: '1.0.0',
          shippedAt: '2026-01-15T10:00:00.000Z',
          duration: '2h 30m',
          codeMetrics: {
            filesChanged: 5,
            linesAdded: 200,
            linesRemoved: 50,
            commits: 3,
          },
        },
      ],
      lastUpdated: '2026-01-15T10:00:00.000Z',
    }

    const outcomes = storage.migrateFromShipped(shipped)

    expect(outcomes.length).toBe(1)
    expect(outcomes[0].featureName).toBe('Auth Feature')
    expect(outcomes[0].version).toBe('1.0.0')
    expect(outcomes[0].effort.actual.commits).toBe(3)
    expect(outcomes[0].effort.actual.linesAdded).toBe(200)
    expect(outcomes[0].legacy).toBe(true)
  })

  it('handles shipped features without optional fields', () => {
    const shipped: ShippedJson = {
      shipped: [
        {
          id: 'ship-2',
          name: 'Simple Fix',
          version: '',
          shippedAt: '2026-01-20T10:00:00.000Z',
        },
      ],
      lastUpdated: '2026-01-20T10:00:00.000Z',
    }

    const outcomes = storage.migrateFromShipped(shipped)
    expect(outcomes.length).toBe(1)
    expect(outcomes[0].legacy).toBe(true)
  })

  it('handles empty shipped list', () => {
    const shipped: ShippedJson = {
      shipped: [],
      lastUpdated: '',
    }

    const outcomes = storage.migrateFromShipped(shipped)
    expect(outcomes.length).toBe(0)
  })
})

// =============================================================================
// Default / Edge Cases
// =============================================================================

describe('Defaults', () => {
  it('returns empty outcomes for new project', async () => {
    const outcomes = await storage.getFeatureOutcomes(testProjectId)
    expect(outcomes.length).toBe(0)
  })

  it('returns undefined aggregates for empty project', async () => {
    const aggregates = await storage.getAggregates(testProjectId)
    expect(aggregates).toBeUndefined()
  })
})
