/**
 * MemoryService - Event logging and memory management
 *
 * Handles logging actions to memory for audit trail and context building.
 */

import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import type { MemoryServiceEntry } from '../types'
import { isNotFoundError } from '../types/fs'
import { getTimestamp } from '../utils/date-helper'
import jsonlHelper from '../utils/jsonl-helper'

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
        console.error(`Memory log error: ${(error as Error).message}`)
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
        console.error(`Memory read error: ${(error as Error).message}`)
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
        console.error(`Memory clear error: ${(error as Error).message}`)
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
        console.error(`Memory read error: ${(error as Error).message}`)
      }
      return []
    }
  }
}

export const memoryService = new MemoryService()
export default memoryService
