/**
 * PerformanceTracker - Measures CLI performance metrics
 *
 * Instruments startup time, memory usage, context correctness,
 * subtask handoff rate, and command durations.
 *
 * Storage: SQLite events table (type prefix: 'perf.')
 *
 * @see PRJ-297
 */

import type {
  ContextCorrectness,
  MemorySnapshot,
  MetricName,
  PerformanceEntry,
  PerformanceMetric,
  PerformanceReport,
  SubtaskHandoff,
} from '../schemas/performance'
import prjctDb from '../storage/database'

// =============================================================================
// PERFORMANCE TRACKER
// =============================================================================

class PerformanceTracker {
  private marks: Map<string, bigint> = new Map()

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
  recordTiming(
    projectId: string,
    metric: MetricName,
    durationMs: number,
    context?: Record<string, unknown>
  ): void {
    prjctDb.appendEvent(projectId, `perf.${metric}`, {
      metric,
      value: Math.round(durationMs * 100) / 100, // 2 decimal places
      unit: 'ms',
      context,
    })
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
  recordMemory(projectId: string, context?: Record<string, unknown>): MemorySnapshot {
    const snapshot = this.snapshotMemory()

    const metrics: Array<{ metric: MetricName; value: number; unit: string }> = [
      { metric: 'heap_used', value: snapshot.heapUsed, unit: 'bytes' },
      { metric: 'heap_total', value: snapshot.heapTotal, unit: 'bytes' },
      { metric: 'rss', value: snapshot.rss, unit: 'bytes' },
      { metric: 'external_memory', value: snapshot.external, unit: 'bytes' },
    ]

    for (const m of metrics) {
      prjctDb.appendEvent(projectId, `perf.${m.metric}`, {
        metric: m.metric,
        value: m.value,
        unit: m.unit,
        context,
      })
    }

    return snapshot
  }

  // ===========================================================================
  // Context Correctness
  // ===========================================================================

  /**
   * Record whether a task received sync context
   */
  recordContextCorrectness(
    projectId: string,
    data: Omit<ContextCorrectness, 'timestamp' | 'metric'>
  ): void {
    prjctDb.appendEvent(projectId, 'perf.context_correctness', {
      metric: 'context_correctness',
      ...data,
    })
  }

  // ===========================================================================
  // Subtask Handoff
  // ===========================================================================

  /**
   * Record whether a subtask's output field was populated on completion
   */
  recordSubtaskHandoff(
    projectId: string,
    data: Omit<SubtaskHandoff, 'timestamp' | 'metric'>
  ): void {
    prjctDb.appendEvent(projectId, 'perf.subtask_handoff', {
      metric: 'subtask_handoff',
      ...data,
    })
  }

  // ===========================================================================
  // Report Generation
  // ===========================================================================

  /**
   * Read all metrics for a project within a date range
   */
  getMetrics(projectId: string, sinceDate?: Date): PerformanceEntry[] {
    if (!sinceDate) {
      // Default: last 7 days
      sinceDate = new Date()
      sinceDate.setDate(sinceDate.getDate() - 7)
    }

    const sinceIso = sinceDate.toISOString()

    const rows = prjctDb.query<{ data: string; timestamp: string }>(
      projectId,
      'SELECT data, timestamp FROM events WHERE type LIKE ? AND timestamp >= ? ORDER BY id DESC',
      'perf.%',
      sinceIso
    )

    return rows.map((row) => {
      const parsed = JSON.parse(row.data)
      return { ...parsed, timestamp: row.timestamp } as PerformanceEntry
    })
  }

  /**
   * Generate a performance report for a project
   */
  getReport(projectId: string, days: number = 7): PerformanceReport {
    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)
    sinceDate.setHours(0, 0, 0, 0)

    const entries = this.getMetrics(projectId, sinceDate)
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
