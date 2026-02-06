/**
 * Staleness Checker Service (PRJ-120)
 *
 * Detects when CLAUDE.md context is stale and needs resync.
 * Uses git commit history to determine if significant changes have occurred.
 *
 * Pattern from Warp Agent: "Use VCS to detect recent changes"
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import pathManager from '../infrastructure/path-manager'

const execAsync = promisify(exec)

// =============================================================================
// TYPES
// =============================================================================

export interface StalenessStatus {
  isStale: boolean
  reason: string | null
  lastSyncCommit: string | null
  currentCommit: string | null
  commitsSinceSync: number
  daysSinceSync: number
  changedFiles: string[]
  significantChanges: string[] // Files that likely affect context (package.json, etc.)
}

export interface StalenessConfig {
  commitThreshold: number // Number of commits before considered stale (default: 10)
  dayThreshold: number // Days before considered stale (default: 3)
  significantFiles: string[] // Files that trigger staleness warning
}

const DEFAULT_CONFIG: StalenessConfig = {
  commitThreshold: 10,
  dayThreshold: 3,
  significantFiles: [
    'package.json',
    'tsconfig.json',
    'Cargo.toml',
    'go.mod',
    'requirements.txt',
    'pyproject.toml',
    '.env.example',
    'docker-compose.yml',
    'Dockerfile',
  ],
}

// =============================================================================
// STALENESS CHECKER
// =============================================================================

export class StalenessChecker {
  private projectPath: string
  private config: StalenessConfig

  constructor(projectPath: string, config: Partial<StalenessConfig> = {}) {
    this.projectPath = projectPath
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Check if the project context is stale
   */
  async check(projectId: string): Promise<StalenessStatus> {
    const status: StalenessStatus = {
      isStale: false,
      reason: null,
      lastSyncCommit: null,
      currentCommit: null,
      commitsSinceSync: 0,
      daysSinceSync: 0,
      changedFiles: [],
      significantChanges: [],
    }

    try {
      // Read project.json to get last sync info
      const projectJsonPath = path.join(pathManager.getGlobalProjectPath(projectId), 'project.json')

      let projectJson: Record<string, unknown> = {}
      try {
        projectJson = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
      } catch {
        // No project.json = definitely stale
        status.isStale = true
        status.reason = 'No sync history found. Run `prjct sync` to initialize.'
        return status
      }

      status.lastSyncCommit = (projectJson.lastSyncCommit as string) || null
      const lastSync = projectJson.lastSync as string

      // Get current HEAD commit
      try {
        const { stdout } = await execAsync('git rev-parse --short HEAD', {
          cwd: this.projectPath,
        })
        status.currentCommit = stdout.trim()
      } catch {
        // Not a git repo
        status.reason = 'Not a git repository'
        return status
      }

      // If no last sync commit, we can't compare
      if (!status.lastSyncCommit) {
        status.isStale = true
        status.reason = 'No sync commit recorded. Run `prjct sync` to track.'
        return status
      }

      // Same commit = not stale
      if (status.lastSyncCommit === status.currentCommit) {
        status.reason = 'Context is up to date'
        return status
      }

      // Count commits since last sync
      try {
        const { stdout } = await execAsync(`git rev-list --count ${status.lastSyncCommit}..HEAD`, {
          cwd: this.projectPath,
        })
        status.commitsSinceSync = parseInt(stdout.trim(), 10) || 0
      } catch {
        // Commit might not exist anymore (rebased, etc.)
        status.isStale = true
        status.reason = 'Sync commit no longer exists (history changed). Run `prjct sync`.'
        return status
      }

      // Calculate days since sync
      if (lastSync) {
        const syncDate = new Date(lastSync)
        const now = new Date()
        status.daysSinceSync = Math.floor(
          (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      }

      // Get changed files since last sync
      try {
        const { stdout } = await execAsync(`git diff --name-only ${status.lastSyncCommit}..HEAD`, {
          cwd: this.projectPath,
        })
        status.changedFiles = stdout.trim().split('\n').filter(Boolean)
      } catch {
        status.changedFiles = []
      }

      // Check for significant file changes
      status.significantChanges = status.changedFiles.filter((file) =>
        this.config.significantFiles.some((sig) => file.endsWith(sig) || file.includes(sig))
      )

      // Determine staleness
      if (status.commitsSinceSync >= this.config.commitThreshold) {
        status.isStale = true
        status.reason = `${status.commitsSinceSync} commits since last sync (threshold: ${this.config.commitThreshold})`
      } else if (status.daysSinceSync >= this.config.dayThreshold) {
        status.isStale = true
        status.reason = `${status.daysSinceSync} days since last sync (threshold: ${this.config.dayThreshold})`
      } else if (status.significantChanges.length > 0) {
        status.isStale = true
        status.reason = `Significant files changed: ${status.significantChanges.join(', ')}`
      } else if (status.commitsSinceSync > 0) {
        // Not stale yet, but has changes
        status.reason = `${status.commitsSinceSync} commits since sync (threshold: ${this.config.commitThreshold})`
      } else {
        status.reason = 'Context is up to date'
      }

      return status
    } catch (error) {
      status.reason = `Error checking staleness: ${(error as Error).message}`
      return status
    }
  }

  /**
   * Format staleness status for display
   */
  formatStatus(status: StalenessStatus): string {
    const lines: string[] = []

    if (status.isStale) {
      lines.push('CLAUDE.md status: ⚠️  STALE')
    } else {
      lines.push('CLAUDE.md status: ✓ Fresh')
    }

    // Build key-value table content
    const details: string[] = []
    if (status.lastSyncCommit) {
      details.push(`Last sync:      ${status.lastSyncCommit}`)
    }
    if (status.currentCommit) {
      details.push(`Current:        ${status.currentCommit}`)
    }
    if (status.commitsSinceSync > 0) {
      details.push(`Commits since:  ${status.commitsSinceSync}`)
    }
    if (status.daysSinceSync > 0) {
      details.push(`Days since:     ${status.daysSinceSync}`)
    }
    if (status.changedFiles.length > 0) {
      details.push(`Files changed:  ${status.changedFiles.length}`)
    }

    // Wrap details in a box
    if (details.length > 0) {
      const maxLen = Math.max(...details.map((l) => l.length))
      const border = '─'.repeat(maxLen + 2)
      lines.push(`┌${border}┐`)
      for (const detail of details) {
        lines.push(`│ ${detail.padEnd(maxLen)} │`)
      }
      lines.push(`└${border}┘`)
    }

    if (status.significantChanges.length > 0) {
      lines.push(``)
      lines.push(`Significant changes:`)
      for (const file of status.significantChanges.slice(0, 5)) {
        lines.push(`  • ${file}`)
      }
      if (status.significantChanges.length > 5) {
        lines.push(`  ... and ${status.significantChanges.length - 5} more`)
      }
    }

    if (status.reason) {
      lines.push(``)
      lines.push(status.reason)
    }

    if (status.isStale) {
      lines.push(``)
      lines.push(`Run \`prjct sync\` to update context`)
    }

    return lines.join('\n')
  }

  /**
   * Get a short warning message if stale (for other commands)
   */
  getWarning(status: StalenessStatus): string | null {
    if (!status.isStale) return null

    if (status.commitsSinceSync > 0) {
      return `⚠️  Context stale (${status.commitsSinceSync} commits behind). Run \`prjct sync\``
    }
    if (status.daysSinceSync > 0) {
      return `⚠️  Context stale (${status.daysSinceSync} days old). Run \`prjct sync\``
    }
    return `⚠️  Context may be stale. Run \`prjct sync\``
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const createStalenessChecker = (projectPath: string, config?: Partial<StalenessConfig>) =>
  new StalenessChecker(projectPath, config)

export default StalenessChecker
