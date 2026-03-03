/**
 * Context Zone Storage Tests
 *
 * Tests persistence of zone transitions and compaction events.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { contextZoneStorage } from '../../storage/context-zone-storage'
import { prjctDb } from '../../storage/database'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string
let testProjectId: string

const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('Context Zone Storage', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-cz-test-'))
    testProjectId = 'test-cz-project'

    pathManager.getGlobalProjectPath = (projectId: string) => path.join(tmpRoot, projectId)

    await fs.mkdir(path.join(tmpRoot, testProjectId), { recursive: true })

    // Initialize the database (triggers all migrations)
    prjctDb.getDb(testProjectId)
  })

  afterEach(async () => {
    prjctDb.close()
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
    }
  })

  // ===========================================================================
  // Zone Transitions
  // ===========================================================================

  it('should record and retrieve zone transitions', () => {
    contextZoneStorage.recordTransition(testProjectId, {
      from: 'smart',
      to: 'warning',
      usagePercent: 42.5,
      timestamp: '2026-03-03T10:00:00Z',
      action: 'compact_recommended',
    })

    const transitions = contextZoneStorage.getTransitions(testProjectId)
    expect(transitions).toHaveLength(1)
    expect(transitions[0].from).toBe('smart')
    expect(transitions[0].to).toBe('warning')
    expect(transitions[0].usagePercent).toBe(42.5)
    expect(transitions[0].action).toBe('compact_recommended')
  })

  it('should respect limit on transitions', () => {
    for (let i = 0; i < 5; i++) {
      contextZoneStorage.recordTransition(testProjectId, {
        from: 'smart',
        to: 'warning',
        usagePercent: 40 + i,
        timestamp: `2026-03-03T${10 + i}:00:00Z`,
        action: null,
      })
    }

    const limited = contextZoneStorage.getTransitions(testProjectId, 3)
    expect(limited).toHaveLength(3)
  })

  // ===========================================================================
  // Compaction Events
  // ===========================================================================

  it('should record compaction events', () => {
    contextZoneStorage.recordCompaction(testProjectId, 'truth_snapshot', 50, 12)

    // Verify via summary
    const summary = contextZoneStorage.getSummary(testProjectId, 1)
    expect(summary.compactions).toBe(1)
  })

  // ===========================================================================
  // Summary
  // ===========================================================================

  it('should return 100% smart when no transitions exist', () => {
    const summary = contextZoneStorage.getSummary(testProjectId)
    expect(summary.smartPercent).toBe(100)
    expect(summary.warningPercent).toBe(0)
    expect(summary.dumbPercent).toBe(0)
    expect(summary.compactions).toBe(0)
  })

  it('should calculate zone distribution from transitions', () => {
    // 2 transitions to warning, 1 to dumb
    contextZoneStorage.recordTransition(testProjectId, {
      from: 'smart',
      to: 'warning',
      usagePercent: 42,
      timestamp: new Date().toISOString(),
      action: null,
    })
    contextZoneStorage.recordTransition(testProjectId, {
      from: 'warning',
      to: 'warning',
      usagePercent: 50,
      timestamp: new Date().toISOString(),
      action: null,
    })
    contextZoneStorage.recordTransition(testProjectId, {
      from: 'warning',
      to: 'dumb',
      usagePercent: 65,
      timestamp: new Date().toISOString(),
      action: null,
    })

    const summary = contextZoneStorage.getSummary(testProjectId, 7)
    expect(summary.warningPercent).toBeGreaterThan(0)
    expect(summary.dumbPercent).toBeGreaterThan(0)
  })
})
