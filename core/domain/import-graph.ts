/**
 * Import Graph Builder
 *
 * Builds a directed dependency graph from TypeScript/JavaScript imports.
 * Uses the existing imports-tool parser to extract import relationships.
 *
 * When BM25 identifies a file as relevant, this follows the import chain
 * N levels deep (default: 2) to include closely related files.
 *
 * Score = 1 / (depth + 1) for each reachable file.
 * Direct imports get 0.5, 2nd-level imports get 0.33.
 *
 * @module domain/import-graph
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prjctDb from '../storage/database'

// =============================================================================
// Types
// =============================================================================

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
}

export interface ImportScore {
  path: string
  score: number
  depth: number
}

// =============================================================================
// Constants
// =============================================================================

const INDEXABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.cache',
  '.turbo',
  '.vercel',
])

/** Extensions to try when resolving imports */
const RESOLVE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js']

// =============================================================================
// Import Extraction (lightweight — no dep on imports-tool for build speed)
// =============================================================================

const IMPORT_REGEX = /(?:import|from)\s+['"]([^'"]+)['"]/g

/**
 * Extract internal import paths from file content.
 * Only resolves relative imports (starting with . or @/).
 */
function extractImportSources(content: string): string[] {
  const sources: string[] = []
  let match: RegExpExecArray | null
  const regex = new RegExp(IMPORT_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    const source = match[1]
    if (source.startsWith('.') || source.startsWith('@/')) {
      sources.push(source)
    }
  }
  return sources
}

/**
 * Try to resolve an import source to an actual file path.
 */
async function resolveImport(
  source: string,
  fromFile: string,
  projectPath: string
): Promise<string | null> {
  let basePath: string

  if (source.startsWith('@/')) {
    basePath = path.join(projectPath, 'src', source.slice(2))
  } else {
    const fromDir = path.dirname(path.join(projectPath, fromFile))
    basePath = path.resolve(fromDir, source)
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const fullPath = basePath + ext
    try {
      const stat = await fs.stat(fullPath)
      if (stat.isFile()) {
        return path.relative(projectPath, fullPath)
      }
    } catch {
      // Extension not found, try next
    }
  }
  return null
}

// =============================================================================
// Graph Building
// =============================================================================

/**
 * Recursively list all indexable files.
 */
async function listFiles(dir: string, projectPath: string): Promise<string[]> {
  const files: string[] = []
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, projectPath)))
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase()
      if (INDEXABLE_EXTENSIONS.has(ext)) {
        files.push(path.relative(projectPath, fullPath))
      }
    }
  }
  return files
}

/**
 * Build the import graph for a project.
 *
 * Performance target: <3 seconds for 500-file project.
 */
export async function buildGraph(projectPath: string): Promise<ImportGraph> {
  const files = await listFiles(projectPath, projectPath)
  const forward: ImportAdjacency = {}
  const reverse: ReverseAdjacency = {}
  let edgeCount = 0

  // Process files in parallel batches
  const BATCH_SIZE = 50
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (filePath) => {
        try {
          const content = await fs.readFile(path.join(projectPath, filePath), 'utf-8')
          const sources = extractImportSources(content)
          const resolved: string[] = []

          for (const source of sources) {
            const target = await resolveImport(source, filePath, projectPath)
            if (target && target !== filePath) {
              resolved.push(target)
            }
          }

          return { filePath, imports: resolved }
        } catch {
          return { filePath, imports: [] as string[] }
        }
      })
    )

    for (const { filePath, imports } of results) {
      if (imports.length === 0) continue

      forward[filePath] = imports
      edgeCount += imports.length

      for (const target of imports) {
        if (!reverse[target]) reverse[target] = []
        reverse[target].push(filePath)
      }
    }
  }

  return {
    forward,
    reverse,
    fileCount: files.length,
    edgeCount,
    builtAt: new Date().toISOString(),
  }
}

// =============================================================================
// Graph Scoring
// =============================================================================

/**
 * Given a set of seed files (e.g., from BM25), follow import chains
 * and score connected files by proximity.
 *
 * Score = 1 / (depth + 1):
 * - Seed file itself: not scored (already scored by BM25)
 * - Direct import/importer: 0.5 (depth=1)
 * - 2nd-level: 0.33 (depth=2)
 *
 * Follows both forward (imports) and reverse (imported-by) edges.
 *
 * @param seedFiles - Files already identified as relevant
 * @param graph - The import graph
 * @param maxDepth - Maximum depth to follow (default: 2)
 * @returns Scored files NOT in the seed set
 */
export function scoreFromSeeds(
  seedFiles: string[],
  graph: ImportGraph,
  maxDepth = 2
): ImportScore[] {
  const seedSet = new Set(seedFiles)
  const visited = new Map<string, { score: number; depth: number }>()

  // BFS from each seed
  const queue: Array<{ file: string; depth: number }> = []

  for (const seed of seedFiles) {
    // Add direct neighbors at depth 1
    const forwardEdges = graph.forward[seed] || []
    const reverseEdges = graph.reverse[seed] || []

    for (const neighbor of [...forwardEdges, ...reverseEdges]) {
      if (!seedSet.has(neighbor)) {
        queue.push({ file: neighbor, depth: 1 })
      }
    }
  }

  // Process queue
  while (queue.length > 0) {
    const { file, depth } = queue.shift()!
    if (depth > maxDepth) continue

    const score = 1 / (depth + 1)
    const existing = visited.get(file)

    if (existing) {
      // Keep the better (higher) score
      if (score > existing.score) {
        visited.set(file, { score, depth })
      }
      continue
    }

    visited.set(file, { score, depth })

    // Continue BFS for next level
    if (depth < maxDepth) {
      const forwardEdges = graph.forward[file] || []
      const reverseEdges = graph.reverse[file] || []

      for (const neighbor of [...forwardEdges, ...reverseEdges]) {
        if (!seedSet.has(neighbor) && !visited.has(neighbor)) {
          queue.push({ file: neighbor, depth: depth + 1 })
        }
      }
    }
  }

  return Array.from(visited.entries())
    .map(([p, { score, depth }]) => ({ path: p, score, depth }))
    .sort((a, b) => b.score - a.score)
}

// =============================================================================
// SQLite Persistence
// =============================================================================

const INDEX_KEY = 'import-graph'

export function saveGraph(projectId: string, graph: ImportGraph): void {
  prjctDb.setDoc(projectId, INDEX_KEY, graph)
}

export function loadGraph(projectId: string): ImportGraph | null {
  return prjctDb.getDoc<ImportGraph>(projectId, INDEX_KEY)
}

// =============================================================================
// High-level API
// =============================================================================

/**
 * Build and persist the import graph for a project.
 */
export async function indexImports(projectPath: string, projectId: string): Promise<ImportGraph> {
  const graph = await buildGraph(projectPath)
  saveGraph(projectId, graph)
  return graph
}
