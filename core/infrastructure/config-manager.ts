/**
 * ConfigManager - Manages prjct.config.json files
 *
 * Key responsibilities:
 * - Read and write prjct.config.json (supports .jsonc with comments)
 * - Validate configuration structure
 * - Create new configurations
 * - Update existing configurations
 *
 * @version 0.3.0
 */

import fs from 'fs/promises'
import path from 'path'
import * as jsonc from 'jsonc-parser'
import pathManager from './path-manager'
import authorDetector from './author-detector'
import { VERSION } from '../utils/version'
import { getTimestamp } from '../utils/date-helper'
import { getErrorMessage } from '../errors'
import { isNotFoundError } from '../types/fs'
import type { Author, LocalConfig, GlobalConfig } from '../types'

// Re-export types for convenience
export type { Author, LocalConfig, GlobalConfig } from '../types'

/**
 * Parse JSON or JSONC content safely
 * Supports comments (line and block style) in config files
 */
function parseJsonc<T>(content: string): T {
  const errors: jsonc.ParseError[] = []
  const result = jsonc.parse(content, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  })
  if (errors.length > 0) {
    const firstError = errors[0]
    throw new SyntaxError(`JSON parse error at offset ${firstError.offset}: ${jsonc.printParseErrorCode(firstError.error)}`)
  }
  return result
}

class ConfigManager {
  /**
   * Read the project configuration file
   * Supports both .json and .jsonc formats (with comments)
   */
  async readConfig(projectPath: string): Promise<LocalConfig | null> {
    try {
      const configPath = pathManager.getLocalConfigPath(projectPath)
      const content = await fs.readFile(configPath, 'utf-8')
      return parseJsonc<LocalConfig>(content)
    } catch (error) {
      // File not found is expected - return null
      if (isNotFoundError(error)) {
        return null
      }
      // JSON parse errors or other issues - log and return null
      console.warn(`Warning: Could not read config at ${projectPath}: ${getErrorMessage(error)}`)
      return null
    }
  }

  /**
   * Write the project configuration file
   */
  async writeConfig(projectPath: string, config: LocalConfig): Promise<void> {
    const configPath = pathManager.getLocalConfigPath(projectPath)
    const configDir = pathManager.getLegacyPrjctPath(projectPath)

    await fs.mkdir(configDir, { recursive: true })

    const content = JSON.stringify(config, null, 2)
    await fs.writeFile(configPath, content + '\n', 'utf-8')
  }

  /**
   * Read the global project configuration file
   * Contains authors array and other system data
   * Supports both .json and .jsonc formats (with comments)
   */
  async readGlobalConfig(projectId: string): Promise<GlobalConfig | null> {
    try {
      const configPath = pathManager.getGlobalProjectConfigPath(projectId)
      const content = await fs.readFile(configPath, 'utf-8')
      return parseJsonc<GlobalConfig>(content)
    } catch (error) {
      // File not found is expected for new projects
      if (isNotFoundError(error)) {
        return null
      }
      // Log other errors for debugging
      console.warn(`Warning: Could not read global config for ${projectId}: ${getErrorMessage(error)}`)
      return null
    }
  }

  /**
   * Write the global project configuration file
   */
  async writeGlobalConfig(projectId: string, config: GlobalConfig): Promise<void> {
    const configPath = pathManager.getGlobalProjectConfigPath(projectId)
    const configDir = pathManager.getGlobalProjectPath(projectId)

    await fs.mkdir(configDir, { recursive: true })

    const content = JSON.stringify(config, null, 2)
    await fs.writeFile(configPath, content + '\n', 'utf-8')
  }

  /**
   * Ensure global config exists, create if not
   */
  async ensureGlobalConfig(projectId: string): Promise<GlobalConfig> {
    let globalConfig = await this.readGlobalConfig(projectId)

    if (!globalConfig) {
      const now = getTimestamp()
      globalConfig = {
        projectId,
        authors: [],
        version: VERSION,
        lastSync: now,
      }
      await this.writeGlobalConfig(projectId, globalConfig)
    }

    return globalConfig
  }

  /**
   * Create a new project configuration
   */
  async createConfig(
    projectPath: string,
    author: { name?: string; email?: string; github?: string }
  ): Promise<LocalConfig> {
    const projectId = pathManager.generateProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const displayPath = pathManager.getDisplayPath(globalPath)
    const now = getTimestamp()

    const localConfig: LocalConfig = {
      projectId,
      dataPath: displayPath,
    }

    await this.writeConfig(projectPath, localConfig)

    const globalConfig: GlobalConfig = {
      projectId,
      authors: [
        {
          name: author.name || 'Unknown',
          email: author.email || '',
          github: author.github || '',
          firstContribution: now,
          lastActivity: now,
        },
      ],
      version: VERSION,
      created: now,
      lastSync: now,
    }

    await this.writeGlobalConfig(projectId, globalConfig)

    return localConfig
  }

