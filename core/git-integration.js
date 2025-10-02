const { execSync } = require('child_process')
const fs = require('fs').promises

/**
 * GitIntegration - Git repository analysis and validation
 *
 * Provides git integration for prjct-cli to analyze repository state,
 * validate user claims against actual commits, and track project progress.
 *
 * @version 0.5.0
 */
class GitIntegration {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath
  }

  /**
   * Check if current directory is a git repository
   * @returns {Promise<boolean>} True if git repo exists
   */
  async isGitRepo() {
    try {
      execSync('git rev-parse --git-dir', {
        cwd: this.projectPath,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get information about the last commit
   * @returns {Promise<Object|null>} Commit info or null if no commits
   */
  async getLastCommit() {
    if (!(await this.isGitRepo())) {
      return null
    }

    try {
      const output = execSync(
        'git log -1 --format="%H|%s|%ar|%an"',
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        },
      )

      const [hash, message, timeAgo, author] = output.trim().split('|')

      return {
        hash: hash.substring(0, 7), // Short hash
        fullHash: hash,
        message,
        timeAgo,
        author,
      }
    } catch {
      return null // No commits yet
    }
  }

  /**
   * Get working directory status
   * @returns {Promise<Object|null>} Status info or null if not git repo
   */
  async getWorkingDirStatus() {
    if (!(await this.isGitRepo())) {
      return null
    }

    try {
      const status = execSync('git status --porcelain', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })

      const lines = status.trim().split('\n').filter(Boolean)

      const modified = lines.filter(
        l => l.startsWith(' M') || l.startsWith('M'),
      ).length
      const added = lines.filter(
        l => l.startsWith('A') || l.startsWith('??'),
      ).length
      const deleted = lines.filter(
        l => l.startsWith(' D') || l.startsWith('D'),
      ).length
      const renamed = lines.filter(l => l.startsWith('R')).length

      return {
        modified,
        added,
        deleted,
        renamed,
        totalChanges: lines.length,
        isClean: lines.length === 0,
        files: lines.map(l => l.substring(3)), // Remove status prefix
      }
    } catch {
      return null
    }
  }

  /**
   * Get diff summary between HEAD and working directory
   * @returns {Promise<Object|null>} Diff summary or null
   */
  async getDiffSummary() {
    if (!(await this.isGitRepo())) {
      return null
    }

    try {
      const diff = execSync('git diff HEAD --name-only', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })

      const files = diff.trim().split('\n').filter(Boolean)

      return {
        files,
        count: files.length,
      }
    } catch {
      return null
    }
  }

  /**
   * Get files changed since a specific time
   * @param {Date|number} since - Timestamp or Date object
   * @returns {Promise<Array>} Array of changed files
   */
  async getChangesSince(since) {
    if (!(await this.isGitRepo())) {
      return []
    }

    try {
      const timestamp =
        since instanceof Date ? since.toISOString() : new Date(since).toISOString()

      const files = execSync(
        `git log --since="${timestamp}" --name-only --pretty=format:`,
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        },
      )

      return [...new Set(files.trim().split('\n').filter(Boolean))]
    } catch {
      return []
    }
  }

  /**
   * Validate user claim against git state
   * @param {string} claim - User's claim (e.g., "login is complete")
   * @returns {Promise<Object>} Validation result
   */
  async validateUserClaim(claim) {
    if (!(await this.isGitRepo())) {
      return {
        valid: true,
        warning: null,
        note: 'Not a git repository - cannot validate against commits',
      }
    }

    const lastCommit = await this.getLastCommit()
    const workingStatus = await this.getWorkingDirStatus()

    if (!lastCommit) {
      return {
        valid: true,
        warning: null,
        note: 'No commits yet - cannot validate',
      }
    }

    // Extract keywords from claim
    const keywords = this.extractKeywords(claim)
    const completionClaimed = /complete|done|finished|ready|shipped/i.test(claim)

    // Check if keywords appear in last commit
    const inLastCommit = keywords.some(keyword =>
      lastCommit.message.toLowerCase().includes(keyword),
    )

    // Check if there are uncommitted changes
    const hasUncommittedChanges = !workingStatus.isClean

    // Validation logic
    if (completionClaimed && !inLastCommit && hasUncommittedChanges) {
      return {
        valid: false,
        warning: `⚠️  Discrepancy detected: You claim "${claim}" but it's not in the last commit`,
        details: {
          lastCommit: lastCommit.message,
          uncommittedFiles: workingStatus.totalChanges,
          suggestion:
            'Consider committing your changes if the work is truly complete',
        },
      }
    }

    if (completionClaimed && !inLastCommit && !hasUncommittedChanges) {
      return {
        valid: true,
        warning: `ℹ️  Note: "${claim}" not mentioned in recent commits`,
        details: {
          lastCommit: lastCommit.message,
          note: 'Work may have been completed in earlier commits',
        },
      }
    }

    return {
      valid: true,
      warning: null,
      note: inLastCommit
        ? `✅ Confirmed in last commit: "${lastCommit.message}"`
        : null,
    }
  }

  /**
   * Extract meaningful keywords from a claim
   * @param {string} claim - User's claim
   * @returns {Array<string>} Extracted keywords
   */
  extractKeywords(claim) {
    // Remove common words
    const stopWords = new Set([
      'the',
      'is',
      'are',
      'was',
      'were',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'complete',
      'done',
      'finished',
      'ready',
      'shipped',
    ])

    return claim
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  }

  /**
   * Get git statistics for analysis
   * @returns {Promise<Object>} Git statistics
   */
  async getGitStats() {
    if (!(await this.isGitRepo())) {
      return {
        isGitRepo: false,
        hasCommits: false,
        totalCommits: 0,
        contributors: [],
        lastCommit: null,
        workingStatus: null,
      }
    }

    try {
      // Total commits
      const totalCommits = parseInt(
        execSync('git rev-list --count HEAD', {
          cwd: this.projectPath,
          encoding: 'utf-8',
        }).trim(),
      )

      // Contributors
      const contributorsOutput = execSync(
        'git log --format="%an" | sort -u',
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        },
      )
      const contributors = contributorsOutput.trim().split('\n').filter(Boolean)

      const lastCommit = await this.getLastCommit()
      const workingStatus = await this.getWorkingDirStatus()

      return {
        isGitRepo: true,
        hasCommits: totalCommits > 0,
        totalCommits,
        contributors,
        lastCommit,
        workingStatus,
      }
    } catch (error) {
      return {
        isGitRepo: true,
        hasCommits: false,
        totalCommits: 0,
        contributors: [],
        lastCommit: null,
        workingStatus: null,
        error: error.message,
      }
    }
  }

  /**
   * Check if a specific feature/file is in git history
   * @param {string} searchTerm - Term to search for
   * @returns {Promise<boolean>} True if found in history
   */
  async isInGitHistory(searchTerm) {
    if (!(await this.isGitRepo())) {
      return false
    }

    try {
      const result = execSync(
        `git log --all --grep="${searchTerm}" --oneline`,
        {
          cwd: this.projectPath,
          encoding: 'utf-8',
        },
      )

      return result.trim().length > 0
    } catch {
      return false
    }
  }

  /**
   * Get branch information
   * @returns {Promise<Object|null>} Branch info or null
   */
  async getBranchInfo() {
    if (!(await this.isGitRepo())) {
      return null
    }

    try {
      const currentBranch = execSync('git branch --show-current', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      }).trim()

      const allBranches = execSync('git branch --list', {
        cwd: this.projectPath,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .map(b => b.trim().replace('* ', ''))

      return {
        current: currentBranch,
        all: allBranches,
        count: allBranches.length,
      }
    } catch {
      return null
    }
  }
}

module.exports = new GitIntegration()
