const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * EditorsConfig - Manages installed editors tracking configuration
 *
 * Tracks which AI editors user has installed prjct commands to,
 * enabling automatic updates when npm package is updated.
 *
 * Config location: ~/.prjct-cli/config/installed-editors.json
 *
 * @version 0.4.2
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
   * Load installed editors configuration
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
   * Save installed editors configuration
   * @param {string[]} editors - Array of editor keys (e.g., ['claude', 'cursor'])
   * @param {Object} paths - Object mapping editor keys to installation paths
   * @param {string} version - Current prjct-cli version
   * @returns {Promise<boolean>} Success status
   */
  async saveConfig(editors, paths, version) {
    try {
      await this.ensureConfigDir()

      const config = {
        version,
        editors,
        lastInstall: new Date().toISOString(),
        paths,
      }

      await fs.writeFile(
        this.configFile,
        JSON.stringify(config, null, 2),
        'utf-8',
      )

      return true
    } catch (error) {
      console.error('[editors-config] Error saving config:', error.message)
      return false
    }
  }

  /**
   * Get tracked editors from configuration
   * @returns {Promise<string[]>} Array of editor keys
   */
  async getTrackedEditors() {
    const config = await this.loadConfig()
    return config ? config.editors : []
  }

  /**
   * Get editor paths from configuration
   * @returns {Promise<Object>} Object mapping editor keys to paths
   */
  async getEditorPaths() {
    const config = await this.loadConfig()
    return config ? config.paths : {}
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

      await fs.writeFile(
        this.configFile,
        JSON.stringify(config, null, 2),
        'utf-8',
      )

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
}

module.exports = new EditorsConfig()
