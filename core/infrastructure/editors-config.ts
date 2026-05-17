/**
 * EditorsConfig - Manages AI CLI installation tracking
 *
 * Tracks prjct commands installation in AI CLIs (Claude Code, Gemini CLI),
 * enabling automatic updates when npm package is updated.
 *
 * Config location: ~/.prjct-cli/config/installed-editors.json
 *
 * @version 0.6.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import type { AIProviderName } from '../types/provider'
import { fileExists, writeJson } from '../utils/file-helper'
import pathManager from './path-manager'

interface EditorConfig {
  version: string
  /** AI provider name (claude or gemini) */
  provider: AIProviderName
  lastInstall: string
  path: string
}

class EditorsConfig {
  // Resolve via pathManager so PRJCT_CLI_HOME (and test-time
  // setGlobalBaseDir overrides) are honored. Getters, not constructor
  // snapshots: the singleton is built at import — before any override —
  // so a frozen path would be stale. In production (no PRJCT_CLI_HOME)
  // this is exactly `~/.prjct-cli/config`, so behavior is unchanged.
  get configDir(): string {
    return pathManager.globalConfigDir
  }

  get configFile(): string {
    return path.join(this.configDir, 'installed-editors.json')
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
    } catch (error) {
      console.error('[editors-config] Error creating config directory:', getErrorMessage(error))
    }
  }

  /**
   * Load installation configuration
   */
  async loadConfig(): Promise<EditorConfig | null> {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null
      }
      console.error('[editors-config] Error loading config:', getErrorMessage(error))
      return null
    }
  }

  /**
   * Save installation configuration
   */
  async saveConfig(
    version: string,
    installPath: string,
    provider: AIProviderName = 'claude'
  ): Promise<boolean> {
    try {
      await this.ensureConfigDir()

      const config: EditorConfig = {
        version,
        provider,
        lastInstall: new Date().toISOString(),
        path: installPath,
      }

      await writeJson(this.configFile, config)

      return true
    } catch (error) {
      console.error('[editors-config] Error saving config:', getErrorMessage(error))
      return false
    }
  }

  /**
   * Get the configured provider
   */
  async getProvider(): Promise<AIProviderName | null> {
    const config = await this.loadConfig()
    if (!config) return null
    return config.provider || 'claude'
  }

  /**
   * Get last installed version
   */
  async getLastVersion(): Promise<string | null> {
    const config = await this.loadConfig()
    return config ? config.version : null
  }

  /**
   * Check if version has changed since last install
   */
  async hasVersionChanged(currentVersion: string): Promise<boolean> {
    const lastVersion = await this.getLastVersion()
    return lastVersion !== null && lastVersion !== currentVersion
  }

  /**
   * Update version in configuration
   */
  async updateVersion(version: string): Promise<boolean> {
    try {
      const config = await this.loadConfig()
      if (!config) {
        return false
      }

      config.version = version
      config.lastInstall = new Date().toISOString()

      await writeJson(this.configFile, config)

      return true
    } catch (error) {
      console.error('[editors-config] Error updating version:', getErrorMessage(error))
      return false
    }
  }

  /**
   * Check if config file exists
   */
  async configExists(): Promise<boolean> {
    return fileExists(this.configFile)
  }

  /**
   * Delete configuration file
   * Used during uninstallation to clean up tracking data
   */
  async deleteConfig(): Promise<boolean> {
    try {
      const exists = await this.configExists()
      if (exists) {
        await fs.unlink(this.configFile)
      }
      return true
    } catch (error) {
      console.error('[editors-config] Error deleting config:', getErrorMessage(error))
      return false
    }
  }
}

const editorsConfig = new EditorsConfig()
export default editorsConfig
