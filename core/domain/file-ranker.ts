/**
 * File Ranker — Combined Scoring
 *
 * Combines every signal in the indexer registry to rank files by
 * relevance to a task description. Today the registry contains:
 *   - BM25 text search        (query-driven, default 0.5 weight)
 *   - Import graph proximity  (seed-driven,  default 0.3 weight)
 *   - Git co-change           (seed-driven,  default 0.2 weight)
 *
 * Adding a new signal is a one-file change in `./indexers/registry.ts`.
 * Zero API calls. Pure math on pre-built indexes.
 *
 * Algorithm:
 * 1. Run every query indexer to build candidates (today: BM25 only).
 * 2. Take top-10 candidates as seed files for graph traversal.
 * 3. Run every seed indexer over those seeds.
 * 4. Combine: finalScore = Σ (signal × weight).
 *
 * Performance target: <50ms per query (all indexes pre-loaded from SQLite).
 *
 */

import type { RankedFile, RankingConfig } from '../types/domain.js'
import { indexerRegistry, type QueryIndexer, type SeedIndexer } from './indexers/registry'

const DEFAULT_CONFIG: Required<RankingConfig> = {
  bm25Weight: 0.5,
  importWeight: 0.3,
  cochangeWeight: 0.2,
  topN: 15,
  importDepth: 2,
}

const SEED_FILE_LIMIT = 10

export function rankFiles(
  projectId: string,
  query: string,
  config: RankingConfig = {}
): RankedFile[] {
  const cfg = { ...DEFAULT_CONFIG, ...config }
  const weights: Record<string, number> = {
    bm25: cfg.bm25Weight,
    imports: cfg.importWeight,
    cochange: cfg.cochangeWeight,
  }

  const queryIndexers = indexerRegistry.filter((i): i is QueryIndexer => i.kind === 'query')
  const seedIndexers = indexerRegistry.filter((i): i is SeedIndexer => i.kind === 'seed')

  // Run every query-driven indexer to build candidates. The first non-empty
  // result also seeds the seed-driven indexers below.
  const scoresByIndexer = new Map<string, Map<string, number>>()
  let seedFiles: string[] = []
  for (const idx of queryIndexers) {
    const scores = idx.scoreFromQuery(projectId, query, cfg.topN * 3)
    if (scores.length === 0) continue
    scoresByIndexer.set(idx.name, new Map(scores.map((s) => [s.path, s.score])))
    if (seedFiles.length === 0) {
      seedFiles = scores.slice(0, SEED_FILE_LIMIT).map((s) => s.path)
    }
  }
  if (scoresByIndexer.size === 0) return []

  for (const idx of seedIndexers) {
    const scores = idx.scoreFromSeeds(projectId, seedFiles, {
      importDepth: cfg.importDepth,
    })
    if (scores.length === 0) continue
    scoresByIndexer.set(idx.name, new Map(scores.map((s) => [s.path, s.score])))
  }

  const allFiles = new Set<string>()
  for (const map of scoresByIndexer.values()) {
    for (const k of map.keys()) allFiles.add(k)
  }

  const ranked: RankedFile[] = []
  for (const filePath of allFiles) {
    let finalScore = 0
    for (const [name, map] of scoresByIndexer) {
      const s = map.get(filePath) ?? 0
      const w = weights[name] ?? indexerRegistry.find((i) => i.name === name)?.defaultWeight ?? 0
      finalScore += s * w
    }
    ranked.push({
      path: filePath,
      finalScore,
      signals: {
        bm25: scoresByIndexer.get('bm25')?.get(filePath) ?? 0,
        imports: scoresByIndexer.get('imports')?.get(filePath) ?? 0,
        cochange: scoresByIndexer.get('cochange')?.get(filePath) ?? 0,
      },
    })
  }

  ranked.sort((a, b) => b.finalScore - a.finalScore)
  return ranked.slice(0, cfg.topN)
}

/**
 * Check whether each registered index has data for this project.
 * Public shape (`bm25`, `imports`, `cochange`) is preserved for
 * existing callers (CLI / tests). New signals added to the registry
 * are reachable via `hasIndexesAll(projectId)`.
 */
export function hasIndexes(projectId: string): {
  bm25: boolean
  imports: boolean
  cochange: boolean
} {
  const presence: Record<string, boolean> = {}
  for (const idx of indexerRegistry) {
    presence[idx.name] = idx.hasIndex(projectId)
  }
  return {
    bm25: presence.bm25 ?? false,
    imports: presence.imports ?? false,
    cochange: presence.cochange ?? false,
  }
}

/**
 * Generic counterpart of {@link hasIndexes} — returns presence keyed
 * by every registered indexer name. Use this when a new signal has
 * been added to the registry and you need to inspect it.
 */
export function hasIndexesAll(projectId: string): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const idx of indexerRegistry) {
    out[idx.name] = idx.hasIndex(projectId)
  }
  return out
}
