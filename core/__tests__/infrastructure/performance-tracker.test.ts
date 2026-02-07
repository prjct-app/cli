/**
 * PerformanceTracker Tests
 *
 * Tests for:
 * - Timing marks (start/end)
 * - Memory snapshots
 * - Metric recording to JSONL
 * - Context correctness recording
 * - Subtask handoff recording
 * - Report generation
 * - JSONL rotation
 *
 * @see PRJ-297
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../../infrastructure/path-manager'
import { performanceTracker } from '../../infrastructure/performance-tracker'
import type { PerformanceEntry, PerformanceMetric } from '../../schemas/performance'
import * as jsonlHelper from '../../utils/jsonl-helper'

// =============================================================================
// Test Setup
// =============================================================================

let tmpRoot: string | null = null
let testProjectId: string

const originalGetStoragePath = pathManager.getStoragePath.bind(pathManager)
const originalGetGlobalProjectPath = pathManager.getGlobalProjectPath.bind(pathManager)

describe('PerformanceTracker', () => {
  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'prjct-perf-test-'))
    testProjectId = 'test-project-perf'

    pathManager.getStoragePath = (projectId: string, filename: string) => {
      return path.join(tmpRoot!, projectId, 'storage', filename)
    }

    pathManager.getGlobalProjectPath = (projectId: string) => {
      return path.join(tmpRoot!, projectId)
    }
  })

  afterEach(async () => {
    pathManager.getStoragePath = originalGetStoragePath
    pathManager.getGlobalProjectPath = originalGetGlobalProjectPath

    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true })
      tmpRoot = null
    }
  })

  // ===========================================================================
  // Timing Tests
  // ===========================================================================

  describe('timing marks', () => {
    it('should measure elapsed time between start and end', async () => {
      performanceTracker.markStart('test-op')

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10))

      const durationMs = performanceTracker.markEnd('test-op')
      expect(durationMs).not.toBeNull()
      expect(durationMs!).toBeGreaterThan(0)
      expect(durationMs!).toBeLessThan(1000) // Shouldn't take more than 1s
    })

    it('should return null for non-existent mark', () => {
      const result = performanceTracker.markEnd('nonexistent')
      expect(result).toBeNull()
    })

    it('should clean up marks after end', () => {
      performanceTracker.markStart('cleanup-test')
      performanceTracker.markEnd('cleanup-test')

      // Second call should return null
      const result = performanceTracker.markEnd('cleanup-test')
      expect(result).toBeNull()
    })
  })

  // ===========================================================================
  // Memory Tests
  // ===========================================================================

  describe('memory snapshots', () => {
    it('should return valid memory snapshot', () => {
      const snapshot = performanceTracker.snapshotMemory()

      expect(snapshot.heapUsed).toBeGreaterThan(0)
      expect(snapshot.heapTotal).toBeGreaterThan(0)
      expect(snapshot.rss).toBeGreaterThan(0)
      expect(snapshot.external).toBeGreaterThanOrEqual(0)
      // heapUsed can momentarily exceed heapTotal during GC, so just
      // verify both are positive numbers in a reasonable range
      expect(snapshot.heapTotal).toBeGreaterThan(1024 * 1024) // > 1MB
    })

    it('should record memory to JSONL', async () => {
      const snapshot = await performanceTracker.recordMemory(testProjectId)

      expect(snapshot.heapUsed).toBeGreaterThan(0)

      // Verify JSONL file was created
      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceMetric>(filePath)

      // Should have 4 entries (heap_used, heap_total, rss, external_memory)
      expect(entries.length).toBe(4)
      expect(entries.map((e) => e.metric)).toEqual([
        'heap_used',
        'heap_total',
        'rss',
        'external_memory',
      ])
    })
  })

  // ===========================================================================
  // Recording Tests
  // ===========================================================================

  describe('metric recording', () => {
    it('should record timing metric to JSONL', async () => {
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 350.5)

      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceMetric>(filePath)

      expect(entries.length).toBe(1)
      expect(entries[0].metric).toBe('startup_time')
      expect(entries[0].value).toBe(350.5)
      expect(entries[0].unit).toBe('ms')
      expect(entries[0].timestamp).toBeTruthy()
    })

    it('should record timing with context', async () => {
      await performanceTracker.recordTiming(testProjectId, 'command_duration', 120, {
        command: 'sync',
      })

      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceMetric>(filePath)

      expect(entries[0].context).toEqual({ command: 'sync' })
    })

    it('should append multiple metrics', async () => {
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 300)
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 250)
      await performanceTracker.recordTiming(testProjectId, 'command_duration', 50)

      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceMetric>(filePath)

      expect(entries.length).toBe(3)
    })
  })

  // ===========================================================================
  // Context Correctness Tests
  // ===========================================================================

  describe('context correctness', () => {
    it('should record context correctness entry', async () => {
      await performanceTracker.recordContextCorrectness(testProjectId, {
        taskId: 'task_123',
        receivedSync: true,
        syncFieldsInjected: ['analysis', 'patterns'],
      })

      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceEntry>(filePath)

      expect(entries.length).toBe(1)
      const entry = entries[0] as Record<string, unknown>
      expect(entry.metric).toBe('context_correctness')
      expect(entry.taskId).toBe('task_123')
      expect(entry.receivedSync).toBe(true)
    })
  })

  // ===========================================================================
  // Subtask Handoff Tests
  // ===========================================================================

  describe('subtask handoff', () => {
    it('should record handoff entry', async () => {
      await performanceTracker.recordSubtaskHandoff(testProjectId, {
        taskId: 'task_456',
        subtaskId: 'subtask-001',
        outputPopulated: true,
      })

      const filePath = pathManager.getStoragePath(testProjectId, 'performance.jsonl')
      const entries = await jsonlHelper.readJsonLines<PerformanceEntry>(filePath)

      expect(entries.length).toBe(1)
      const entry = entries[0] as Record<string, unknown>
      expect(entry.metric).toBe('subtask_handoff')
      expect(entry.outputPopulated).toBe(true)
    })
  })

  // ===========================================================================
  // Report Generation Tests
  // ===========================================================================

  describe('report generation', () => {
    it('should return empty report when no data', async () => {
      const report = await performanceTracker.getReport(testProjectId)

      expect(report.period).toBe('7d')
      expect(report.startup).toBeUndefined()
      expect(report.memory).toBeUndefined()
      expect(report.contextCorrectness).toBeUndefined()
      expect(report.subtaskHandoff).toBeUndefined()
    })

    it('should aggregate startup time metrics', async () => {
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 300)
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 400)
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 500)

      const report = await performanceTracker.getReport(testProjectId)

      expect(report.startup).toBeDefined()
      expect(report.startup!.avg).toBe(400)
      expect(report.startup!.min).toBe(300)
      expect(report.startup!.max).toBe(500)
      expect(report.startup!.count).toBe(3)
    })

    it('should aggregate memory metrics', async () => {
      await performanceTracker.recordMemory(testProjectId)

      const report = await performanceTracker.getReport(testProjectId)

      expect(report.memory).toBeDefined()
      expect(report.memory!.avgHeapMB).toBeGreaterThan(0)
      expect(report.memory!.peakHeapMB).toBeGreaterThan(0)
    })

    it('should aggregate context correctness', async () => {
      await performanceTracker.recordContextCorrectness(testProjectId, {
        taskId: 't1',
        receivedSync: true,
      })
      await performanceTracker.recordContextCorrectness(testProjectId, {
        taskId: 't2',
        receivedSync: false,
      })

      const report = await performanceTracker.getReport(testProjectId)

      expect(report.contextCorrectness).toBeDefined()
      expect(report.contextCorrectness!.total).toBe(2)
      expect(report.contextCorrectness!.receivedSync).toBe(1)
      expect(report.contextCorrectness!.rate).toBe(50)
    })

    it('should aggregate subtask handoff', async () => {
      await performanceTracker.recordSubtaskHandoff(testProjectId, {
        taskId: 't1',
        subtaskId: 's1',
        outputPopulated: true,
      })
      await performanceTracker.recordSubtaskHandoff(testProjectId, {
        taskId: 't1',
        subtaskId: 's2',
        outputPopulated: true,
      })
      await performanceTracker.recordSubtaskHandoff(testProjectId, {
        taskId: 't1',
        subtaskId: 's3',
        outputPopulated: false,
      })

      const report = await performanceTracker.getReport(testProjectId)

      expect(report.subtaskHandoff).toBeDefined()
      expect(report.subtaskHandoff!.total).toBe(3)
      expect(report.subtaskHandoff!.outputPopulated).toBe(2)
      expect(report.subtaskHandoff!.rate).toBe(67)
    })

    it('should aggregate command durations', async () => {
      await performanceTracker.recordTiming(testProjectId, 'command_duration', 100, {
        command: 'sync',
      })
      await performanceTracker.recordTiming(testProjectId, 'command_duration', 200, {
        command: 'sync',
      })
      await performanceTracker.recordTiming(testProjectId, 'command_duration', 50, {
        command: 'status',
      })

      const report = await performanceTracker.getReport(testProjectId)

      expect(report.commandDurations).toBeDefined()
      expect(report.commandDurations!.sync).toBeDefined()
      expect(report.commandDurations!.sync.avg).toBe(150)
      expect(report.commandDurations!.sync.count).toBe(2)
      expect(report.commandDurations!.status).toBeDefined()
      expect(report.commandDurations!.status.avg).toBe(50)
    })

    it('should filter by date range', async () => {
      // Record some metrics
      await performanceTracker.recordTiming(testProjectId, 'startup_time', 300)

      // Report for 0 days (should find nothing before today)
      const report = await performanceTracker.getReport(testProjectId, 0)
      // With 0 days, sinceDate = today, so entries from "now" should still match
      // because the filter is >= sinceIso (same day)
      expect(report.startup).toBeDefined()
    })
  })
})
