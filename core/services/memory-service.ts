/**
 * MemoryService - Event logging and memory management
 *
 * Handles logging actions to memory for audit trail and context building.
 */

import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { ARCHIVE_POLICIES, archiveStorage } from '../storage/archive-storage'
import type { MemoryServiceEntry } from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { getTimestamp } from '../utils/date-helper'
import * as jsonlHelper from '../utils/jsonl-helper'

export class MemoryService {
  /**
   * Log an action to memory
   */
  async log(
    projectPath: string,
    action: string,
    data: Record<string, unknown>,
    author?: string
  ): Promise<void> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) return

      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')

      const entry: MemoryServiceEntry = {
        timestamp: getTimestamp(),
        action,
        data,
        author,
      }

      await jsonlHelper.appendJsonLine(memoryPath, entry)
    } catch (error) {
      // Non-critical - don't fail the command, but log unexpected errors
      if (!isNotFoundError(error)) {
        console.error(`Memory log error: ${getErrorMessage(error)}`)
      }
    }
  }

  /**
   * Get recent memory entries
   */
  async getRecent(projectPath: string, limit: number = 100): Promise<MemoryServiceEntry[]> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) return []

      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      const entries = await jsonlHelper.readJsonLines<MemoryServiceEntry>(memoryPath)
      return entries.slice(-limit)
    } catch (error) {
      // ENOENT or parse error - return empty (expected for new projects)
      if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
        console.error(`Memory read error: ${getErrorMessage(error)}`)
      }
      return []
    }
  }

  /**
   * Search memory for entries matching a pattern
   */
  async search(
    projectPath: string,
    pattern: string,
    limit: number = 50
  ): Promise<MemoryServiceEntry[]> {
    const entries = await this.getRecent(projectPath, 1000)
    const patternLower = pattern.toLowerCase()

    return entries
      .filter((entry) => {
        const actionMatch = entry.action.toLowerCase().includes(patternLower)
        const dataMatch = JSON.stringify(entry.data).toLowerCase().includes(patternLower)
        return actionMatch || dataMatch
      })
      .slice(-limit)
  }

  /**
   * Get entries for a specific action type
   */
  async getByAction(
    projectPath: string,
    action: string,
    limit: number = 50
  ): Promise<MemoryServiceEntry[]> {
    const entries = await this.getRecent(projectPath, 1000)
    return entries.filter((entry) => entry.action === action).slice(-limit)
  }

  /**
   * Clear memory (for testing or cleanup)
   */
  async clear(projectPath: string): Promise<void> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) return

      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      await jsonlHelper.writeJsonLines(memoryPath, [])
    } catch (error) {
      // Non-critical - but log unexpected errors
      if (!isNotFoundError(error)) {
        console.error(`Memory clear error: ${getErrorMessage(error)}`)
      }
    }
  }

  /**
   * Get recent events by projectId (for stats dashboard)
   * @see PRJ-89
   */
  async getRecentEvents(
    projectId: string,
    limit: number = 100
  ): Promise<Record<string, unknown>[]> {
    try {
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      const entries = await jsonlHelper.readJsonLines<Record<string, unknown>>(memoryPath)
      return entries.slice(-limit)
    } catch (error) {
      // ENOENT or parse error - return empty
      if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
        console.error(`Memory read error: ${getErrorMessage(error)}`)
      }
      return []
    }
  }

  /**
   * Cap memory log at max entries (PRJ-267).
   * Moves overflow entries to archive table, keeps most recent entries.
   * Returns count of archived entries.
   */
  async capEntries(projectId: string): Promise<number> {
    try {
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      const entries = await jsonlHelper.readJsonLines<MemoryServiceEntry>(memoryPath)

      if (entries.length <= ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES) {
        return 0
      }

      const overflow = entries.slice(0, entries.length - ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES)
      const kept = entries.slice(-ARCHIVE_POLICIES.MEMORY_MAX_ENTRIES)

      // Archive overflow entries in batch
      archiveStorage.archiveMany(
        projectId,
        overflow.map((entry, i) => ({
          entityType: 'memory_entry' as const,
          entityId: `memory-${entry.timestamp || i}`,
          entityData: entry,
          summary: entry.action,
          reason: 'overflow',
        }))
      )

      // Rewrite file with only kept entries
      await jsonlHelper.writeJsonLines(memoryPath, kept)

      return overflow.length
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error(`Memory cap error: ${getErrorMessage(error)}`)
      }
      return 0
    }
  }
}

export const memoryService = new MemoryService()
export default memoryService
