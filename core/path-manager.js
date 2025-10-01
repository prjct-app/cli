const fs = require('fs').promises
const path = require('path')
const crypto = require('crypto')
const os = require('os')

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
class PathManager {
  constructor() {
    this.globalBaseDir = path.join(os.homedir(), '.prjct-cli')
    this.globalProjectsDir = path.join(this.globalBaseDir, 'projects')
    this.globalConfigDir = path.join(this.globalBaseDir, 'config')
  }

  /**
   * Generate a unique project ID from the absolute project path
   * Uses SHA-256 hash of the absolute path for consistency
   *
   * @param {string} projectPath - Absolute path to the project
   * @returns {string} - 12-character hash ID
   */
  generateProjectId(projectPath) {
    const absolutePath = path.resolve(projectPath)
    const hash = crypto.createHash('sha256').update(absolutePath).digest('hex')
    return hash.substring(0, 12) // Use first 12 chars for readability
  }

  /**
   * Get the base global storage path
   *
   * @returns {string} - Path to global base directory (~/.prjct-cli)
   */
  getGlobalBasePath() {
    return this.globalBaseDir
  }

  /**
   * Get the global storage path for a project
   *
   * @param {string} projectId - The project identifier
   * @returns {string} - Path to global project storage
   */
  getGlobalProjectPath(projectId) {
    return path.join(this.globalProjectsDir, projectId)
  }

  /**
   * Get the local config file path for a project
   *
   * @param {string} projectPath - Path to the project
   * @returns {string} - Path to .prjct/prjct.config.json
   */
  getLocalConfigPath(projectPath) {
    return path.join(projectPath, '.prjct', 'prjct.config.json')
  }

  /**
   * Get the global config file path for a project
   * This file stores authors and other system data that shouldn't be versioned
   *
   * @param {string} projectId - The project identifier
   * @returns {string} - Path to ~/.prjct-cli/projects/{id}/project.json
   */
  getGlobalProjectConfigPath(projectId) {
    return path.join(this.getGlobalProjectPath(projectId), 'project.json')
  }

  /**
   * Get the legacy .prjct directory path
   *
   * @param {string} projectPath - Path to the project
   * @returns {string} - Path to legacy .prjct directory
   */
  getLegacyPrjctPath(projectPath) {
    return path.join(projectPath, '.prjct')
  }

