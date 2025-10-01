const fs = require('fs').promises
const pathManager = require('./path-manager')
const { VERSION } = require('./version')

/**
 * ConfigManager - Manages prjct.config.json files
 *
 * Key responsibilities:
 * - Read and write prjct.config.json
 * - Validate configuration structure
 * - Create new configurations
 * - Update existing configurations
 *
 * @version 0.2.1
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
   * Read the global project configuration file
   * Contains authors array and other system data
   *
   * @param {string} projectId - Project identifier
   * @returns {Promise<Object|null>} - Configuration object or null if not found
   */
  async readGlobalConfig(projectId) {
    try {
      const configPath = pathManager.getGlobalProjectConfigPath(projectId)
      const content = await fs.readFile(configPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Write the global project configuration file
   *
   * @param {string} projectId - Project identifier
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async writeGlobalConfig(projectId, config) {
    const configPath = pathManager.getGlobalProjectConfigPath(projectId)
    const configDir = pathManager.getGlobalProjectPath(projectId)

    // Ensure global project directory exists
    await fs.mkdir(configDir, { recursive: true })

    const content = JSON.stringify(config, null, 2)
    await fs.writeFile(configPath, content + '\n', 'utf-8')
  }

  /**
   * Ensure global config exists, create if not
   *
   * @param {string} projectId - Project identifier
   * @returns {Promise<Object>} - Global configuration
   */
  async ensureGlobalConfig(projectId) {
    let globalConfig = await this.readGlobalConfig(projectId)

    if (!globalConfig) {
      const now = new Date().toISOString()
      globalConfig = {
        projectId,
        authors: [],
        version: VERSION,
        lastSync: now
      }
      await this.writeGlobalConfig(projectId, globalConfig)
    }

    return globalConfig
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
    const now = new Date().toISOString()

    // Local config (minimal, only project metadata)
    const localConfig = {
      projectId,
      dataPath: displayPath
    }

    await this.writeConfig(projectPath, localConfig)

    // Global config (includes all system data)
    const globalConfig = {
      projectId,
      authors: [
        {
          name: author.name || 'Unknown',
          email: author.email || '',
          github: author.github || '',
          firstContribution: now,
          lastActivity: now
        }
      ],
      version: VERSION,
      created: now,
      lastSync: now
    }

    await this.writeGlobalConfig(projectId, globalConfig)

    return localConfig
  }

  /**
   * Update the lastSync timestamp in global config
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<void>}
   */
  async updateLastSync(projectPath) {
    const projectId = await this.getProjectId(projectPath)
    const globalConfig = await this.readGlobalConfig(projectId)
    if (globalConfig) {
      globalConfig.lastSync = new Date().toISOString()
      await this.writeGlobalConfig(projectId, globalConfig)
    }
  }

  /**
   * Validate a local configuration object
   * Local config only contains project metadata (projectId, dataPath)
   * All system data (version, created, lastSync, authors) is in global config
   *
   * @param {Object} config - Configuration to validate
   * @returns {boolean} - True if valid
   */
  validateConfig(config) {
    if (!config) return false
    if (!config.projectId) return false
    if (!config.dataPath) return false

    // Legacy support: old configs with version/created/lastSync/authors are still valid
    // Migration will move them to global config
    return true
  }

  /**
   * Check if a project needs migration
   * Migration is needed if:
   * - Has legacy .prjct/ structure
   * - AND either no config exists OR files not yet in global location
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if migration needed
   */
  async needsMigration(projectPath) {
    const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
    if (!hasLegacy) return false

    const hasConfig = await pathManager.hasConfig(projectPath)

    // If no config, definitely needs migration
    if (!hasConfig) return true

    // If config exists, check if files are actually in global location
    const config = await this.readConfig(projectPath)
    if (!config || !config.projectId) return true

    const globalPath = pathManager.getGlobalProjectPath(config.projectId)
    const fs = require('fs').promises
    const path = require('path')

    try {
      // Check if global location has files (not just empty directories)
      const coreFiles = await fs.readdir(path.join(globalPath, 'core'))
      return coreFiles.length === 0 // Needs migration if core is empty
    } catch {
      // Global directory doesn't exist or is inaccessible - needs migration
      return true
    }
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
   * Find an author in the authors array by github username
   * Reads from GLOBAL config
   *
   * @param {string} projectId - Project identifier
   * @param {string} githubUsername - GitHub username to search for
   * @returns {Promise<Object|null>} - Author object or null if not found
   */
  async findAuthor(projectId, githubUsername) {
    const globalConfig = await this.readGlobalConfig(projectId)
    if (!globalConfig || !globalConfig.authors) return null

    return globalConfig.authors.find(a => a.github === githubUsername) || null
  }

  /**
   * Add a new author to the authors array
   * Writes to GLOBAL config
   *
   * @param {string} projectId - Project identifier
   * @param {Object} author - Author information {name, email, github}
   * @returns {Promise<void>}
   */
  async addAuthor(projectId, author) {
    const globalConfig = await this.ensureGlobalConfig(projectId)

    // Check if author already exists
    const exists = globalConfig.authors.some(a => a.github === author.github)
    if (exists) return

    const now = new Date().toISOString()
    globalConfig.authors.push({
      name: author.name || 'Unknown',
      email: author.email || '',
      github: author.github || '',
      firstContribution: now,
      lastActivity: now
    })

    globalConfig.lastSync = now
    await this.writeGlobalConfig(projectId, globalConfig)
  }

  /**
   * Update author's last activity timestamp
   * Updates GLOBAL config
   *
   * @param {string} projectId - Project identifier
   * @param {string} githubUsername - GitHub username
   * @returns {Promise<void>}
   */
  async updateAuthorActivity(projectId, githubUsername) {
    const globalConfig = await this.readGlobalConfig(projectId)
    if (!globalConfig || !globalConfig.authors) return

    const author = globalConfig.authors.find(a => a.github === githubUsername)
    if (author) {
      author.lastActivity = new Date().toISOString()
      globalConfig.lastSync = author.lastActivity
      await this.writeGlobalConfig(projectId, globalConfig)
    }
  }

  /**
   * Get current author for session (detect or get from global config)
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<string>} - GitHub username of current author
   */
  async getCurrentAuthor(projectPath) {
    const authorDetector = require('./author-detector')
    const author = await authorDetector.detect()

    // Get project ID and add author to global config if not exists
    const projectId = await this.getProjectId(projectPath)
    await this.addAuthor(projectId, author)

    return author.github || author.name || 'Unknown'
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
   * Returns LOCAL config only (projectId, dataPath)
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<Object>} - Configuration with defaults
   */
  async getConfigWithDefaults(projectPath) {
    const config = await this.readConfig(projectPath)
    if (config) {
      return config
    }

    // Return minimal defaults (local config format)
    const projectId = pathManager.generateProjectId(projectPath)
    return {
      projectId,
      dataPath: pathManager.getDisplayPath(pathManager.getGlobalProjectPath(projectId))
    }
  }
}

module.exports = new ConfigManager()
