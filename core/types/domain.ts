/**
 * Domain Types
 * Types for domain layer modules.
 */

// Task Stack Types

/**
 * Task entry in the stack (JSONL format)
 */
export interface TaskStackEntry {
  id: string
  task: string
  agent: string
  status: 'active' | 'paused' | 'completed'
  started: string
  paused: string | null
  resumed: string | null
  completed: string | null
  duration: number | null
  durationFormatted?: string
  complexity: string
  dev: string
  pauseReason?: string
  pausedDuration?: number
}

/**
 * Result of migrating from legacy now.md to stack
 */
export interface TaskStackMigrationResult {
  migrated: boolean
  hadTask?: boolean
  task?: TaskStackEntry
  error?: string
}

/**
 * Result of switching between tasks
 */
export interface TaskSwitchResult {
  paused: TaskStackEntry | null
  resumed?: TaskStackEntry
  started?: TaskStackEntry
  type: 'resumed' | 'started'
}

/**
 * Summary of task stack state
 */
export interface TaskStackSummary {
  active: TaskStackEntry | null
  paused: TaskStackEntry[]
  pausedCount: number
  completed: TaskStackEntry[]
  completedCount: number
  totalTasks: number
}

// BM25 Types

export interface BM25Document {
  path: string
  tokens: string[]
  length: number
}

export interface BM25Index {
  /** Map of file path → token list and document length */
  documents: Record<string, { tokens: string[]; length: number }>
  /** Inverted index: token → list of (path, term frequency) */
  invertedIndex: Record<string, Array<{ path: string; tf: number }>>
  /** Average document length across all documents */
  avgDocLength: number
  /** Total number of indexed documents */
  totalDocs: number
  /** Build timestamp */
  builtAt: string
  /** Fingerprint of the git history window used to build the matrix */
  historyFingerprint?: string
}

export interface BM25Score {
  path: string
  score: number
}

// File Hasher Types

export interface FileHash {
  path: string
  hash: string
  size: number
  mtime: string
}

export interface FileDiff {
  added: string[]
  modified: string[]
  deleted: string[]
  unchanged: string[]
}

export interface HashRegistry {
  files: Map<string, FileHash>
  builtAt: string
}

// File Ranker Types

export interface RankedFile {
  path: string
  finalScore: number
  signals: {
    bm25: number
    imports: number
    cochange: number
  }
}

export interface RankingConfig {
  /** Weight for BM25 text relevance (default: 0.5) */
  bm25Weight?: number
  /** Weight for import graph proximity (default: 0.3) */
  importWeight?: number
  /** Weight for git co-change correlation (default: 0.2) */
  cochangeWeight?: number
  /** Maximum number of results (default: 15) */
  topN?: number
  /** Maximum depth for import graph traversal (default: 2) */
  importDepth?: number
}

// Change Propagator Types

export interface PropagatedChanges {
  /** Files that changed directly (added + modified from hash diff) */
  directlyChanged: string[]
  /** Files that import a directly changed file (1 level deep) */
  affectedByImports: string[]
  /** Union of directlyChanged + affectedByImports (deduplicated) */
  allAffected: string[]
  /** Files that were deleted */
  deleted: string[]
}

// Import Graph Types

/** Adjacency list: file → list of files it imports (resolved paths) */
export type ImportAdjacency = Record<string, string[]>

/** Reverse adjacency: file → list of files that import it */
export type ReverseAdjacency = Record<string, string[]>

export interface ImportGraph {
  /** Forward edges: file imports these files */
  forward: ImportAdjacency
  /** Reverse edges: file is imported by these files */
  reverse: ReverseAdjacency
  /** Total number of files in the graph */
  fileCount: number
  /** Total number of edges */
  edgeCount: number
  /** Build timestamp */
  builtAt: string
  /** Fingerprint of the git history window used to build the matrix */
  historyFingerprint?: string
}

export interface ImportScore {
  path: string
  score: number
  depth: number
}

// Fibonacci Types

export type FibonacciPoint = 1 | 2 | 3 | 5 | 8 | 13 | 21

// Git Co-Change Types

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
  /** Fingerprint of the git history window used to build the matrix */
  historyFingerprint?: string
}

export interface CoChangeScore {
  path: string
  score: number
}
