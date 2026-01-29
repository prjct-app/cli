/**
 * FileScorer - Calculates relevance scores for files
 *
 * Scoring factors:
 * - recency: Modified recently? (0-20)
 * - centrality: Imported by many files? (0-25)
 * - configRelevance: Is config file? (0-20)
 * - nameRelevance: Name indicates importance? (0-15)
 * - sizeOptimal: Useful size (not too large)? (0-10)
 * - gitActivity: Recent commits? (0-10)
 *
 * Total score: 0-100
 * Files with score > 30 are considered relevant
 */

import path from 'path'

// ============================================================================
// TYPES
// ============================================================================

export interface FileScore {
  path: string
  score: number
  factors: {
    recency: number        // 0-20
    centrality: number     // 0-25
    configRelevance: number // 0-20
    nameRelevance: number  // 0-15
    sizeOptimal: number    // 0-10
    gitActivity: number    // 0-10
  }
}

export interface FileStats {
  path: string
  size: number           // bytes
  mtime: Date            // modification time
  lines?: number         // line count
  imports?: string[]     // files this imports
  importedBy?: string[]  // files that import this
  recentCommits?: number // commits in last 30 days
}

export interface ScoringContext {
  allFiles: Map<string, FileStats>
  configFiles: Set<string>
  maxFileSize: number
  maxRecentCommits: number
  now: Date
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const RELEVANCE_THRESHOLD = 30

// Config file patterns (high importance)
const CONFIG_PATTERNS = [
  /^package\.json$/,
  /^tsconfig.*\.json$/,
  /^\.env(\..*)?$/,
  /^\.eslintrc.*$/,
  /^\.prettierrc.*$/,
  /^vite\.config\.\w+$/,
  /^next\.config\.\w+$/,
  /^webpack\.config\.\w+$/,
  /^rollup\.config\.\w+$/,
  /^jest\.config\.\w+$/,
  /^vitest\.config\.\w+$/,
  /^tailwind\.config\.\w+$/,
  /^postcss\.config\.\w+$/,
  /^Cargo\.toml$/,
  /^go\.mod$/,
  /^pyproject\.toml$/,
  /^requirements\.txt$/,
  /^Dockerfile$/,
  /^docker-compose\.ya?ml$/,
  /^\.github\/workflows\/.*\.ya?ml$/,
]

// Important filename patterns
const IMPORTANT_NAME_PATTERNS = [
  /^index\.\w+$/,         // Entry points
  /^main\.\w+$/,          // Main files
  /^app\.\w+$/,           // App files
  /^server\.\w+$/,        // Server files
  /^router\.\w+$/,        // Router files
  /^routes\.\w+$/,        // Routes
  /^api\.\w+$/,           // API files
  /^schema\.\w+$/,        // Schema files
  /^types?\.\w+$/,        // Type definitions
  /^constants?\.\w+$/,    // Constants
  /^config\.\w+$/,        // Config files
  /^utils?\.\w+$/,        // Utilities
  /^helpers?\.\w+$/,      // Helpers
  /README\.md$/i,         // Documentation
  /CHANGELOG\.md$/i,      // Changelog
]

// ============================================================================
// FILE SCORER
// ============================================================================

export class FileScorer {
  /**
   * Score a single file
   */
  scoreFile(stats: FileStats, context: ScoringContext): FileScore {
    const factors = {
      recency: this.calculateRecency(stats, context),
      centrality: this.calculateCentrality(stats, context),
      configRelevance: this.calculateConfigRelevance(stats),
      nameRelevance: this.calculateNameRelevance(stats),
      sizeOptimal: this.calculateSizeOptimal(stats, context),
      gitActivity: this.calculateGitActivity(stats, context),
    }

    const score = Object.values(factors).reduce((sum, v) => sum + v, 0)

    return {
      path: stats.path,
      score: Math.min(100, Math.max(0, score)),
      factors,
    }
  }

