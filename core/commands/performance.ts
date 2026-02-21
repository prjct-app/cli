/**
 * Performance Commands: perf
 * Dashboard for CLI performance metrics
 *
 * @see PRJ-297
 */

import chalk from 'chalk'
import performanceTracker from '../infrastructure/performance-tracker'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { configManager, out, PrjctCommandsBase } from './base'

// Target thresholds for display
const TARGETS = {
  startup: { max: 500, unit: 'ms' },
  heapMB: { max: 80, unit: 'MB' },
  contextRate: { min: 100, unit: '%' },
  handoffRate: { min: 100, unit: '%' },
}

function statusIcon(value: number, target: number, mode: 'below' | 'above'): string {
  if (mode === 'below') {
    return value <= target ? chalk.green('✓') : chalk.yellow('⚠')
  }
  return value >= target ? chalk.green('✓') : chalk.yellow('⚠')
}

export class PerformanceCommands extends PrjctCommandsBase {
  /**
   * prjct perf - Performance dashboard
   */
  async perf(period: string = '7', projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const days = parseInt(period, 10) || 7
      const report = await performanceTracker.getReport(projectId, days)

      const hasData =
        report.startup ||
        report.memory ||
        report.contextCorrectness ||
        report.subtaskHandoff ||
        report.commandDurations

      if (!hasData) {
        console.log(`\n${chalk.dim('No performance data yet.')}`)
        console.log(`${chalk.dim('Metrics are collected automatically as you use the CLI.')}\n`)
        return { success: true, message: 'No data' }
      }

      console.log(`\n${chalk.cyan('Performance Report')} ${chalk.dim(`(last ${days} days)`)}`)
      console.log('═'.repeat(55))

      // Startup time
      if (report.startup) {
        const icon = statusIcon(report.startup.avg, TARGETS.startup.max, 'below')
        console.log(
          `  Startup:     avg ${chalk.bold(`${report.startup.avg}ms`)} ${chalk.dim(`(min ${report.startup.min}, max ${report.startup.max}, n=${report.startup.count})`)} ${icon} ${chalk.dim(`target: <${TARGETS.startup.max}ms`)}`
        )
      }

      // Memory
      if (report.memory) {
        const icon = statusIcon(report.memory.peakHeapMB, TARGETS.heapMB.max, 'below')
        console.log(
          `  Memory:      avg ${chalk.bold(`${report.memory.avgHeapMB}MB`)} heap, peak ${report.memory.peakHeapMB}MB, rss ${report.memory.avgRssMB}MB ${icon} ${chalk.dim(`target: <${TARGETS.heapMB.max}MB`)}`
        )
      }

      // Context correctness
      if (report.contextCorrectness) {
        const icon = statusIcon(report.contextCorrectness.rate, TARGETS.contextRate.min, 'above')
        console.log(
          `  Context:     ${chalk.bold(`${report.contextCorrectness.rate}%`)} tasks received sync ${chalk.dim(`(${report.contextCorrectness.receivedSync}/${report.contextCorrectness.total})`)} ${icon} ${chalk.dim(`target: ${TARGETS.contextRate.min}%`)}`
        )
      }

      // Subtask handoff
      if (report.subtaskHandoff) {
        const icon = statusIcon(report.subtaskHandoff.rate, TARGETS.handoffRate.min, 'above')
        console.log(
          `  Handoff:     ${chalk.bold(`${report.subtaskHandoff.rate}%`)} subtasks with output ${chalk.dim(`(${report.subtaskHandoff.outputPopulated}/${report.subtaskHandoff.total})`)} ${icon} ${chalk.dim(`target: ${TARGETS.handoffRate.min}%`)}`
        )
      }

      // Command durations
      if (report.commandDurations && Object.keys(report.commandDurations).length > 0) {
        console.log(`\n  ${chalk.dim('Command Durations:')}`)
        for (const [cmd, summary] of Object.entries(report.commandDurations)) {
          console.log(
            `    ${cmd.padEnd(12)} avg ${chalk.bold(`${summary.avg}ms`)} ${chalk.dim(`(min ${summary.min}, max ${summary.max}, n=${summary.count})`)}`
          )
        }
      }

      console.log('═'.repeat(55))
      console.log('')

      return { success: true }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }
}
