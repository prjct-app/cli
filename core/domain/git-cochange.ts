/**
 * Git Co-Change Analyzer
 *
 * Analyzes git history to find files that frequently change together.
 * If middleware.ts appears in 8 of 10 commits that touch auth.ts,
 * they're a cluster — when one is relevant, include the other.
 *
 * Uses Jaccard similarity: |A ∩ B| / |A ∪ B| for each file pair.
 *
 * Zero API calls — pure math on git log data.
 *
 * @module domain/git-cochange
 * @version 1.0.0
 */

import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import prjctDb from '../storage/database'

const exec = promisify(execCallback)

// =============================================================================
// Types
// =============================================================================

/** Co-change matrix: file → { related_file: similarity_score } */
export type CoChangeMatrix = Record<string, Record<string, number>>

export interface CoChangeIndex {
  /** The co-change similarity matrix */
  matrix: CoChangeMatrix
  /** Number of commits analyzed */
  commitsAnalyzed: number
  /** Total unique files seen */
  filesAnalyzed: number
  /** Build timestamp */
  builtAt: string
}

export interface CoChangeScore {
  path: string
  score: number
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum Jaccard similarity to include in the matrix */
const MIN_SIMILARITY = 0.1

/** Minimum times a file must appear in commits to be included */
const MIN_FILE_OCCURRENCES = 2

/** Maximum number of files in a single commit to consider (skip merges/bulk) */
const MAX_FILES_PER_COMMIT = 30

// =============================================================================
// Git Log Parsing
// =============================================================================

/**
 * Parse git log to extract commit → files mapping.
 *
 * @param projectPath - Project root path
 * @param maxCommits - Maximum number of commits to analyze (default: 100)
 * @returns Array of file sets, one per commit
 */
async function parseGitLog(projectPath: string, maxCommits = 100): Promise<Set<string>[]> {
  try {
    const { stdout } = await exec(
      `git log --name-only --pretty=format:'---COMMIT---' -${maxCommits}`,
      { cwd: projectPath, maxBuffer: 10 * 1024 * 1024 }
    )

    const commits: Set<string>[] = []
    let currentFiles: Set<string> | null = null

    for (const line of stdout.split('\n')) {
      const trimmed = line.trim()
      if (trimmed === '---COMMIT---') {
        if (currentFiles && currentFiles.size > 0 && currentFiles.size <= MAX_FILES_PER_COMMIT) {
          commits.push(currentFiles)
        }
        currentFiles = new Set()
      } else if (trimmed && currentFiles) {
        // Only include source files (skip binaries, lockfiles, etc.)
        if (isSourceFile(trimmed)) {
          currentFiles.add(trimmed)
        }
      }
    }

    // Don't forget the last commit
    if (currentFiles && currentFiles.size > 0 && currentFiles.size <= MAX_FILES_PER_COMMIT) {
      commits.push(currentFiles)
    }

    return commits
  } catch {
    return []
  }
}

/**
 * Check if a path looks like a source file worth tracking.
 */
function isSourceFile(filePath: string): boolean {
  const sourceExtensions = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|cs|rb|php|vue|svelte)$/i
  return sourceExtensions.test(filePath) && !filePath.includes('node_modules/')
}

// =============================================================================
// Co-Change Matrix
// =============================================================================

/**
 * Build a co-change matrix from git history.
 *
 * For each pair of files that appear in the same commit,
 * calculate Jaccard similarity = |commits_both| / |commits_either|.
 *
 * Performance target: <2 seconds for 100 commits.
 */
export async function buildMatrix(projectPath: string, maxCommits = 100): Promise<CoChangeIndex> {
  const commitSets = await parseGitLog(projectPath, maxCommits)

  // Count how many commits each file appears in
  const fileCommitCount = new Map<string, number>()
  // Count how many commits each pair appears in together
  const pairCount = new Map<string, number>()

  for (const files of commitSets) {
    const fileArray = Array.from(files)

    for (const file of fileArray) {
      fileCommitCount.set(file, (fileCommitCount.get(file) || 0) + 1)
    }

    // Count co-occurrences for each pair
    for (let i = 0; i < fileArray.length; i++) {
      for (let j = i + 1; j < fileArray.length; j++) {
        const key = pairKey(fileArray[i], fileArray[j])
        pairCount.set(key, (pairCount.get(key) || 0) + 1)
      }
    }
  }

  // Build Jaccard similarity matrix
  const matrix: CoChangeMatrix = {}

  for (const [key, count] of pairCount) {
    const [fileA, fileB] = key.split('\0')
    const countA = fileCommitCount.get(fileA) || 0
    const countB = fileCommitCount.get(fileB) || 0

    // Skip rare files
    if (countA < MIN_FILE_OCCURRENCES || countB < MIN_FILE_OCCURRENCES) continue

    // Jaccard similarity
    const unionCount = countA + countB - count
    const similarity = unionCount > 0 ? count / unionCount : 0

    if (similarity < MIN_SIMILARITY) continue

    // Store bidirectionally
    if (!matrix[fileA]) matrix[fileA] = {}
    if (!matrix[fileB]) matrix[fileB] = {}
    matrix[fileA][fileB] = similarity
    matrix[fileB][fileA] = similarity
  }

  return {
    matrix,
    commitsAnalyzed: commitSets.length,
    filesAnalyzed: fileCommitCount.size,
    builtAt: new Date().toISOString(),
  }
}

/** Create a canonical pair key (sorted to avoid duplicates) */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`
}

// =============================================================================
// Scoring
// =============================================================================

/**
 * Given a set of seed files, find co-changed files and their scores.
 *
 * @param seedFiles - Files already identified as relevant
 * @param index - The co-change index
 * @returns Scored files NOT in the seed set
 */
export function scoreFromSeeds(seedFiles: string[], index: CoChangeIndex): CoChangeScore[] {
  const seedSet = new Set(seedFiles)
  const scores = new Map<string, number>()

  for (const seed of seedFiles) {
    const related = index.matrix[seed]
    if (!related) continue

    for (const [file, similarity] of Object.entries(related)) {
      if (seedSet.has(file)) continue

      // Take the max similarity across all seed connections
      const existing = scores.get(file) || 0
      if (similarity > existing) {
        scores.set(file, similarity)
      }
    }
  }

  return Array.from(scores.entries())
    .map(([p, s]) => ({ path: p, score: s }))
    .sort((a, b) => b.score - a.score)
}

// =============================================================================
// SQLite Persistence
// =============================================================================

const INDEX_KEY = 'cochange-index'

export function saveMatrix(projectId: string, index: CoChangeIndex): void {
  prjctDb.setDoc(projectId, INDEX_KEY, index)
}

export function loadMatrix(projectId: string): CoChangeIndex | null {
  return prjctDb.getDoc<CoChangeIndex>(projectId, INDEX_KEY)
}

// =============================================================================
// High-level API
// =============================================================================

/**
 * Build and persist the co-change matrix for a project.
 */
export async function indexCoChanges(
  projectPath: string,
  projectId: string,
  maxCommits = 100
): Promise<CoChangeIndex> {
  const index = await buildMatrix(projectPath, maxCommits)
  saveMatrix(projectId, index)
  return index
}
