const { promisify } = require('util')
const { exec: execCallback } = require('child_process')
const exec = promisify(execCallback)

/**
 * AuthorDetector - Detects author information from multiple sources
 *
 * Detection priority:
 * 1. GitHub CLI (gh api user) - Most reliable for GitHub username
 * 2. Git config (user.name and user.email)
 * 3. Manual prompt (fallback)
 *
 * @version 0.2.0
 */
class AuthorDetector {
  /**
   * Execute a shell command safely
   *
   * @param {string} command - Command to execute
   * @returns {Promise<{success: boolean, output: string}>}
   * @private
   */
  async execCommand(command) {
    try {
      const { stdout } = await exec(command, { timeout: 5000 })
      return {
        success: true,
        output: stdout.trim(),
      }
    } catch (error) {
      return {
        success: false,
        output: '',
      }
    }
  }

  /**
   * Detect GitHub username using GitHub CLI
   *
   * @returns {Promise<string|null>} - GitHub username or null
   */
  async detectGitHubUsername() {
    let result = await this.execCommand('gh api user --jq .login')
    if (result.success && result.output) {
      return result.output
    }

    result = await this.execCommand('git config --global github.user')
    if (result.success && result.output) {
      return result.output
    }

    return null
  }

  /**
   * Detect git config name
   *
   * @returns {Promise<string|null>} - Git name or null
   */
  async detectGitName() {
    const result = await this.execCommand('git config user.name')
    return result.success && result.output ? result.output : null
  }

  /**
   * Detect git config email
   *
   * @returns {Promise<string|null>} - Git email or null
   */
  async detectGitEmail() {
    const result = await this.execCommand('git config user.email')
    return result.success && result.output ? result.output : null
  }

  /**
   * Detect author information from all available sources
   *
   * @returns {Promise<Object>} - Author information {name, email, github}
   */
  async detect() {
    const author = {
      name: null,
      email: null,
      github: null,
    }

    author.github = await this.detectGitHubUsername()

    author.name = await this.detectGitName()
    author.email = await this.detectGitEmail()

    if (!author.name && author.github) {
      author.name = author.github
    }

    if (!author.name) {
      author.name = 'Unknown'
    }

    return author
  }

  /**
   * Detect and format author for memory logs
   * Returns just the GitHub username or git name
   *
   * @returns {Promise<string>} - Author identifier for logs
   */
  async detectAuthorForLogs() {
    const author = await this.detect()

    if (author.github) {
      return author.github
    }

    if (author.name && author.name !== 'Unknown') {
      return author.name
    }

    return 'unknown'
  }

  /**
   * Check if GitHub CLI is available
   *
   * @returns {Promise<boolean>} - True if gh command is available
   */
  async isGitHubCLIAvailable() {
    const result = await this.execCommand('gh --version')
    return result.success
  }

  /**
   * Check if git is configured
   *
   * @returns {Promise<boolean>} - True if git name and email are set
   */
  async isGitConfigured() {
    const name = await this.detectGitName()
    const email = await this.detectGitEmail()
    return !!(name && email)
  }

  /**
   * Get configuration status and recommendations
   *
   * @returns {Promise<Object>} - Status and recommendations
   */
  async getConfigStatus() {
    const hasGitHub = await this.isGitHubCLIAvailable()
    const hasGit = await this.isGitConfigured()
    const author = await this.detect()

    return {
      hasGitHub,
      hasGit,
      author,
      isComplete: !!(author.github || (author.name !== 'Unknown' && author.email)),
      recommendations: this._getRecommendations(hasGitHub, hasGit, author),
    }
  }

  /**
   * Generate recommendations based on detected configuration
   *
   * @param {boolean} hasGitHub - GitHub CLI available
   * @param {boolean} hasGit - Git configured
   * @param {Object} author - Detected author
   * @returns {string[]} - Array of recommendations
   * @private
   */
  _getRecommendations(hasGitHub, hasGit, author) {
    const recommendations = []

    if (!hasGitHub && !author.github) {
      recommendations.push('Install GitHub CLI (gh) for better collaboration support: https://cli.github.com/')
    }

    if (!hasGit) {
      recommendations.push('Configure git user: git config --global user.name "Your Name"')
      recommendations.push('Configure git email: git config --global user.email "your@email.com"')
    }

    if (author.github && !author.email) {
      recommendations.push('Consider setting your git email for better tracking')
    }

    return recommendations
  }

  /**
   * Format author information for display
   *
   * @param {Object} author - Author object
   * @returns {string} - Formatted author string
   */
  formatAuthor(author) {
    const parts = []

    if (author.name && author.name !== 'Unknown') {
      parts.push(author.name)
    }

    if (author.github) {
      parts.push(`@${author.github}`)
    }

    if (author.email) {
      parts.push(`<${author.email}>`)
    }

    return parts.join(' ') || 'Unknown'
  }
}

module.exports = new AuthorDetector()