  /**
   * Check if a project has legacy .prjct directory
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if legacy directory exists
   */
  async hasLegacyStructure(projectPath) {
    try {
      const legacyPath = this.getLegacyPrjctPath(projectPath)
      await fs.access(legacyPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if a project has the new config file
   *
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>} - True if config exists
   */
  async hasConfig(projectPath) {
    try {
      const configPath = this.getLocalConfigPath(projectPath)
      await fs.access(configPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Ensure the global directory structure exists
   * Creates all necessary directories in ~/.prjct-cli/
   *
   * @returns {Promise<void>}
   */
  async ensureGlobalStructure() {
    await fs.mkdir(this.globalBaseDir, { recursive: true })
    await fs.mkdir(this.globalProjectsDir, { recursive: true })
    await fs.mkdir(this.globalConfigDir, { recursive: true })
  }

  /**
   * Ensure the project-specific global structure exists
   * Creates the layered directory structure for a project
   *
   * @param {string} projectId - The project identifier
   * @returns {Promise<string>} - Path to the project's global storage
   */
  async ensureProjectStructure(projectId) {
    await this.ensureGlobalStructure()

    const projectPath = this.getGlobalProjectPath(projectId)

    // Create layered structure
    const layers = ['core', 'progress', 'planning', 'analysis', 'memory']

    for (const layer of layers) {
      await fs.mkdir(path.join(projectPath, layer), { recursive: true })
    }

    // Create tasks subdirectory in planning
    await fs.mkdir(path.join(projectPath, 'planning', 'tasks'), { recursive: true })

    // Create sessions directory for temporal fragmentation
    await fs.mkdir(path.join(projectPath, 'sessions'), { recursive: true })

    return projectPath
  }

  /**
   * Get session directory path for a specific date
   * Creates hierarchical structure: sessions/YYYY/MM/DD/
   *
   * @param {string} projectId - The project identifier
   * @param {Date} date - Date for the session (defaults to today)
   * @returns {string} - Path to session directory
   */
  getSessionPath(projectId, date = new Date()) {
    const year = date.getFullYear().toString()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')

    return path.join(
      this.getGlobalProjectPath(projectId),
      'sessions',
      year,
      month,
      day
    )
  }

  /**
   * Get current session directory path (today)
   *
   * @param {string} projectId - The project identifier
   * @returns {string} - Path to today's session directory
   */
  getCurrentSessionPath(projectId) {
    return this.getSessionPath(projectId, new Date())
  }

  /**
   * Ensure session directory exists for a specific date
   *
   * @param {string} projectId - The project identifier
   * @param {Date} date - Date for the session (defaults to today)
   * @returns {Promise<string>} - Path to session directory
   */
  async ensureSessionPath(projectId, date = new Date()) {
    const sessionPath = this.getSessionPath(projectId, date)
    await fs.mkdir(sessionPath, { recursive: true })
    return sessionPath
  }

  /**
   * List all session dates for a project
   *
   * @param {string} projectId - The project identifier
   * @param {number} year - Optional year filter
   * @param {number} month - Optional month filter (1-12)
   * @returns {Promise<Array<{year: string, month: string, day: string, path: string}>>} - Array of session info
   */
  async listSessions(projectId, year = null, month = null) {
    const sessionsDir = path.join(this.getGlobalProjectPath(projectId), 'sessions')
    const sessions = []

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
              date: new Date(`${yearEntry.name}-${monthEntry.name}-${dayEntry.name}`)
            })
          }
        }
      }

      // Sort by date descending (most recent first)
      sessions.sort((a, b) => b.date - a.date)
      return sessions
    } catch {
      return []
    }
  }

  /**
   * Get sessions within a date range
   *
   * @param {string} projectId - The project identifier
   * @param {Date} fromDate - Start date (inclusive)
   * @param {Date} toDate - End date (inclusive, defaults to today)
   * @returns {Promise<Array>} - Array of session info within range
   */
  async getSessionsInRange(projectId, fromDate, toDate = new Date()) {
    const allSessions = await this.listSessions(projectId)

    return allSessions.filter(session => {
      return session.date >= fromDate && session.date <= toDate
    })
  }

  /**
   * Get the path for a specific file in the global structure
   *
   * @param {string} projectId - The project identifier
   * @param {string} layer - The layer (core, progress, planning, analysis, memory)
   * @param {string} filename - The filename
   * @returns {string} - Full path to the file
   */
  getFilePath(projectId, layer, filename) {
    return path.join(this.getGlobalProjectPath(projectId), layer, filename)
  }

  /**
   * Get all project IDs in global storage
   *
   * @returns {Promise<string[]>} - Array of project IDs
   */
  async listProjects() {
    try {
      await this.ensureGlobalStructure()
      const entries = await fs.readdir(this.globalProjectsDir, { withFileTypes: true })
      return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
    } catch {
      return []
    }
  }

  /**
   * Check if a project exists in global storage
   *
   * @param {string} projectId - The project identifier
   * @returns {Promise<boolean>} - True if project exists
   */
  async projectExists(projectId) {
    try {
      const projectPath = this.getGlobalProjectPath(projectId)
      await fs.access(projectPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Get the relative path from home directory for display
   *
   * @param {string} absolutePath - Absolute path
   * @returns {string} - Path with ~ notation
   */
  getDisplayPath(absolutePath) {
    const homeDir = os.homedir()
    if (absolutePath.startsWith(homeDir)) {
      return absolutePath.replace(homeDir, '~')
    }
    return absolutePath
  }
}

module.exports = new PathManager()
