import { hasIndexes, rankFiles } from '../domain/file-ranker'

export interface LikelyFileHit {
  path: string
  signals: string[]
}

const DEFAULT_FILE_CUE_COUNT = 5

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
  }))
}

export function formatLikelyFileForAgent(file: LikelyFileHit): string {
  const suffix = file.signals.length > 0 ? ` (${file.signals.join('+')})` : ''
  return `\`${file.path}\`${suffix}`
}

export function buildIndexedFileCue(projectId: string, query: string): string | null {
  const files = rankLikelyFiles(projectId, query)
  if (files.length === 0) return null
  return [
    '**Likely files from prjct index:**',
    ...files.map((file) => `- ${formatLikelyFileForAgent(file)}`),
  ].join('\n')
}
