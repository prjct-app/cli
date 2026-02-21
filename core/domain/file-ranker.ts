/**
 * File Ranker — Combined Scoring
 *
 * Combines three signals to rank files by relevance to a task:
 * - BM25 text search (0.5 weight)
 * - Import graph proximity (0.3 weight)
 * - Git co-change correlation (0.2 weight)
 *
 * Zero API calls. Pure math on pre-built indexes.
 *
 * @module domain/file-ranker
 * @version 1.0.0
 */

import type { RankedFile, RankingConfig } from '../types/domain.js'
import { loadIndex, queryFiles } from './bm25'
import { scoreFromSeeds as cochangeScore, loadMatrix } from './git-cochange'
import { scoreFromSeeds as importScore, loadGraph } from './import-graph'

const DEFAULT_CONFIG: Required<RankingConfig> = {
  bm25Weight: 0.5,
  importWeight: 0.3,
  cochangeWeight: 0.2,
  topN: 15,
  importDepth: 2,
}

// =============================================================================
// Combined Ranking
// =============================================================================

/**
 * Rank files by combined relevance to a task description.
 *
 * Algorithm:
 * 1. BM25: Score all files against the query
 * 2. Import graph: From top BM25 hits, follow imports 2 levels deep
 * 3. Co-change: From top BM25 hits, find co-changed files
 * 4. Normalize each signal to [0, 1]
 * 5. Combine: finalScore = bm25 * 0.5 + imports * 0.3 + cochange * 0.2
 *
 * Performance target: <50ms per query (all indexes pre-loaded from SQLite).
 */
export function rankFiles(
  projectId: string,
  query: string,
  config: RankingConfig = {}
): RankedFile[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }

  // 1. BM25 scoring — get broad candidate set
  const bm25Results = queryFiles(projectId, query, cfg.topN * 3) // Get more candidates
  if (bm25Results.length === 0) return []

  // Normalize BM25 scores to [0, 1]
  const maxBm25 = bm25Results[0]?.score || 1
  const bm25Map = new Map<string, number>()
  for (const result of bm25Results) {
    bm25Map.set(result.path, result.score / maxBm25)
  }

  // Seed files: top BM25 hits for graph traversal
  const seedFiles = bm25Results.slice(0, 10).map((r) => r.path)

  // 2. Import graph scoring
  const importMap = new Map<string, number>()
  const graph = loadGraph(projectId)
  if (graph) {
    const importResults = importScore(seedFiles, graph, cfg.importDepth)
    const maxImport = importResults[0]?.score || 1
    for (const result of importResults) {
      importMap.set(result.path, result.score / maxImport)
    }
  }

  // 3. Co-change scoring
  const cochangeMap = new Map<string, number>()
  const cochangeIndex = loadMatrix(projectId)
  if (cochangeIndex) {
    const cochangeResults = cochangeScore(seedFiles, cochangeIndex)
    const maxCochange = cochangeResults[0]?.score || 1
    for (const result of cochangeResults) {
      cochangeMap.set(result.path, result.score / maxCochange)
    }
  }

  // 4. Collect all candidate files
  const allFiles = new Set([...bm25Map.keys(), ...importMap.keys(), ...cochangeMap.keys()])

  // 5. Combined scoring
  const ranked: RankedFile[] = []
  for (const filePath of allFiles) {
    const bm25 = bm25Map.get(filePath) || 0
    const imports = importMap.get(filePath) || 0
    const cochange = cochangeMap.get(filePath) || 0

    const finalScore =
      bm25 * cfg.bm25Weight + imports * cfg.importWeight + cochange * cfg.cochangeWeight

    ranked.push({
      path: filePath,
      finalScore,
      signals: { bm25, imports, cochange },
    })
  }

  // Sort by finalScore descending, return top N
  ranked.sort((a, b) => b.finalScore - a.finalScore)
  return ranked.slice(0, cfg.topN)
}

/**
 * Check if all three indexes exist for a project.
 */
export function hasIndexes(projectId: string): {
  bm25: boolean
  imports: boolean
  cochange: boolean
} {
  return {
    bm25: loadIndex(projectId) !== null,
    imports: loadGraph(projectId) !== null,
    cochange: loadMatrix(projectId) !== null,
  }
}
