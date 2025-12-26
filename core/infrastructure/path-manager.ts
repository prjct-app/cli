/**
 * PathManager - Manages project paths between local and global storage
 *
 * Key responsibilities:
 * - Generate unique project identifiers from project paths
 * - Manage paths between local project and global storage
 * - Ensure directory structures exist
 *
 * @version 0.2.1
 */

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import os from 'os'
import * as dateHelper from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'
import type { SessionInfo, LayerType } from './path.types'

// Re-export types for convenience
export type { SessionInfo, LayerType } from './path.types'

class PathManager {
  globalBaseDir: string
  globalProjectsDir: string
  globalConfigDir: string

  constructor() {
    const envOverride = process.env.PRJCT_CLI_HOME?.trim()
    this.globalBaseDir = envOverride ? path.resolve(envOverride) : path.join(os.homedir(), '.prjct-cli')
    this.globalProjectsDir = path.join(this.globalBaseDir, 'projects')
    this.globalConfigDir = path.join(this.globalBaseDir, 'config')
  }

  /**
   * Override global storage location (primarily for tests and sandboxed environments).
   *
   * When unset, global storage defaults to `~/.prjct-cli/`.
   *
   * @param {string} globalBaseDir - Base directory that will contain `projects/` and `config/`.
   */
  setGlobalBaseDir(globalBaseDir: string): void {
    this.globalBaseDir = path.resolve(globalBaseDir)
    this.globalProjectsDir = path.join(this.globalBaseDir, 'projects')
    this.globalConfigDir = path.join(this.globalBaseDir, 'config')
  }

  /**
   * Generate a unique project ID using UUID.
   * Standard UUID format for PostgreSQL consistency.
   */
  generateProjectId(_projectPath: string): string {
    return crypto.randomUUID()
  }

  /**
   * Get the base global storage path
   */
  getGlobalBasePath(): string {
    return this.globalBaseDir
  }

  /**
   * Get the global storage path for a project
   */
  getGlobalProjectPath(projectId: string): string {
    return path.join(this.globalProjectsDir, projectId)
  }

  /**
   * Get the local config file path for a project
   */
  getLocalConfigPath(projectPath: string): string {
    return path.join(projectPath, '.prjct', 'prjct.config.json')
  }

  /**
   * Get the global config file path for a project
   * This file stores authors and other system data that shouldn't be versioned
   */
  getGlobalProjectConfigPath(projectId: string): string {
    return path.join(this.getGlobalProjectPath(projectId), 'project.json')
  }

  /**
   * Get the legacy .prjct directory path
   */
  getLegacyPrjctPath(projectPath: string): string {
    return path.join(projectPath, '.prjct')
  }

  /**
   * Check if a project has legacy .prjct directory
   */
  async hasLegacyStructure(projectPath: string): Promise<boolean> {
    const legacyPath = this.getLegacyPrjctPath(projectPath)
    return await fileHelper.dirExists(legacyPath)
  }

  /**
   * Check if a project has the new config file
   */
  async hasConfig(projectPath: string): Promise<boolean> {
    const configPath = this.getLocalConfigPath(projectPath)
    return await fileHelper.fileExists(configPath)
  }

  /**
   * Ensure the global directory structure exists
   * Creates all necessary directories in ~/.prjct-cli/
   */
  async ensureGlobalStructure(): Promise<void> {
    await fileHelper.ensureDir(this.globalBaseDir)
    await fileHelper.ensureDir(this.globalProjectsDir)
    await fileHelper.ensureDir(this.globalConfigDir)
  }

  /**
   * Ensure the project-specific global structure exists
   * Creates the layered directory structure for a project
   */
  async ensureProjectStructure(projectId: string): Promise<string> {
    await this.ensureGlobalStructure()

    const projectPath = this.getGlobalProjectPath(projectId)

    const layers = ['core', 'progress', 'planning', 'analysis', 'memory', 'agents']

    for (const layer of layers) {
      await fileHelper.ensureDir(path.join(projectPath, layer))
    }

    await fileHelper.ensureDir(path.join(projectPath, 'planning', 'tasks'))
    await fileHelper.ensureDir(path.join(projectPath, 'sessions'))

    return projectPath
  }

  /**
   * Get session directory path for a specific date
   * Creates hierarchical structure: sessions/YYYY/MM/DD/
   */
  getSessionPath(projectId: string, date: Date = new Date()): string {
    const { year, month, day } = dateHelper.getYearMonthDay(date)

    return path.join(this.getGlobalProjectPath(projectId), 'sessions', year, month, day)
  }

  /**
   * Get current session directory path (today)
   */
  getCurrentSessionPath(projectId: string): string {
    return this.getSessionPath(projectId, new Date())
  }

