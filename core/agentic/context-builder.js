/**
 * Context Builder
 * Builds project context for Claude to make decisions
 * NO if/else logic - just data collection
 */

const fs = require('fs').promises
const pathManager = require('../infrastructure/path-manager')
const configManager = require('../infrastructure/config-manager')

class ContextBuilder {
  /**
   * Build full project context for Claude
   * @param {string} projectPath - Local project path
   * @param {Object} commandParams - Command-specific parameters
   * @returns {Promise<Object>} Context object
   */
  async build(projectPath, commandParams = {}) {
    const projectId = await configManager.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)

    return {
      // Project identification
      projectId,
      projectPath,
      globalPath,

      // File paths
      paths: {
        now: pathManager.getFilePath(projectId, 'core', 'now.md'),
        next: pathManager.getFilePath(projectId, 'core', 'next.md'),
        context: pathManager.getFilePath(projectId, 'core', 'context.md'),
        shipped: pathManager.getFilePath(projectId, 'progress', 'shipped.md'),
        metrics: pathManager.getFilePath(projectId, 'progress', 'metrics.md'),
        ideas: pathManager.getFilePath(projectId, 'planning', 'ideas.md'),
        roadmap: pathManager.getFilePath(projectId, 'planning', 'roadmap.md'),
        memory: pathManager.getFilePath(projectId, 'memory', 'context.jsonl'),
        analysis: pathManager.getFilePath(projectId, 'analysis', 'repo-summary.md'),
      },

      // Command parameters
      params: commandParams,

      // Timestamps
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleString(),
    }
  }

  /**
   * Load current project state
   * @param {Object} context - Context from build()
   * @returns {Promise<Object>} Current state
   */
  async loadState(context) {
    const state = {}

    // Read all core files
    for (const [key, filePath] of Object.entries(context.paths)) {
      try {
        state[key] = await fs.readFile(filePath, 'utf-8')
      } catch {
        state[key] = null
      }
    }

    return state
  }

  /**
   * Check file existence
   * @param {string} filePath - File path
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }
}

module.exports = new ContextBuilder()
