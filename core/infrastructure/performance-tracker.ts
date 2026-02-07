/**
 * PerformanceTracker - Measures CLI performance metrics
 *
 * Instruments startup time, memory usage, context correctness,
 * subtask handoff rate, and command durations.
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/storage/performance.jsonl
 * Rotation: 5MB (via jsonl-helper)
 *
 * @see PRJ-297
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import type {
  ContextCorrectness,
  MemorySnapshot,
  MetricName,
  PerformanceEntry,
  PerformanceMetric,
  PerformanceReport,
  SubtaskHandoff,
} from '../schemas/performance'
import { getTimestamp } from '../utils/date-helper'
import { appendJsonLineWithRotation, filterJsonLines } from '../utils/jsonl-helper'
import pathManager from './path-manager'

// =============================================================================
// CONSTANTS
// =============================================================================

const PERF_FILENAME = 'performance.jsonl'
const ROTATION_SIZE_MB = 5

// =============================================================================
// PERFORMANCE TRACKER
// =============================================================================

class PerformanceTracker {
  private marks: Map<string, bigint> = new Map()

  /**
   * Get the performance.jsonl path for a project
   */
  private getPath(projectId: string): string {
    return pathManager.getStoragePath(projectId, PERF_FILENAME)
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureDir(projectId: string): Promise<void> {
    const filePath = this.getPath(projectId)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
  }

  // ===========================================================================
  // Timing
  // ===========================================================================

  /**
   * Mark the start of a timing measurement.
   * Uses process.hrtime.bigint() for nanosecond precision.
   */
  markStart(label: string): void {
    this.marks.set(label, process.hrtime.bigint())
  }

  /**
   * Mark the end of a timing measurement and return duration in ms.
   * Returns null if no matching start mark exists.
   */
  markEnd(label: string): number | null {
    const start = this.marks.get(label)
    if (start === undefined) return null

    const end = process.hrtime.bigint()
    this.marks.delete(label)
    return Number(end - start) / 1_000_000 // ns → ms
  }

  /**
   * Record a timing metric to storage
   */
  async recordTiming(
    projectId: string,
    metric: MetricName,
    durationMs: number,
    context?: Record<string, unknown>
  ): Promise<void> {
    await this.ensureDir(projectId)

    const entry: PerformanceMetric = {
      timestamp: getTimestamp(),
      metric,
      value: Math.round(durationMs * 100) / 100, // 2 decimal places
      unit: 'ms',
      context,
    }

    await appendJsonLineWithRotation(this.getPath(projectId), entry, ROTATION_SIZE_MB)
  }

  // ===========================================================================
  // Memory
  // ===========================================================================

  /**
   * Take a memory snapshot using process.memoryUsage()
   */
  snapshotMemory(): MemorySnapshot {
    const mem = process.memoryUsage()
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      rss: mem.rss,
      external: mem.external,
    }
  }

  /**
   * Record a memory snapshot to storage
   */
  async recordMemory(
    projectId: string,
    context?: Record<string, unknown>
  ): Promise<MemorySnapshot> {
    await this.ensureDir(projectId)

    const snapshot = this.snapshotMemory()
    const filePath = this.getPath(projectId)
    const ts = getTimestamp()

    const entries: PerformanceMetric[] = [
      { timestamp: ts, metric: 'heap_used', value: snapshot.heapUsed, unit: 'bytes', context },
      { timestamp: ts, metric: 'heap_total', value: snapshot.heapTotal, unit: 'bytes', context },
      { timestamp: ts, metric: 'rss', value: snapshot.rss, unit: 'bytes', context },
      {
        timestamp: ts,
        metric: 'external_memory',
        value: snapshot.external,
        unit: 'bytes',
        context,
      },
    ]

    for (const entry of entries) {
      await appendJsonLineWithRotation(filePath, entry, ROTATION_SIZE_MB)
    }

    return snapshot
  }

  // ===========================================================================
  // Context Correctness
  // ===========================================================================

  /**
   * Record whether a task received sync context
   */
  async recordContextCorrectness(
    projectId: string,
    data: Omit<ContextCorrectness, 'timestamp' | 'metric'>
  ): Promise<void> {
    await this.ensureDir(projectId)

    const entry: ContextCorrectness = {
      timestamp: getTimestamp(),
      metric: 'context_correctness',
      ...data,
    }

    await appendJsonLineWithRotation(this.getPath(projectId), entry, ROTATION_SIZE_MB)
  }

  // ===========================================================================
  // Subtask Handoff
  // ===========================================================================

  /**
   * Record whether a subtask's output field was populated on completion
   */
  async recordSubtaskHandoff(
    projectId: string,
    data: Omit<SubtaskHandoff, 'timestamp' | 'metric'>
  ): Promise<void> {
    await this.ensureDir(projectId)

    const entry: SubtaskHandoff = {
      timestamp: getTimestamp(),
      metric: 'subtask_handoff',
      ...data,
    }

    await appendJsonLineWithRotation(this.getPath(projectId), entry, ROTATION_SIZE_MB)
  }

  // ===========================================================================
  // Report Generation
  // ===========================================================================

  /**
   * Read all metrics for a project within a date range
   */
  async getMetrics(projectId: string, sinceDate?: Date): Promise<PerformanceEntry[]> {
    const filePath = this.getPath(projectId)

    if (!sinceDate) {
      // Default: last 7 days
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 7)
    }

    const sinceIso = sinceDate.toISOString()

    return filterJsonLines<PerformanceEntry>(filePath, (entry) => {
      return entry.timestamp >= sinceIso
    })
  }

  /**
   * Generate a performance report for a project
   */
  async getReport(projectId: string, days: number = 7): Promise<PerformanceReport> {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)

    const entries = await this.getMetrics(projectId, sinceDate)
    const report: PerformanceReport = {
      period: `${days}d`,
    }

    // Startup time
    const startupEntries = entries.filter(
      (e): e is PerformanceMetric => 'metric' in e && e.metric === 'startup_time'
    )
    if (startupEntries.length > 0) {
      const values = startupEntries.map((e) => e.value)
      report.startup = {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
        unit: 'ms',
      }
    }

    // Memory
    const heapEntries = entries.filter(
      (e): e is PerformanceMetric => 'metric' in e && e.metric === 'heap_used'
    )
    const rssEntries = entries.filter(
      (e): e is PerformanceMetric => 'metric' in e && e.metric === 'rss'
    )
    if (heapEntries.length > 0) {
      const toMB = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10
      const heapValues = heapEntries.map((e) => e.value)
      const rssValues = rssEntries.map((e) => e.value)
      report.memory = {
        avgHeapMB: toMB(heapValues.reduce((a, b) => a + b, 0) / heapValues.length),
        peakHeapMB: toMB(Math.max(...heapValues)),
        avgRssMB:
          rssValues.length > 0 ? toMB(rssValues.reduce((a, b) => a + b, 0) / rssValues.length) : 0,
      }
    }

    // Context correctness
    const contextEntries = entries.filter(
      (e): e is ContextCorrectness => 'metric' in e && e.metric === 'context_correctness'
    )
    if (contextEntries.length > 0) {
      const received = contextEntries.filter((e) => e.receivedSync).length
      report.contextCorrectness = {
        total: contextEntries.length,
        receivedSync: received,
        rate: Math.round((received / contextEntries.length) * 100),
      }
    }

    // Subtask handoff
    const handoffEntries = entries.filter(
      (e): e is SubtaskHandoff => 'metric' in e && e.metric === 'subtask_handoff'
    )
    if (handoffEntries.length > 0) {
      const populated = handoffEntries.filter((e) => e.outputPopulated).length
      report.subtaskHandoff = {
        total: handoffEntries.length,
        outputPopulated: populated,
        rate: Math.round((populated / handoffEntries.length) * 100),
      }
    }

    // Command durations
    const cmdEntries = entries.filter(
      (e): e is PerformanceMetric => 'metric' in e && e.metric === 'command_duration'
    )
    if (cmdEntries.length > 0) {
      const byCommand: Record<string, number[]> = {}
      for (const e of cmdEntries) {
        const cmd = (e.context?.command as string) || 'unknown'
        if (!byCommand[cmd]) byCommand[cmd] = []
        byCommand[cmd].push(e.value)
      }

      report.commandDurations = {}
      for (const [cmd, values] of Object.entries(byCommand)) {
        report.commandDurations[cmd] = {
          avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length,
          unit: 'ms',
        }
      }
    }

    return report
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const performanceTracker = new PerformanceTracker()
export default performanceTracker
