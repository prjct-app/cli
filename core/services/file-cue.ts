import { hasIndexes, rankFiles } from '../domain/file-ranker'

export interface LikelyFileHit {
  path: string
  signals: string[]
  /** One-line, honest reason this file surfaced — lets the agent trust the cue
   *  and read it directly instead of grep-walking the repo. */
  reason: string
}

const DEFAULT_FILE_CUE_COUNT = 5

/**
 * Translate the dominant ranking signal into a short, honest reason. The agent
 * uses this to decide whether to open the file — a `path` alone reads as a guess,
 * a `path — why` reads as a lead. Derived purely from signals already computed
 * by `rankFiles` (zero extra DB work).
 */
function reasonFromSignals(signals: { bm25: number; imports: number; cochange: number }): string {
  const ranked = [
    { name: 'bm25', score: signals.bm25, label: 'matches your task terms' },
    { name: 'imports', score: signals.imports, label: 'in the import graph of matched files' },
    {
      name: 'cochange',
      score: signals.cochange,
      label: 'historically co-changes with matched files',
    },
  ]
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
  if (ranked.length === 0) return 'related by prjct index'
  return ranked[0]!.label
}

export function rankLikelyFiles(
  projectId: string,
  query: string,
  limit: number = DEFAULT_FILE_CUE_COUNT
): LikelyFileHit[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const indexes = hasIndexes(projectId)
  if (!indexes.bm25) return []

  return rankFiles(projectId, trimmed, { topN: limit }).map((file) => ({
    path: file.path,
    signals: [
      file.signals.bm25 > 0 ? 'bm25' : null,
      file.signals.imports > 0 ? 'imports' : null,
      file.signals.cochange > 0 ? 'cochange' : null,
    ].filter((signal): signal is string => signal !== null),
    reason: reasonFromSignals(file.signals),
  }))
}

export function formatLikelyFileForAgent(file: LikelyFileHit): string {
  const suffix = file.signals.length > 0 ? ` (${file.signals.join('+')})` : ''
  return `\`${file.path}\` — ${file.reason}${suffix}`
}

export function buildIndexedFileCue(projectId: string, query: string): string | null {
  const files = rankLikelyFiles(projectId, query)
  if (files.length === 0) return null
  return [
    '**Likely files from prjct index:**',
    ...files.map((file) => `- ${formatLikelyFileForAgent(file)}`),
  ].join('\n')
}
