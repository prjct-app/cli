/**
 * EditorsConfig - Manages Claude installation tracking
 *
 * Tracks prjct commands installation in Claude (Code + Desktop),
 * enabling automatic updates when npm package is updated.
 *
 * Config location: ~/.prjct-cli/config/installed-editors.json
 *
 * @version 0.5.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'

interface EditorConfig {
  version: string
  editor: string
  lastInstall: string
  path: string
}

class EditorsConfig {
  homeDir: string
  configDir: string
  configFile: string

  constructor() {
    this.homeDir = os.homedir()
    this.configDir = path.join(this.homeDir, '.prjct-cli', 'config')
    this.configFile = path.join(this.configDir, 'installed-editors.json')
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
    } catch (error) {
      console.error('[editors-config] Error creating config directory:', (error as Error).message)
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
      console.error('[editors-config] Error loading config:', (error as Error).message)
      return null
    }
  }

  /**
   * Save installation configuration
   */
  async saveConfig(version: string, claudePath: string): Promise<boolean> {
    try {
      await this.ensureConfigDir()

      const config: EditorConfig = {
        version,
        editor: 'claude',
        lastInstall: new Date().toISOString(),
        path: claudePath,
      }

      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf-8')

      return true
    } catch (error) {
      console.error('[editors-config] Error saving config:', (error as Error).message)
      return false
    }
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

      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf-8')

      return true
    } catch (error) {
      console.error('[editors-config] Error updating version:', (error as Error).message)
      return false
    }
  }

  /**
   * Check if config file exists
   */
  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configFile)
      return true
    } catch {
      return false
    }
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
      console.error('[editors-config] Error deleting config:', (error as Error).message)
      return false
    }
  }
}

const editorsConfig = new EditorsConfig()
export default editorsConfig
