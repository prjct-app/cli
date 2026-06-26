/**
 * Shared utilities + value types for the wiki builders.
 *
 * Kept tiny on purpose — anything that grows past a couple of helpers
 * should move to its own builder module instead of accreting here.
 */

import crypto from 'node:crypto'
import type { LLMAnalysis } from '../../types/llm-analysis'

/**
 * Max entries per file. When a bucket exceeds this it's paginated into
 * `<bucket>/chunk-1.md`, `<bucket>/chunk-2.md`, etc. with the root file
 * becoming an index. 50 is ~3-5K tokens per chunk — small enough that
 * an agent reading one stays under a reasonable budget.
 */
export const CHUNK_SIZE = 50
export const VAULT_HOME_FILE = 'project-context.md'
export const ANALYSIS_MAP_FILE = 'analysis/analysis-map.md'
export const RELEASE_HISTORY_FILE = 'releases/release-history.md'
export const WORKFLOW_MAP_FILE = 'workflows/workflow-map.md'
export const SPEC_ROADMAP_FILE = 'specs/spec-roadmap.md'
export const VAULT_START_HERE_FILE = 'START-HERE-prjct-vault.md'
export const CAPTURED_GUIDE_FILE = 'how-to-capture-notes.md'
export const WORKFLOWS_GUIDE_FILE = 'how-to-edit-workflows.md'

export type Manifest = Record<string, string>

export type ConceptKind =
  | 'pattern'
  | 'anti-pattern'
  | 'tech-debt'
  | 'risk-area'
  | 'refactor'
  | 'insight'

export const CONCEPT_FOLDERS: Record<ConceptKind, string> = {
  pattern: 'patterns',
  'anti-pattern': 'anti-patterns',
  'tech-debt': 'tech-debt',
  'risk-area': 'risk-areas',
  refactor: 'refactors',
  insight: 'insights',
}

export type ArchiveEntry = {
  id: number
  status: string
  commitHash: string | null
  analyzedAt: string
  supersededAt: string | null
  analysis: LLMAnalysis
}

export type ConceptRecord = {
  kind: ConceptKind
  name: string
  slug: string
  latestBody: Record<string, unknown>
  firstSeen: string
  lastSeen: string
  seenIn: Array<{ analysisId: number; date: string; commit: string | null }>
  stillActive: boolean
}

export type ReleaseEntry = {
  version: string
  date: string
  body: string
}

// Moved to utils so retrieval (FTS keyword sanitizing) can share it
// without importing wiki internals. Re-exported to keep this module's API.
import { deburr } from '../../utils/deburr'

export { deburr }

export function slugify(value: string, max = 60): string {
  let slug = deburr(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  if (slug.length > max) {
    // Cut at a word boundary — `...porque-la-key-guardada-es-de.md` style
    // mid-word truncation made filenames unreadable in the file view.
    const cut = slug.lastIndexOf('-', max)
    slug = slug.slice(0, cut > max / 2 ? cut : max).replace(/-+$/, '')
  }
  return slug || 'unnamed'
}

export function sha256(body: string): string {
  return crypto.createHash('sha256').update(body).digest('hex').slice(0, 16)
}

/** Truncate to at most `max` chars, appending an ellipsis when shortened.
 *  The result (including the ellipsis) never exceeds `max`. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function chunkEntries<T>(entries: T[], size = CHUNK_SIZE): T[][] {
  if (entries.length <= size) return [entries]
  const out: T[][] = []
  for (let i = 0; i < entries.length; i += size) out.push(entries.slice(i, i + size))
  return out
}

export function conceptKey(kind: ConceptKind, name: string): string {
  return `${kind}::${name.trim().toLowerCase()}`
}

export function analysisDateOnly(entry: ArchiveEntry): string {
  const m = (entry.analyzedAt || '').match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : 'undated'
}
