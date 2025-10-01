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

    const config = {
      version: VERSION,
      projectId,
      dataPath: displayPath,
      authors: [
        {
          name: author.name || 'Unknown',
          email: author.email || '',
          github: author.github || '',
          firstContribution: now,
          lastActivity: now
        }
      ],
      created: now,
      lastSync: now
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

    // Support both old (author) and new (authors) formats
    if (config.authors) {
      if (!Array.isArray(config.authors) || config.authors.length === 0) return false
      if (!config.authors[0].name) return false
    } else if (config.author) {
      if (!config.author.name) return false
    } else {
      return false
    }

    if (!config.created) return false
    if (!config.lastSync) return false
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
   *
   * @param {string} projectPath - Path to the project
   * @param {string} githubUsername - GitHub username to search for
   * @returns {Promise<Object|null>} - Author object or null if not found
   */
  async findAuthor(projectPath, githubUsername) {
    const config = await this.readConfig(projectPath)
    if (!config || !config.authors) return null

    return config.authors.find(a => a.github === githubUsername) || null
  }

  /**
   * Add a new author to the authors array
   *
   * @param {string} projectPath - Path to the project
   * @param {Object} author - Author information {name, email, github}
   * @returns {Promise<void>}
   */
  async addAuthor(projectPath, author) {
    const config = await this.readConfig(projectPath)
    if (!config) return

    // Ensure authors array exists
    if (!config.authors) {
      config.authors = []
    }

    // Check if author already exists
    const exists = config.authors.some(a => a.github === author.github)
    if (exists) return

    const now = new Date().toISOString()
    config.authors.push({
      name: author.name || 'Unknown',
      email: author.email || '',
      github: author.github || '',
      firstContribution: now,
      lastActivity: now
    })

    config.lastSync = now
    await this.writeConfig(projectPath, config)
  }

  /**
   * Update author's last activity timestamp
   *
   * @param {string} projectPath - Path to the project
   * @param {string} githubUsername - GitHub username
   * @returns {Promise<void>}
   */
  async updateAuthorActivity(projectPath, githubUsername) {
    const config = await this.readConfig(projectPath)
    if (!config || !config.authors) return

    const author = config.authors.find(a => a.github === githubUsername)
    if (author) {
      author.lastActivity = new Date().toISOString()
      config.lastSync = author.lastActivity
      await this.writeConfig(projectPath, config)
    }
  }

  /**
   * Get current author for session (detect or get from config)
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<string>} - GitHub username of current author
   */
  async getCurrentAuthor(projectPath) {
    const authorDetector = require('./author-detector')
    const author = await authorDetector.detect()

    // Add author to config if not exists
    await this.addAuthor(projectPath, author)

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
    const now = new Date().toISOString()
    return {
      version: VERSION,
      projectId,
      dataPath: pathManager.getDisplayPath(pathManager.getGlobalProjectPath(projectId)),
      authors: [
        {
          name: 'Unknown',
          email: '',
          github: '',
          firstContribution: now,
          lastActivity: now
        }
      ],
      created: now,
      lastSync: now
    }
  }
}

module.exports = new ConfigManager()
