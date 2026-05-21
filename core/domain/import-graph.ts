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
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { IMPORT_REGEX, RESOLVE_EXTENSIONS } from '../constants/file-patterns'
import prjctDb from '../storage/database'
import type {
  ImportAdjacency,
  ImportGraph,
  ImportScore,
  ReverseAdjacency,
} from '../types/domain.js'
import { batchProcess, walkDir } from '../utils/file-helper'

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

// Graph Building

/**
 * Build the import graph for a project.
 *
 * Performance target: <3 seconds for 500-file project.
 */
export async function buildGraph(projectPath: string): Promise<ImportGraph> {
  const files = await walkDir(projectPath)
  const forward: ImportAdjacency = {}
  const reverse: ReverseAdjacency = {}
  let edgeCount = 0

  // Process files in parallel batches of 50
  const results = await batchProcess(files, 50, async (filePath) => {
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

      return resolved.length > 0 ? { filePath, imports: resolved } : null
    } catch {
      return null
    }
  })

  for (const { filePath, imports } of results) {
    forward[filePath] = imports
    edgeCount += imports.length

    for (const target of imports) {
      if (!reverse[target]) reverse[target] = []
      reverse[target].push(filePath)
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

// Graph Scoring

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

// SQLite Persistence

const INDEX_KEY = 'import-graph'

// Process-local mtime cache. The graph can be a few MB after JSON.parse;
// MCP tool calls that ask for related/impact files in succession would
// otherwise re-parse on every call. Invalidation is exact: we look up
// the kv_store row's `updated_at` (cheap SQL) and only re-parse when it
// has changed since the last successful load.
const graphCache = new Map<string, { graph: ImportGraph; updatedAt: string }>()

export function saveGraph(projectId: string, graph: ImportGraph): void {
  prjctDb.setDoc(projectId, INDEX_KEY, graph)
  graphCache.delete(projectId)
}

export function loadGraph(projectId: string): ImportGraph | null {
  const meta = prjctDb.get<{ updated_at: string }>(
    projectId,
    'SELECT updated_at FROM kv_store WHERE key = ?',
    INDEX_KEY
  )
  if (!meta) {
    graphCache.delete(projectId)
    return null
  }
  const hit = graphCache.get(projectId)
  if (hit && hit.updatedAt === meta.updated_at) return hit.graph
  const graph = prjctDb.getDoc<ImportGraph>(projectId, INDEX_KEY)
  if (graph) graphCache.set(projectId, { graph, updatedAt: meta.updated_at })
  return graph
}

// High-level API

/**
 * Build and persist the import graph for a project.
 */
export async function indexImports(projectPath: string, projectId: string): Promise<ImportGraph> {
  const graph = await buildGraph(projectPath)
  saveGraph(projectId, graph)
  return graph
}
