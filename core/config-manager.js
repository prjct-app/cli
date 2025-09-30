const fs = require('fs').promises
const pathManager = require('./path-manager')

/**
 * ConfigManager - Manages prjct.config.json files
 *
 * Key responsibilities:
 * - Read and write prjct.config.json
 * - Validate configuration structure
 * - Create new configurations
 * - Update existing configurations
 *
 * @version 0.2.0
 */
class ConfigManager {
  /**
   * Read the project configuration file
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object|null>} - Configuration object or null if not found
   */
  async readConfig(projectPath) {
    try {
      const configPath = pathManager.getLocalConfigPath(projectPath)
      const content = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Write the project configuration file
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async writeConfig(projectPath, config) {
    const configPath = pathManager.getLocalConfigPath(projectPath)
    const configDir = pathManager.getLegacyPrjctPath(projectPath)

    // Ensure .prjct directory exists
    await fs.mkdir(configDir, { recursive: true })

    const content = JSON.stringify(config, null, 2)
    await fs.writeFile(configPath, content + '\n', 'utf-8')
  }

  /**
   * Create a new project configuration
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} author - Author information {name, email, github}
   * @returns {Promise<Object>} - Created configuration
   */
  async createConfig(projectPath, author) {
    const projectId = pathManager.generateProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const displayPath = pathManager.getDisplayPath(globalPath)

    const config = {
      version: '0.2.0',
      projectId,
      dataPath: displayPath,
      author: {
        name: author.name || 'Unknown',
        email: author.email || '',
        github: author.github || ''
      },
      created: new Date().toISOString(),
      lastSync: new Date().toISOString()
    }

    await this.writeConfig(projectPath, config)
    return config
  }

  /**
   * Update the lastSync timestamp
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<void>}
   */
  async updateLastSync(projectPath) {
    const config = await this.readConfig(projectPath)
    if (config) {
      config.lastSync = new Date().toISOString()
      await this.writeConfig(projectPath, config)
    }
  }

  /**
   * Validate a configuration object
   *
   * @param {Object} config - Configuration to validate
   * @returns {boolean} - True if valid
   */
  validateConfig(config) {
    if (!config) return false
    if (!config.version) return false
    if (!config.projectId) return false
    if (!config.dataPath) return false
    if (!config.author || !config.author.name) return false
    if (!config.created) return false
    if (!config.lastSync) return false
    return true
  }

  /**
   * Check if a project needs migration (has legacy structure but no config)
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if migration needed
   */
  async needsMigration(projectPath) {
    const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
    const hasConfig = await pathManager.hasConfig(projectPath)
    return hasLegacy && !hasConfig
  }

  /**
   * Get the project ID from config, or generate it if config doesn't exist
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<string>} - Project ID
   */
  async getProjectId(projectPath) {
    const config = await this.readConfig(projectPath)
    if (config && config.projectId) {
      return config.projectId
    }
    return pathManager.generateProjectId(projectPath)
  }

  /**
   * Update author information in config
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} author - New author information
   * @returns {Promise<void>}
   */
  async updateAuthor(projectPath, author) {
    const config = await this.readConfig(projectPath)
    if (config) {
      config.author = {
        ...config.author,
        ...author
      }
      config.lastSync = new Date().toISOString()
      await this.writeConfig(projectPath, config)
    }
  }

  /**
   * Check if config exists and is valid
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if valid config exists
   */
  async isConfigured(projectPath) {
    const config = await this.readConfig(projectPath)
    return this.validateConfig(config)
  }

  /**
   * Get configuration with defaults
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} - Configuration with defaults
   */
  async getConfigWithDefaults(projectPath) {
    const config = await this.readConfig(projectPath)
    if (config) {
      return config
    }

    // Return minimal defaults
    const projectId = pathManager.generateProjectId(projectPath)
    return {
      version: '0.2.0',
      projectId,
      dataPath: pathManager.getDisplayPath(pathManager.getGlobalProjectPath(projectId)),
      author: {
        name: 'Unknown',
        email: '',
        github: ''
      },
      created: new Date().toISOString(),
      lastSync: new Date().toISOString()
    }
  }
}

module.exports = new ConfigManager()
