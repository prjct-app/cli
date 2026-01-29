/**
 * Recent Tool - Find "hot" files based on git history
 *
 * Identifies recently and frequently modified files,
 * which are likely to be relevant for current work.
 *
 * @module context-tools/recent-tool
 * @version 1.0.0
 */

import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import type { HotFile, RecentToolOutput } from './types'

const exec = promisify(execCallback)

// =============================================================================
// Constants
// =============================================================================

/**
 * Files to ignore in recent analysis
 */
const IGNORE_PATTERNS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.gitignore',
  '.env',
  '.env.local',
  '*.md',
  'CHANGELOG.md',
  'LICENSE',
]

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Get recently modified files based on git history
 *
 * @param projectPath - Project root path
 * @param options - Analysis options
 * @returns Hot files sorted by heat score
 */
export async function getRecentFiles(
  projectPath: string = process.cwd(),
  options: {
    commits?: number // Number of commits to analyze (default 30)
    branch?: boolean // Only files changed in current branch vs main
    maxFiles?: number // Max files to return (default 50)
  } = {}
): Promise<RecentToolOutput> {
  const commits = options.commits ?? 30
  const maxFiles = options.maxFiles ?? 50
  const branchOnly = options.branch ?? false

  try {
    let hotFiles: HotFile[] = []
    let branchOnlyFiles: string[] = []
    let analysisWindow = `${commits} commits`

    if (branchOnly) {
      // Get files changed only in current branch
      const result = await getBranchOnlyFiles(projectPath)
      hotFiles = result.hotFiles
      branchOnlyFiles = result.branchOnlyFiles
      analysisWindow = result.analysisWindow
    } else {
      // Get files from recent commits
      hotFiles = await getHotFilesFromCommits(projectPath, commits)
    }

    // Filter and limit
    hotFiles = hotFiles.filter((f) => !shouldIgnore(f.path)).slice(0, maxFiles)

    return {
      hotFiles,
      branchOnlyFiles,
      metrics: {
        commitsAnalyzed: commits,
        totalFilesChanged: hotFiles.length,
        filesReturned: Math.min(hotFiles.length, maxFiles),
        analysisWindow,
      },
    }
  } catch (_error) {
    // Git not available or not a repo
    return {
      hotFiles: [],
      branchOnlyFiles: [],
      metrics: {
        commitsAnalyzed: 0,
        totalFilesChanged: 0,
        filesReturned: 0,
        analysisWindow: 'N/A (git error)',
      },
    }
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get hot files from recent commits
 */
async function getHotFilesFromCommits(projectPath: string, commits: number): Promise<HotFile[]> {
  // Get file change counts and last modified times
  const { stdout } = await exec(
    `git log -${commits} --pretty=format:"%ct" --name-only | awk '
      /^[0-9]+$/ { timestamp=$1; next }
      NF {
        count[$0]++
        if (!lastmod[$0] || timestamp > lastmod[$0]) lastmod[$0]=timestamp
      }
      END {
        for (f in count) print count[f], lastmod[f], f
      }
    ' | sort -rn`,
    { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
  )

  const hotFiles: HotFile[] = []
  const lines = stdout.trim().split('\n').filter(Boolean)
  const now = Math.floor(Date.now() / 1000)

  // Find max changes for normalization
  let maxChanges = 1
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (match) {
      const changes = parseInt(match[1], 10)
      if (changes > maxChanges) maxChanges = changes
    }
  }

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (!match) continue

    const changes = parseInt(match[1], 10)
    const timestamp = parseInt(match[2], 10)
    const filePath = match[3]

    const secondsAgo = now - timestamp
    const daysAgo = Math.floor(secondsAgo / 86400)
    const hoursAgo = Math.floor(secondsAgo / 3600)

    // Calculate heat score (combination of recency and frequency)
    const recencyScore = Math.max(0, 1 - daysAgo / 30) // Decay over 30 days
    const frequencyScore = changes / maxChanges
    const heatScore = recencyScore * 0.6 + frequencyScore * 0.4

    // Format last changed
    let lastChanged: string
    if (hoursAgo < 1) {
      lastChanged = 'just now'
    } else if (hoursAgo < 24) {
      lastChanged = `${hoursAgo}h ago`
    } else if (daysAgo < 7) {
      lastChanged = `${daysAgo}d ago`
    } else if (daysAgo < 30) {
      lastChanged = `${Math.floor(daysAgo / 7)}w ago`
    } else {
      lastChanged = `${Math.floor(daysAgo / 30)}mo ago`
    }

    hotFiles.push({
      path: filePath,
      changes,
      heatScore: Math.round(heatScore * 100) / 100,
      lastChanged,
      lastChangedAt: new Date(timestamp * 1000).toISOString(),
    })
  }

  // Sort by heat score
  return hotFiles.sort((a, b) => b.heatScore - a.heatScore)
}

/**
 * Get files changed only in current branch vs main
 */
async function getBranchOnlyFiles(projectPath: string): Promise<{
  hotFiles: HotFile[]
  branchOnlyFiles: string[]
  analysisWindow: string
}> {
  // Get current branch
  const { stdout: branchOutput } = await exec('git branch --show-current', {
    cwd: projectPath,
  })
  const _currentBranch = branchOutput.trim()

  // Determine base branch (main or master)
  let baseBranch = 'main'
  try {
    await exec('git rev-parse --verify main', { cwd: projectPath })
  } catch {
    baseBranch = 'master'
  }

  // Get files changed in this branch
  const { stdout: diffOutput } = await exec(`git diff --name-only ${baseBranch}...HEAD`, {
    cwd: projectPath,
  })

  const branchOnlyFiles = diffOutput.trim().split('\n').filter(Boolean)

  // Get change counts for these files in the branch
  const { stdout: logOutput } = await exec(
    `git log ${baseBranch}..HEAD --pretty=format:"%ct" --name-only | awk '
      /^[0-9]+$/ { timestamp=$1; next }
      NF {
        count[$0]++
        if (!lastmod[$0] || timestamp > lastmod[$0]) lastmod[$0]=timestamp
      }
      END {
        for (f in count) print count[f], lastmod[f], f
      }
    '`,
    { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
  )

  const hotFiles: HotFile[] = []
  const lines = logOutput.trim().split('\n').filter(Boolean)
  const now = Math.floor(Date.now() / 1000)

  // Find max changes for normalization
  let maxChanges = 1
  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (match) {
      const changes = parseInt(match[1], 10)
      if (changes > maxChanges) maxChanges = changes
    }
  }

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/)
    if (!match) continue

    const changes = parseInt(match[1], 10)
    const timestamp = parseInt(match[2], 10)
    const filePath = match[3]

    const secondsAgo = now - timestamp
    const daysAgo = Math.floor(secondsAgo / 86400)
    const hoursAgo = Math.floor(secondsAgo / 3600)

    const recencyScore = Math.max(0, 1 - daysAgo / 14) // Faster decay for branch
    const frequencyScore = changes / maxChanges
    const heatScore = recencyScore * 0.5 + frequencyScore * 0.5

    let lastChanged: string
    if (hoursAgo < 1) {
      lastChanged = 'just now'
    } else if (hoursAgo < 24) {
      lastChanged = `${hoursAgo}h ago`
    } else {
      lastChanged = `${daysAgo}d ago`
    }

    hotFiles.push({
      path: filePath,
      changes,
      heatScore: Math.round(heatScore * 100) / 100,
      lastChanged,
      lastChangedAt: new Date(timestamp * 1000).toISOString(),
    })
  }

  return {
    hotFiles: hotFiles.sort((a, b) => b.heatScore - a.heatScore),
    branchOnlyFiles,
    analysisWindow: `${baseBranch}..HEAD`,
  }
}

/**
 * Check if a file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || ''

  for (const pattern of IGNORE_PATTERNS) {
    if (pattern.startsWith('*.')) {
      // Extension pattern
      if (fileName.endsWith(pattern.slice(1))) return true
    } else {
      // Exact match
      if (fileName === pattern) return true
    }
  }

  return false
}

// =============================================================================
// Exports
// =============================================================================

export default { getRecentFiles }