  /**
   * Score all files and return sorted by score
   */
  scoreAll(context: ScoringContext): FileScore[] {
    const scores: FileScore[] = []

    for (const stats of context.allFiles.values()) {
      scores.push(this.scoreFile(stats, context))
    }

    return scores.sort((a, b) => b.score - a.score)
  }

  /**
   * Get relevant files (score > threshold)
   */
  getRelevantFiles(context: ScoringContext, threshold: number = RELEVANCE_THRESHOLD): FileScore[] {
    return this.scoreAll(context).filter(f => f.score >= threshold)
  }

  // ==========================================================================
  // FACTOR CALCULATIONS
  // ==========================================================================

  /**
   * Recency factor (0-20)
   * Files modified recently get higher scores
   */
  private calculateRecency(stats: FileStats, context: ScoringContext): number {
    const daysSinceModified = (context.now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24)

    if (daysSinceModified < 1) return 20    // Today
    if (daysSinceModified < 7) return 15    // This week
    if (daysSinceModified < 30) return 10   // This month
    if (daysSinceModified < 90) return 5    // Last 3 months
    return 0                                 // Older
  }

  /**
   * Centrality factor (0-25)
   * Files imported by many others are more important
   */
  private calculateCentrality(stats: FileStats, context: ScoringContext): number {
    const importedByCount = stats.importedBy?.length || 0
    const totalFiles = context.allFiles.size

    if (totalFiles === 0) return 0

    // Normalize: files imported by 20%+ of codebase get max score
    const ratio = importedByCount / totalFiles
    if (ratio >= 0.2) return 25
    if (ratio >= 0.1) return 20
    if (ratio >= 0.05) return 15
    if (importedByCount >= 5) return 10
    if (importedByCount >= 2) return 5
    return 0
  }

  /**
   * Config relevance factor (0-20)
   * Config files are always important
   */
  private calculateConfigRelevance(stats: FileStats): number {
    const filename = path.basename(stats.path)

    for (const pattern of CONFIG_PATTERNS) {
      if (pattern.test(filename) || pattern.test(stats.path)) {
        return 20
      }
    }

    return 0
  }

  /**
   * Name relevance factor (0-15)
   * Certain filenames indicate importance
   */
  private calculateNameRelevance(stats: FileStats): number {
    const filename = path.basename(stats.path)

    for (const pattern of IMPORTANT_NAME_PATTERNS) {
      if (pattern.test(filename)) {
        return 15
      }
    }

    // Directories that suggest importance
    const dir = path.dirname(stats.path)
    if (dir.includes('/api/') || dir.includes('/routes/')) return 10
    if (dir.includes('/components/') && filename.startsWith('index')) return 10
    if (dir.includes('/pages/') || dir.includes('/app/')) return 8

    return 0
  }

  /**
   * Size optimal factor (0-10)
   * Files that are neither too small nor too large
   */
  private calculateSizeOptimal(stats: FileStats, context: ScoringContext): number {
    const size = stats.size

    // Too small (likely stub or barrel export)
    if (size < 100) return 2

    // Optimal range: 500 bytes to 50KB
    if (size >= 500 && size <= 50_000) return 10

    // Large but not huge (50KB - 200KB)
    if (size > 50_000 && size <= 200_000) return 5

    // Very large files are less useful as context
    if (size > 200_000) return 0

    // Small files (100-500 bytes)
    return 5
  }

  /**
   * Git activity factor (0-10)
   * Files with recent commits are more actively developed
   */
  private calculateGitActivity(stats: FileStats, context: ScoringContext): number {
    const commits = stats.recentCommits || 0

    if (context.maxRecentCommits === 0) return 0

    // Normalize against max
    const ratio = commits / context.maxRecentCommits

    if (ratio >= 0.5) return 10   // Among most active
    if (ratio >= 0.25) return 7
    if (ratio >= 0.1) return 5
    if (commits > 0) return 2
    return 0
  }
}

export const fileScorer = new FileScorer()
export default FileScorer