  /**
   * Update the lastSync timestamp in global config
   */
  async updateLastSync(projectPath: string): Promise<void> {
    const projectId = await this.getProjectId(projectPath)
    const globalConfig = await this.readGlobalConfig(projectId)
    if (globalConfig) {
      globalConfig.lastSync = getTimestamp()
      await this.writeGlobalConfig(projectId, globalConfig)
    }
  }

  /**
   * Validate a local configuration object
   * Local config only contains project metadata (projectId, dataPath)
   * All system data (version, created, lastSync, authors) is in global config
   */
  validateConfig(config: LocalConfig | null): boolean {
    if (!config) return false
    if (!config.projectId) return false
    if (!config.dataPath) return false

    return true
  }

  /**
   * Check if a project needs migration
   * Migration is needed if:
   * - Has legacy .prjct/ structure
   * - AND either no config exists OR files not yet in global location
   */
  async needsMigration(projectPath: string): Promise<boolean> {
    const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
    if (!hasLegacy) return false

    const hasConfig = await pathManager.hasConfig(projectPath)

    if (!hasConfig) return true

    const config = await this.readConfig(projectPath)
    if (!config || !config.projectId) return true

    const globalPath = pathManager.getGlobalProjectPath(config.projectId)

    try {
      const coreFiles = await fs.readdir(path.join(globalPath, 'core'))
      return coreFiles.length === 0
    } catch (error) {
      // Directory not found means migration needed
      if (isNotFoundError(error)) {
        return true
      }
      // Permission errors or other issues - assume migration needed
      return true
    }
  }

  /**
   * Get the project ID from config, or generate it if config doesn't exist
   */
  async getProjectId(projectPath: string): Promise<string> {
    const config = await this.readConfig(projectPath)
    if (config && config.projectId) {
      return config.projectId
    }
    return pathManager.generateProjectId(projectPath)
  }

  /**
   * Find an author in the authors array by github username
   * Reads from GLOBAL config
   */
  async findAuthor(projectId: string, githubUsername: string): Promise<Author | null> {
    const globalConfig = await this.readGlobalConfig(projectId)
    if (!globalConfig || !globalConfig.authors) return null

    return globalConfig.authors.find((a) => a.github === githubUsername) || null
  }

  /**
   * Add a new author to the authors array
   * Writes to GLOBAL config
   */
  async addAuthor(
    projectId: string,
    author: { name?: string; email?: string; github?: string }
  ): Promise<void> {
    const globalConfig = await this.ensureGlobalConfig(projectId)

    const exists = globalConfig.authors.some((a) => a.github === author.github)
    if (exists) return

    const now = getTimestamp()
    globalConfig.authors.push({
      name: author.name || 'Unknown',
      email: author.email || '',
      github: author.github || '',
      firstContribution: now,
      lastActivity: now,
    })

    globalConfig.lastSync = now
    await this.writeGlobalConfig(projectId, globalConfig)
  }

  /**
   * Update author's last activity timestamp
   * Updates GLOBAL config
   */
  async updateAuthorActivity(projectId: string, githubUsername: string): Promise<void> {
    const globalConfig = await this.readGlobalConfig(projectId)
    if (!globalConfig || !globalConfig.authors) return

    const author = globalConfig.authors.find((a) => a.github === githubUsername)
    if (author) {
      author.lastActivity = getTimestamp()
      globalConfig.lastSync = author.lastActivity
      await this.writeGlobalConfig(projectId, globalConfig)
    }
  }

  /**
   * Get current author for session (detect or get from global config)
   */
  async getCurrentAuthor(projectPath: string): Promise<string> {
    const author = await authorDetector.detect()

    const projectId = await this.getProjectId(projectPath)
    await this.addAuthor(projectId, {
      name: author.name ?? undefined,
      email: author.email ?? undefined,
      github: author.github ?? undefined
    })

    return author.github || author.name || 'Unknown'
  }

  /**
   * Check if config exists and is valid
   */
  async isConfigured(projectPath: string): Promise<boolean> {
    const config = await this.readConfig(projectPath)
    return this.validateConfig(config)
  }

  /**
   * Get configuration with defaults
   * Returns LOCAL config only (projectId, dataPath)
   */
  async getConfigWithDefaults(projectPath: string): Promise<LocalConfig> {
    const config = await this.readConfig(projectPath)
    if (config) {
      return config
    }

    const projectId = pathManager.generateProjectId(projectPath)
    return {
      projectId,
      dataPath: pathManager.getDisplayPath(pathManager.getGlobalProjectPath(projectId)),
    }
  }
}

const configManager = new ConfigManager()
export default configManager
