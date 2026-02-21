/**
 * GitAnalyzer - Git repository analysis
 *
 * Extracted from sync-service.ts for single responsibility.
 * Analyzes git state: branch, commits, contributors, changes, etc.
 *
 * Uses graceful degradation for git availability (PRJ-114).
 * Avoids shell pipes for better cross-platform compatibility.
 *
 * @version 1.1.0
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { GitData } from '../types/services.js'
import { getTimeout } from '../utils/constants'
import { dependencyValidator } from './dependency-validator'

const execAsync = promisify(exec)

// ============================================================================
// GIT ANALYZER CLASS
// ============================================================================

export class GitAnalyzer {
  private projectPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
  }

  /**
   * Analyze git repository state
   * Returns defaults if git is not available (graceful degradation)
   */
  async analyze(): Promise<GitData> {
    const data: GitData = {
      branch: 'main',
      commits: 0,
      contributors: 0,
      hasChanges: false,
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      weeklyCommits: 0,
    }

    // PRJ-114: Check git availability first (graceful degradation)
    if (!dependencyValidator.isAvailable('git')) {
      return data
    }

    try {
      // Run independent git commands in parallel for speed
      const [branch, commits, contributors, status, log, weekly] = await Promise.all([
        this.getBranch(),
        this.getCommitCount(),
        this.getContributorCount(),
        this.getStatus(),
        this.getRecentCommits(),
        this.getWeeklyCommitCount(),
      ])

      data.branch = branch
      data.commits = commits
      data.contributors = contributors
      data.hasChanges = status.hasChanges
      data.stagedFiles = status.stagedFiles
      data.modifiedFiles = status.modifiedFiles
      data.untrackedFiles = status.untrackedFiles
      data.recentCommits = log
      data.weeklyCommits = weekly
    } catch {
      // Not a git repo - use defaults
    }

    return data
  }

  /**
   * Get current branch name
   */
  async getBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync('git branch --show-current', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      return stdout.trim() || 'main'
    } catch {
      return 'main'
    }
  }

  /**
   * Get total commit count
   */
  async getCommitCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('git rev-list --count HEAD', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      return parseInt(stdout.trim(), 10) || 0
    } catch {
      return 0
    }
  }

  /**
   * Get contributor count
   * PRJ-114: Avoids shell pipe by counting lines in JS
   */
  async getContributorCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('git shortlog -sn --all', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      // Count non-empty lines instead of piping to wc -l
      const lines = stdout.trim().split('\n').filter(Boolean)
      return lines.length
    } catch {
      return 0
    }
  }

  /**
   * Get working tree status
   */
  async getStatus(): Promise<{
    hasChanges: boolean
    stagedFiles: string[]
    modifiedFiles: string[]
    untrackedFiles: string[]
  }> {
    const result = {
      hasChanges: false,
      stagedFiles: [] as string[],
      modifiedFiles: [] as string[],
      untrackedFiles: [] as string[],
    }

    try {
      const { stdout } = await execAsync('git status --porcelain', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      const lines = stdout.trim().split('\n').filter(Boolean)
      result.hasChanges = lines.length > 0

      for (const line of lines) {
        const code = line.substring(0, 2)
        const file = line.substring(3)

        if (code.startsWith('A') || code.startsWith('M ')) {
          result.stagedFiles.push(file)
        } else if (code.includes('M')) {
          result.modifiedFiles.push(file)
        } else if (code.startsWith('??')) {
          result.untrackedFiles.push(file)
        }
      }
    } catch {
      // Not a git repo
    }

    return result
  }

  /**
   * Get recent commits
   */
  async getRecentCommits(
    count: number = 20
  ): Promise<{ hash: string; message: string; date: string }[]> {
    try {
      const { stdout } = await execAsync(
        `git log --oneline -${count} --pretty=format:"%h|%s|%ad" --date=short`,
        { cwd: this.projectPath, timeout: getTimeout('GIT_OPERATION') }
      )

      return stdout
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, message, date] = line.split('|')
          return { hash, message, date }
        })
    } catch {
      return []
    }
  }

  /**
   * Get commit count in the last week
   * PRJ-114: Avoids shell pipe by counting lines in JS
   */
  async getWeeklyCommitCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('git log --oneline --since="1 week ago"', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      // Count non-empty lines instead of piping to wc -l
      const lines = stdout.trim().split('\n').filter(Boolean)
      return lines.length
    } catch {
      return 0
    }
  }

  /**
   * Check if directory is a git repository
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get default main branch name (main or master)
   * PRJ-114: Avoids shell pipe by using JS string replace
   */
  async getDefaultBranch(): Promise<string> {
    try {
      // Try to get from remote
      const { stdout } = await execAsync('git symbolic-ref refs/remotes/origin/HEAD', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      // Use JS replace instead of piping to sed
      const branch = stdout.trim().replace(/^refs\/remotes\/origin\//, '')
      if (branch) return branch
    } catch {
      // Ignore - remote may not exist
    }

    // Fallback: check if main or master exists
    try {
      await execAsync('git show-ref --verify --quiet refs/heads/main', {
        cwd: this.projectPath,
        timeout: getTimeout('GIT_OPERATION'),
      })
      return 'main'
    } catch {
      return 'master'
    }
  }
}

/**
 * Get empty GitData for non-git repos or errors
 */
export function getEmptyGitData(): GitData {
  return {
    branch: 'main',
    commits: 0,
    contributors: 0,
    hasChanges: false,
    stagedFiles: [],
    modifiedFiles: [],
    untrackedFiles: [],
    recentCommits: [],
    weeklyCommits: 0,
  }
}

export const gitAnalyzer = (projectPath: string) => new GitAnalyzer(projectPath)
export default GitAnalyzer
