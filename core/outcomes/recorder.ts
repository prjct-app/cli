/**
 * Outcome Recorder
 *
 * Records execution outcomes for learning and analysis.
 * Appends to JSONL files for efficient streaming.
 */

import path from 'path'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'
import { generateUUID } from '../schemas'
import type { Outcome, OutcomeInput, OutcomeFilter } from '../types'

const OUTCOMES_DIR = 'outcomes'
const OUTCOMES_FILE = 'outcomes.jsonl'

/**
 * OutcomeRecorder - Records and retrieves execution outcomes.
 */
export class OutcomeRecorder {
  /**
   * Get outcomes directory path for a project.
   */
  private getOutcomesDir(projectId: string): string {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    return path.join(globalPath, OUTCOMES_DIR)
  }

  /**
   * Get outcomes file path for a project.
   */
  private getOutcomesPath(projectId: string): string {
    return path.join(this.getOutcomesDir(projectId), OUTCOMES_FILE)
  }

  /**
   * Record an outcome.
   */
  async record(projectId: string, input: OutcomeInput): Promise<Outcome> {
    const outcome: Outcome = {
      ...input,
      id: generateUUID(),
    }

    const outcomesPath = this.getOutcomesPath(projectId)

    // Ensure directory exists
    await fileHelper.ensureDir(path.dirname(outcomesPath))

    // Append to JSONL
    await fileHelper.appendLine(outcomesPath, JSON.stringify(outcome))

    return outcome
  }

  /**
   * Get all outcomes for a project.
   */
  async getAll(projectId: string): Promise<Outcome[]> {
    const outcomesPath = this.getOutcomesPath(projectId)

    if (!(await fileHelper.fileExists(outcomesPath))) {
      return []
    }

    const content = await fileHelper.readFile(outcomesPath)
    if (!content.trim()) {
      return []
    }

    return content
      .trim()
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as Outcome)
  }

  /**
   * Get outcomes matching a filter.
   */
  async filter(projectId: string, filter: OutcomeFilter): Promise<Outcome[]> {
    const all = await this.getAll(projectId)

    return all.filter((outcome) => {
      if (filter.sessionId && outcome.sessionId !== filter.sessionId) {
        return false
      }
      if (filter.command && outcome.command !== filter.command) {
        return false
      }
      if (filter.agent && outcome.agentUsed !== filter.agent) {
        return false
      }
      if (filter.fromDate && outcome.startedAt < filter.fromDate) {
        return false
      }
      if (filter.toDate && outcome.completedAt > filter.toDate) {
        return false
      }
      if (filter.minQuality && outcome.qualityScore < filter.minQuality) {
        return false
      }
      if (filter.tags && filter.tags.length > 0) {
        const outcomeTags = outcome.tags || []
        if (!filter.tags.some((tag) => outcomeTags.includes(tag))) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Get recent outcomes (last N).
   */
  async getRecent(projectId: string, count: number = 10): Promise<Outcome[]> {
    const all = await this.getAll(projectId)
    return all.slice(-count)
  }

  /**
   * Get outcomes for a specific command.
   */
  async getByCommand(projectId: string, command: string): Promise<Outcome[]> {
    return this.filter(projectId, { command })
  }

  /**
   * Get outcomes for a specific agent.
   */
  async getByAgent(projectId: string, agent: string): Promise<Outcome[]> {
    return this.filter(projectId, { agent })
  }

  /**
   * Calculate estimate accuracy.
   */
  async getEstimateAccuracy(projectId: string): Promise<number> {
    const outcomes = await this.getAll(projectId)

    if (outcomes.length === 0) {
      return 0
    }

    // Count outcomes where variance was within 20%
    const accurate = outcomes.filter((o) => {
      if (!o.variance) return false
      const variance = this.parseVariance(o.variance)
      const estimated = this.parseDuration(o.estimatedDuration)
      if (estimated === 0) return false
      return Math.abs(variance) / estimated <= 0.2
    })

    return Math.round((accurate.length / outcomes.length) * 100)
  }

  /**
   * Parse variance string to minutes.
   * "+30m" → 30, "-15m" → -15
   */
  private parseVariance(variance: string): number {
    const match = variance.match(/^([+-])(\d+)([mh])$/)
    if (!match) return 0

    const sign = match[1] === '-' ? -1 : 1
    const value = parseInt(match[2], 10)
    const unit = match[3]

    return sign * (unit === 'h' ? value * 60 : value)
  }

  /**
   * Parse duration string to minutes.
   * "2h" → 120, "30m" → 30, "1h 30m" → 90
   */
  private parseDuration(duration: string): number {
    let minutes = 0

    const hourMatch = duration.match(/(\d+)h/)
    if (hourMatch) {
      minutes += parseInt(hourMatch[1], 10) * 60
    }

    const minMatch = duration.match(/(\d+)m/)
    if (minMatch) {
      minutes += parseInt(minMatch[1], 10)
    }

    return minutes
  }
}

// Singleton instance
const outcomeRecorder = new OutcomeRecorder()
export default outcomeRecorder