  /**
   * Ensure session directory exists for a specific date
   */
  async ensureSessionPath(projectId: string, date: Date = new Date()): Promise<string> {
    const sessionPath = this.getSessionPath(projectId, date)
    await fileHelper.ensureDir(sessionPath)
    return sessionPath
  }

  /**
   * List all session dates for a project
   */
  async listSessions(
    projectId: string,
    year: number | null = null,
    month: number | null = null
  ): Promise<SessionInfo[]> {
    const sessionsDir = path.join(this.getGlobalProjectPath(projectId), 'sessions')
    const sessions: SessionInfo[] = []

    try {
      const years = await fs.readdir(sessionsDir, { withFileTypes: true })

      for (const yearEntry of years) {
        if (!yearEntry.isDirectory()) continue
        if (year && yearEntry.name !== year.toString()) continue

        const yearPath = path.join(sessionsDir, yearEntry.name)
        const months = await fs.readdir(yearPath, { withFileTypes: true })

        for (const monthEntry of months) {
          if (!monthEntry.isDirectory()) continue
          if (month && monthEntry.name !== month.toString().padStart(2, '0')) continue

          const monthPath = path.join(yearPath, monthEntry.name)
          const days = await fs.readdir(monthPath, { withFileTypes: true })

          for (const dayEntry of days) {
            if (!dayEntry.isDirectory()) continue

            sessions.push({
              year: yearEntry.name,
              month: monthEntry.name,
              day: dayEntry.name,
              path: path.join(monthPath, dayEntry.name),
              date: new Date(`${yearEntry.name}-${monthEntry.name}-${dayEntry.name}`),
            })
          }
        }
      }

      sessions.sort((a, b) => b.date.getTime() - a.date.getTime())
      return sessions
    } catch {
      return []
    }
  }

  /**
   * Get sessions within a date range
   */
  async getSessionsInRange(
    projectId: string,
    fromDate: Date,
    toDate: Date = new Date()
  ): Promise<SessionInfo[]> {
    const allSessions = await this.listSessions(projectId)

    return allSessions.filter((session) => session.date >= fromDate && session.date <= toDate)
  }

  /**
   * Get the path for a specific file in the global structure
   */
  getFilePath(projectId: string, layer: string, filename: string): string {
    return path.join(this.getGlobalProjectPath(projectId), layer, filename)
  }

  /**
   * Get all project IDs in global storage
   */
  async listProjects(): Promise<string[]> {
    try {
      await this.ensureGlobalStructure()
      const entries = await fs.readdir(this.globalProjectsDir, { withFileTypes: true })
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
    } catch {
      return []
    }
  }

  /**
   * Check if a project exists in global storage
   */
  async projectExists(projectId: string): Promise<boolean> {
    const projectPath = this.getGlobalProjectPath(projectId)
    return await fileHelper.dirExists(projectPath)
  }

  /**
   * Get the relative path from home directory for display
   */
  getDisplayPath(absolutePath: string): string {
    const homeDir = os.homedir()
    if (absolutePath.startsWith(homeDir)) {
      return absolutePath.replace(homeDir, '~')
    }
    return absolutePath
  }

  /**
   * Get the auth config file path for cloud sync
   * Stored in global config directory, not project-specific
   */
  getAuthConfigPath(): string {
    return path.join(this.globalConfigDir, 'auth.json')
  }

  /**
   * Get the sync pending events file path for a project
   */
  getSyncPendingPath(projectId: string): string {
    return path.join(this.getGlobalProjectPath(projectId), 'sync', 'pending.json')
  }

  /**
   * Get the last sync timestamp file path for a project
   */
  getLastSyncPath(projectId: string): string {
    return path.join(this.getGlobalProjectPath(projectId), 'sync', 'last-sync.json')
  }

  /**
   * Get the running status file path (for status signal)
   * Used to indicate when prjct CLI is actively running
   */
  getRunningStatusPath(): string {
    return path.join(this.globalBaseDir, '.running')
  }

  /**
   * Get the docs directory path
   * Contains documentation and help files
   */
  getDocsPath(): string {
    return path.join(this.globalBaseDir, 'docs')
  }

  /**
   * Get the agents directory path for a project
   * If projectId is null, returns the global agents directory
   */
  getAgentsPath(projectId: string | null): string {
    if (projectId) {
      return path.join(this.getGlobalProjectPath(projectId), 'agents')
    }
    return path.join(this.globalBaseDir, 'agents')
  }

  /**
   * Get the storage file path for a project
   * Convenience method for accessing storage layer files
   */
  getStoragePath(projectId: string, filename: string): string {
    return path.join(this.getGlobalProjectPath(projectId), 'storage', filename)
  }

  /**
   * Get the context directory path for a project
   * Contains generated markdown context files
   */
  getContextPath(projectId: string): string {
    return path.join(this.getGlobalProjectPath(projectId), 'context')
  }
}

const pathManager = new PathManager()
export default pathManager
