/**
 * Indexer registry — every ranking signal (BM25, import-graph,
 * git-cochange, future ones) declares itself here. The file-ranker
 * iterates the registry instead of importing each indexer module
 * directly, so adding a 4th signal becomes a single registry entry.
 *
 * Two kinds of indexers:
 *   - `query` indexers consume the user's query string and produce
 *     the candidate set. Today only BM25.
 *   - `seed` indexers consume the seed files (top-k from the candidate
 *     set) and re-rank by some structural relationship. Currently
 *     import-graph proximity and git-cochange correlation.
 *
 * All indexers return [0, 1]-normalized scores so the final weighted
 * sum in file-ranker stays straightforward.
 */

import { hasIndex as bm25HasIndex, queryFiles } from '../bm25'
import { scoreFromSeeds as cochangeScoreFromSeeds, loadMatrix } from '../git-cochange'
import { scoreFromSeeds as importScoreFromSeeds, loadGraph } from '../import-graph'
import { hasSymbolIndex, scoreFilesFromQuery } from '../symbol-graph'

export interface NormalizedScore {
  path: string
  /** Always in [0, 1] — indexers are responsible for normalizing. */
  score: number
}

interface IndexerBase {
  name: string
  defaultWeight: number
  hasIndex(projectId: string): boolean
}

export interface QueryIndexer extends IndexerBase {
  kind: 'query'
  scoreFromQuery(projectId: string, query: string, topN: number): NormalizedScore[]
}

export interface SeedIndexer extends IndexerBase {
  kind: 'seed'
  scoreFromSeeds(
    projectId: string,
    seeds: string[],
    opts: { importDepth: number }
  ): NormalizedScore[]
}

export type Indexer = QueryIndexer | SeedIndexer

function normalize<T extends { path: string; score: number }>(results: T[]): NormalizedScore[] {
  if (results.length === 0) return []
  const max = results[0]?.score || 1
  return results.map((r) => ({ path: r.path, score: r.score / max }))
}

export const indexerRegistry: Indexer[] = [
  {
    name: 'bm25',
    kind: 'query',
    defaultWeight: 0.45,
    hasIndex: (projectId) => bm25HasIndex(projectId),
    scoreFromQuery: (projectId, query, topN) => normalize(queryFiles(projectId, query, topN)),
  },
  {
    name: 'symbols',
    kind: 'query',
    // Structural symbol-name match (functions/classes/routes) — CBM-inspired.
    defaultWeight: 0.2,
    hasIndex: (projectId) => hasSymbolIndex(projectId),
    scoreFromQuery: (projectId, query, topN) =>
      normalize(scoreFilesFromQuery(projectId, query, topN)),
  },
  {
    name: 'imports',
    kind: 'seed',
    defaultWeight: 0.2,
    hasIndex: (projectId) => loadGraph(projectId) !== null,
    scoreFromSeeds: (projectId, seeds, opts) => {
      const graph = loadGraph(projectId)
      if (!graph) return []
      return normalize(importScoreFromSeeds(seeds, graph, opts.importDepth))
    },
  },
  {
    name: 'cochange',
    kind: 'seed',
    defaultWeight: 0.15,
    hasIndex: (projectId) => loadMatrix(projectId) !== null,
    scoreFromSeeds: (projectId, seeds) => {
      const index = loadMatrix(projectId)
      if (!index) return []
      return normalize(cochangeScoreFromSeeds(seeds, index))
    },
  },
]
