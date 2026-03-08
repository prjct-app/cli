/**
 * Outcome Recorder
 *
 * Records execution outcomes for learning and analysis.
 * Appends to JSONL files for efficient streaming.
 */

import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { generateUUID } from '../schemas/schemas'
import type { Outcome, OutcomeFilter, OutcomeInput } from '../types/outcomes'
import { parseDurationMinutes, parseVarianceMinutes } from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'

const OUTCOMES_DIR = 'outcomes'
const OUTCOMES_FILE = 'outcomes.jsonl'

interface CacheEntry {
  outcomes: Outcome[]
  mtime: number
}

/**
 * OutcomeRecorder - Records and retrieves execution outcomes.
 */
export class OutcomeRecorder {
  private _cache = new Map<string, CacheEntry>()

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

    // Invalidate cache on write
    this._cache.delete(projectId)

    return outcome
  }

  /**
   * Get all outcomes for a project (mtime-cached).
   */
  async getAll(projectId: string): Promise<Outcome[]> {
    const outcomesPath = this.getOutcomesPath(projectId)

    if (!(await fileHelper.fileExists(outcomesPath))) {
      return []
    }

    // Check mtime-based cache
    try {
      const { statSync } = await import('node:fs')
      const stat = statSync(outcomesPath)
      const mtime = stat.mtimeMs
      const cached = this._cache.get(projectId)
      if (cached && cached.mtime === mtime) {
        return cached.outcomes
      }

      const content = await fileHelper.readFile(outcomesPath)
      if (!content.trim()) {
        return []
      }

      const outcomes = content
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as Outcome)

      this._cache.set(projectId, { outcomes, mtime })
      return outcomes
    } catch {
      // Fallback to direct read without caching
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
      const variance = parseVarianceMinutes(o.variance)
      const estimated = parseDurationMinutes(o.estimatedDuration)
      if (estimated === 0) return false
      return Math.abs(variance) / estimated <= 0.2
    })

    return Math.round((accurate.length / outcomes.length) * 100)
  }
}

// Singleton instance
const outcomeRecorder = new OutcomeRecorder()
export default outcomeRecorder
