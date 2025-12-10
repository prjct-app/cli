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

import { promisify } from 'util'
import { exec as execCallback } from 'child_process'

const exec = promisify(execCallback)

interface Author {
  name: string | null
  email: string | null
  github: string | null
}

interface ExecResult {
  success: boolean
  output: string
}

interface ConfigStatus {
  hasGitHub: boolean
  hasGit: boolean
  author: Author
  isComplete: boolean
  recommendations: string[]
}

class AuthorDetector {
  /**
   * Execute a shell command safely
   */
  private async execCommand(command: string): Promise<ExecResult> {
    try {
      const { stdout } = await exec(command, { timeout: 5000 })
      return {
        success: true,
        output: stdout.trim(),
      }
    } catch {
      return {
        success: false,
        output: '',
      }
    }
  }

  /**
   * Detect GitHub username using GitHub CLI
   */
  async detectGitHubUsername(): Promise<string | null> {
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
   */
  async detectGitName(): Promise<string | null> {
    const result = await this.execCommand('git config user.name')
    return result.success && result.output ? result.output : null
  }

  /**
   * Detect git config email
   */
  async detectGitEmail(): Promise<string | null> {
    const result = await this.execCommand('git config user.email')
    return result.success && result.output ? result.output : null
  }

  /**
   * Detect author information from all available sources
   */
  async detect(): Promise<Author> {
    const author: Author = {
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
   */
  async detectAuthorForLogs(): Promise<string> {
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
   */
  async isGitHubCLIAvailable(): Promise<boolean> {
    const result = await this.execCommand('gh --version')
    return result.success
  }

  /**
   * Check if git is configured
   */
  async isGitConfigured(): Promise<boolean> {
    const name = await this.detectGitName()
    const email = await this.detectGitEmail()
    return !!(name && email)
  }

  /**
   * Get configuration status and recommendations
   */
  async getConfigStatus(): Promise<ConfigStatus> {
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
   */
  private _getRecommendations(hasGitHub: boolean, hasGit: boolean, author: Author): string[] {
    const recommendations: string[] = []

    if (!hasGitHub && !author.github) {
      recommendations.push(
        'Install GitHub CLI (gh) for better collaboration support: https://cli.github.com/'
      )
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
   */
  formatAuthor(author: Author): string {
    const parts: string[] = []

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

const authorDetector = new AuthorDetector()
export default authorDetector
