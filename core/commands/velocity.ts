/**
 * Velocity Commands: velocity
 * Sprint-based velocity dashboard
 *
 * @see PRJ-296
 */

import chalk from 'chalk'
import { calculateVelocity, projectCompletion } from '../domain/velocity'
import outcomeRecorder from '../outcomes/recorder'
import type { VelocityConfig } from '../schemas/velocity'
import { DEFAULT_VELOCITY_CONFIG } from '../schemas/velocity'
import { velocityStorage } from '../storage/velocity-storage'
import type { CommandResult } from '../types'
import { getErrorMessage } from '../types/fs'
import { configManager, out, PrjctCommandsBase } from './base'

export class VelocityCommands extends PrjctCommandsBase {
  /**
   * prjct velocity - Velocity dashboard
   */
  async velocity(
    backlogPoints: string = '0',
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Load velocity config from project config (or defaults)
      const config = await this.loadVelocityConfig(projectPath)

      // Load all outcomes
      const outcomes = await outcomeRecorder.getAll(projectId)

      if (outcomes.length === 0) {
        console.log(`\n${chalk.dim('No velocity data yet.')}`)
        console.log(`${chalk.dim('Complete tasks with estimates to build velocity history.')}\n`)
        return { success: true, message: 'No data' }
      }

      // Calculate velocity metrics
      const metrics = calculateVelocity(outcomes, config)

      // Save for context injection
      await velocityStorage.saveMetrics(projectId, metrics)

      // Render dashboard
      console.log(
        `\n${chalk.cyan('Sprint Velocity')} ${chalk.dim(`(last ${config.windowSize ?? 6} sprints)`)}`
      )
      console.log('═'.repeat(60))

      // Sprint table
      const recentSprints = metrics.sprints.slice(-(config.windowSize ?? 6))
      for (const sprint of recentSprints) {
        const accuracyColor =
          sprint.estimationAccuracy >= 80
            ? chalk.green
            : sprint.estimationAccuracy >= 60
              ? chalk.yellow
              : chalk.red
        console.log(
          `  Sprint ${String(sprint.sprintNumber).padStart(2)}: ${chalk.bold(`${sprint.pointsCompleted} pts`)} | ${sprint.tasksCompleted} tasks | accuracy: ${accuracyColor(`${sprint.estimationAccuracy}%`)}`
        )
      }

      console.log('')
      const trendIcon =
        metrics.velocityTrend === 'improving'
          ? chalk.green('↑')
          : metrics.velocityTrend === 'declining'
            ? chalk.red('↓')
            : chalk.dim('→')
      console.log(
        `  Average: ${chalk.bold(`${metrics.averageVelocity} pts/sprint`)} | Trend: ${trendIcon} ${metrics.velocityTrend}`
      )
      console.log(
        `  Estimation accuracy: ${chalk.bold(`${metrics.estimationAccuracy}%`)} ${chalk.dim(`(±${config.accuracyTolerance ?? 20}% tolerance)`)}`
      )

      // Patterns
      if (metrics.underEstimated.length > 0 || metrics.overEstimated.length > 0) {
        console.log(`\n  ${chalk.dim('Patterns:')}`)
        for (const p of metrics.underEstimated) {
          console.log(
            `    ${chalk.yellow('⚠')} ${p.category} tasks underestimated by avg ${chalk.bold(`${p.avgVariance}%`)}`
          )
        }
        for (const p of metrics.overEstimated) {
          console.log(
            `    ${chalk.green('✓')} ${p.category} tasks estimated within ${chalk.bold(`${p.avgVariance}%`)}`
          )
        }
      }

      // Projection (if backlog points provided)
      const points = parseInt(backlogPoints, 10)
      if (points > 0 && metrics.averageVelocity > 0) {
        const projection = projectCompletion(points, metrics.averageVelocity, config)
        const dateStr = projection.estimatedDate
          ? new Date(projection.estimatedDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'unknown'
        console.log(`\n  ${chalk.dim('Projection:')}`)
        console.log(`    Backlog: ${chalk.bold(`${points} pts`)} remaining`)
        console.log(
          `    At current velocity: ~${projection.sprints} sprints (${projection.sprints * (config.sprintLengthDays ?? 7)} days)`
        )
        console.log(`    Estimated completion: ${chalk.bold(dateStr)}`)
      }

      console.log('═'.repeat(60))
      console.log('')

      return { success: true }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Load velocity config from project or use defaults.
   * Velocity config can be added to prjct.config.json as { velocity: { sprintLengthDays, ... } }
   */
  private async loadVelocityConfig(projectPath: string): Promise<VelocityConfig> {
    try {
      const config = await configManager.readConfig(projectPath)
      // Read velocity config from extended config (not typed in LocalConfig yet)
      const raw = config as Record<string, unknown> | null
      if (raw?.velocity && typeof raw.velocity === 'object') {
        return { ...DEFAULT_VELOCITY_CONFIG, ...(raw.velocity as Partial<VelocityConfig>) }
      }
    } catch {
      // Use defaults
    }
    return DEFAULT_VELOCITY_CONFIG
  }
}
