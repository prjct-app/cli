/**
 * ProjectService - Project detection, validation, and path resolution
 *
 * Handles project initialization detection, author management, and directory analysis.
 */

import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import authorDetector from '../infrastructure/author-detector'
import * as fileHelper from '../utils/file-helper'
import out from '../utils/output'
import type { Author, CommandResult } from '../types'
import { ProjectError } from '../errors'

export class ProjectService {
  private currentAuthor: Author | null = null

  /**
   * Ensure project is initialized
   */
  async ensureInit(projectPath: string): Promise<CommandResult> {
    if (await configManager.isConfigured(projectPath)) {
      return { success: true }
    }

    out.spin('initializing project...')
    // Lazy import to avoid circular dependency
    const { PlanningCommands } = await import('../commands/planning')
    const planning = new PlanningCommands()
    const initResult = await planning.init(null, projectPath)

    if (!initResult.success) {
      return initResult
    }
    return { success: true }
  }

  /**
   * Get project ID for a path
   */
  async getProjectId(projectPath: string): Promise<string> {
    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      throw ProjectError.notInitialized()
    }
    return projectId
  }

  /**
   * Get global storage path for a project
   */
  async getGlobalPath(projectPath: string): Promise<string> {
    const projectId = await this.getProjectId(projectPath)
    await pathManager.ensureProjectStructure(projectId)
    return pathManager.getGlobalProjectPath(projectId)
  }

  /**
   * Ensure author information is loaded
   */
  async ensureAuthor(): Promise<Author> {
    if (this.currentAuthor) return this.currentAuthor

    const authorObj = await authorDetector.detect()
    this.currentAuthor = {
      name: authorObj.name ?? undefined,
      email: authorObj.email ?? undefined,
      github: authorObj.github ?? undefined,
    }
    return this.currentAuthor
  }

  /**
   * Get current author
   */
  getCurrentAuthor(): Author | null {
    return this.currentAuthor
  }

  /**
   * Clear cached author (useful for tests)
   */
  clearAuthorCache(): void {
    this.currentAuthor = null
  }

  /**
   * Check if directory is empty (excluding common files)
   */
  async isEmptyDirectory(projectPath: string): Promise<boolean> {
    try {
      const entries = await fileHelper.listFiles(projectPath)
      const meaningfulFiles = entries.filter(
        (name) =>
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'package.json' &&
          name !== 'package-lock.json' &&
          name !== 'README.md'
      )
      return meaningfulFiles.length === 0
    } catch {
      return true
    }
  }

  /**
   * Check if directory has existing code
   */
  async hasExistingCode(projectPath: string): Promise<boolean> {
    try {
      const codePatterns = [
        'src',
        'lib',
        'app',
        'components',
        'pages',
        'api',
        'main.go',
        'main.rs',
        'main.py',
      ]
      const entries = await fileHelper.listFiles(projectPath)
      return entries.some((name) => codePatterns.includes(name))
    } catch {
      return false
    }
  }

  /**
   * Check if project is configured
   */
  async isConfigured(projectPath: string): Promise<boolean> {
    return await configManager.isConfigured(projectPath)
  }

  /**
   * Check if project needs migration
   */
  async needsMigration(projectPath: string): Promise<boolean> {
    return await configManager.needsMigration(projectPath)
  }
}

export const projectService = new ProjectService()
export default projectService
