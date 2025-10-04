const fs = require('fs').promises
const path = require('path')
const os = require('os')

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
class EditorsConfig {
  constructor() {
    this.homeDir = os.homedir()
    this.configDir = path.join(this.homeDir, '.prjct-cli', 'config')
    this.configFile = path.join(this.configDir, 'installed-editors.json')
  }

  /**
   * Ensure config directory exists
   */
  async ensureConfigDir() {
    try {
      await fs.mkdir(this.configDir, { recursive: true })
    } catch (error) {
      console.error('[editors-config] Error creating config directory:', error.message)
    }
  }

  /**
   * Load installation configuration
   * @returns {Promise<Object|null>} Configuration object or null if not found
   */
  async loadConfig() {
    try {
      const content = await fs.readFile(this.configFile, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null
      }
      console.error('[editors-config] Error loading config:', error.message)
      return null
    }
  }

  /**
   * Save installation configuration
   * @param {string} version - Current prjct-cli version
   * @param {string} claudePath - Path to Claude commands directory
   * @returns {Promise<boolean>} Success status
   */
  async saveConfig(version, claudePath) {
    try {
      await this.ensureConfigDir()

      const config = {
        version,
        editor: 'claude',
        lastInstall: new Date().toISOString(),
        path: claudePath,
      }

      await fs.writeFile(this.configFile, JSON.stringify(config, null, 2), 'utf-8')

      return true
    } catch (error) {
      console.error('[editors-config] Error saving config:', error.message)
      return false
    }
  }

  /**
   * Get last installed version
   * @returns {Promise<string|null>} Version string or null
   */
  async getLastVersion() {
    const config = await this.loadConfig()
    return config ? config.version : null
  }

  /**
   * Check if version has changed since last install
   * @param {string} currentVersion - Current version to compare
   * @returns {Promise<boolean>} True if version has changed
   */
  async hasVersionChanged(currentVersion) {
    const lastVersion = await this.getLastVersion()
    return lastVersion !== null && lastVersion !== currentVersion
  }

  /**
   * Update version in configuration
   * @param {string} version - New version to save
   * @returns {Promise<boolean>} Success status
   */
  async updateVersion(version) {
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
      console.error('[editors-config] Error updating version:', error.message)
      return false
    }
  }

  /**
   * Check if config file exists
   * @returns {Promise<boolean>} True if config exists
   */
  async configExists() {
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
   * @returns {Promise<boolean>} Success status
   */
  async deleteConfig() {
    try {
      const exists = await this.configExists()
      if (exists) {
        await fs.unlink(this.configFile)
      }
      return true
    } catch (error) {
      console.error('[editors-config] Error deleting config:', error.message)
      return false
    }
  }
}

module.exports = new EditorsConfig()
