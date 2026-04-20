/**
 * Project Memory API — the v2 "super memory" layer.
 *
 * One unified surface over the memory sources that were scattered across
 * services: the events table (prjct_mem_save), `shipped_features`,
 * `confirmed_classifications`, and pattern extraction. Built so an LLM can
 * ask a single question ("what do you know about auth?") and get back a
 * dense, filtered answer.
 *
 * Entry types:
 *   fact          — something true about the project
 *   decision      — choice made and rationale (why, not what)
 *   learning      — lesson from a mistake or surprise
 *   gotcha        — non-obvious trap for future readers
 *   pattern       — recurring technique that works here
 *   anti-pattern  — technique that hurt us and should be avoided
 *   shipped       — auto-recorded when a task ships
 *
 * Storage: reuses the events table via memoryService (type prefix
 * `remember.<type>`) for user-captured entries, plus `shipped_features` for
 * auto-recorded ships. No schema migration — PR 4 can add a dedicated table
 * later if volume demands it.
 */

import { memoryService } from '../services/memory-service'
import prjctDb from '../storage/database'
import { REMEMBER_ACTION_PREFIX, REMEMBER_EVENT_PREFIX } from './events'

/**
 * Exported list so callers (primitives, wiki, context tools) share a single
 * source of truth. Derive the union type from the tuple.
 */
export const MEMORY_TYPES = [
  'fact',
  'decision',
  'learning',
  'gotcha',
  'pattern',
  'anti-pattern',
  'shipped',
] as const

export type MemoryType = (typeof MEMORY_TYPES)[number]

/**
 * Where an entry came from. Lets Claude calibrate trust:
 *   declared  — user / LLM wrote this via `prjct remember`
 *   extracted — auto-recorded from verifiable project state (ships, tags)
 *   inferred  — pattern-extractor or heuristic guess; weakest signal
 *   ambiguous — mixed provenance or confidence unclear
 */
export type MemoryProvenance = 'declared' | 'extracted' | 'inferred' | 'ambiguous'

export interface MemoryEntry {
  /** Stable identifier for `prjct remember forget <id>` */
  id: string
  type: MemoryType
  content: string
  tags: Record<string, string>
  /** ISO8601 */
  rememberedAt: string
  /** Task id that captured this, if any */
  source?: string
  provenance: MemoryProvenance
}

interface RecallOpts {
  /** Fuzzy-match against content + tag values */
  topic?: string
  /** Require all these tags (exact match) */
  tags?: Record<string, string>
  /** Restrict to these types */
  types?: MemoryType[]
  /** Max entries to return (default 25) */
  limit?: number
}

interface EventRow {
  id: number
  type: string
  data: string
  timestamp: string
}

interface ShippedRow {
  id: string
  name: string
  type: string | null
  shipped_at: string
  data: string | null
}

function safeJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function rowToEntry(row: EventRow): MemoryEntry {
  const type = row.type.slice(REMEMBER_EVENT_PREFIX.length) as MemoryType
  const data = safeJson<{
    content?: string
    tags?: Record<string, string>
    source?: string
    provenance?: MemoryProvenance
  }>(row.data, {})
  // Entries written via `prjct remember` default to `declared` — the user
  // (or Claude) explicitly captured them. PR 4 work can override when
  // auto-capturing from pattern extraction, etc.
  return {
    id: `mem_${row.id}`,
    type,
    content: data.content ?? '',
    tags: data.tags ?? {},
    rememberedAt: row.timestamp,
    source: data.source,
    provenance: data.provenance ?? 'declared',
  }
}

function shippedRowToEntry(row: ShippedRow): MemoryEntry {
  const meta = row.data
    ? safeJson<{ tags?: Record<string, string>; taskId?: string }>(row.data, {})
    : {}
  const tagBase: Record<string, string> = meta.tags ?? {}
  if (row.type) tagBase.type = row.type
  // Ships are verifiable project state — high-confidence extracted signal.
  return {
    id: `ship_${row.id}`,
    type: 'shipped',
    content: row.name,
    tags: tagBase,
    rememberedAt: row.shipped_at,
    source: meta.taskId,
    provenance: 'extracted',
  }
}

function matchesTopic(entry: MemoryEntry, topic: string): boolean {
  const t = topic.toLowerCase()
  if (entry.content.toLowerCase().includes(t)) return true
  for (const v of Object.values(entry.tags)) {
    if (v.toLowerCase().includes(t)) return true
  }
  return false
}

function matchesTags(entry: MemoryEntry, tags: Record<string, string>): boolean {
  for (const [k, v] of Object.entries(tags)) {
    if (entry.tags[k] !== v) return false
  }
  return true
}

export const projectMemory = {
  /**
   * Store an entry. Thin wrapper over memoryService so callers don't need
   * to know the event-type prefix convention.
   */
  async remember(
    projectPath: string,
    args: {
      type: MemoryType
      content: string
      tags?: Record<string, string>
      source?: string
      /** Defaults to `declared` — user/LLM asserted this directly. */
      provenance?: MemoryProvenance
    }
  ): Promise<void> {
    await memoryService.log(projectPath, `${REMEMBER_ACTION_PREFIX}${args.type}`, {
      content: args.content,
      tags: args.tags ?? {},
      source: args.source,
      provenance: args.provenance ?? 'declared',
    })
  },

  /**
   * Fetch matching entries across memory sources, newest-first.
   * Returns an empty array on failure — callers treat recall as best-effort.
   */
  recall(projectId: string, opts: RecallOpts = {}): MemoryEntry[] {
    const limit = opts.limit ?? 25
    const rows = prjctDb.query<EventRow>(
      projectId,
      'SELECT id, type, data, timestamp FROM events WHERE type LIKE ? ORDER BY id DESC LIMIT ?',
      `${REMEMBER_EVENT_PREFIX}%`,
      Math.max(limit * 4, 100)
    )
    const shipped = prjctDb.query<ShippedRow>(
      projectId,
      'SELECT id, name, type, shipped_at, data FROM shipped_features ORDER BY shipped_at DESC LIMIT ?',
      Math.max(limit * 4, 50)
    )

    let entries: MemoryEntry[] = [...rows.map(rowToEntry), ...shipped.map(shippedRowToEntry)]

    if (opts.types && opts.types.length > 0) {
      const allowed = new Set(opts.types)
      entries = entries.filter((e) => allowed.has(e.type))
    }
    if (opts.tags) {
      entries = entries.filter((e) => matchesTags(e, opts.tags ?? {}))
    }
    if (opts.topic) {
      entries = entries.filter((e) => matchesTopic(e, opts.topic!))
    }

    entries.sort((a, b) => b.rememberedAt.localeCompare(a.rememberedAt))
    return entries.slice(0, limit)
  },

  /**
   * Lightweight similarity: share any keyword from the description. Good
   * enough to surface "we already shipped this" nudges; Phase 5 can layer
   * embeddings on top without changing the API.
   */
  similar(projectId: string, description: string, limit = 10): MemoryEntry[] {
    const keywords = description
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3)
    if (keywords.length === 0) return []

    const all = projectMemory.recall(projectId, { limit: 200 })
    const scored = all.map((entry) => {
      const hay = `${entry.content} ${Object.values(entry.tags).join(' ')}`.toLowerCase()
      const hits = keywords.reduce((n, k) => (hay.includes(k) ? n + 1 : n), 0)
      return { entry, hits }
    })
    return scored
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map((s) => s.entry)
  },
}

/**
 * Render memory entries as compact markdown grouped by type.
 * Designed to be short enough for Claude to read without tripping budgets.
 */
export function formatMemoryMd(entries: MemoryEntry[]): string {
  if (entries.length === 0) return '> No matching memory entries.'

  const groups = new Map<MemoryType, MemoryEntry[]>()
  for (const e of entries) {
    const bucket = groups.get(e.type) ?? []
    bucket.push(e)
    groups.set(e.type, bucket)
  }

  const order: MemoryType[] = [
    'decision',
    'learning',
    'anti-pattern',
    'gotcha',
    'pattern',
    'fact',
    'shipped',
  ]
  const lines: string[] = []

  // Provenance prefixes — cheap trust signal for Claude when reading
  // memory. Declared is strongest (user wrote it); inferred is weakest.
  const PROV_PREFIX: Record<MemoryProvenance, string> = {
    declared: 'DECL',
    extracted: 'EXTR',
    inferred: 'INFR',
    ambiguous: 'AMBG',
  }

  for (const type of order) {
    const items = groups.get(type)
    if (!items || items.length === 0) continue
    lines.push(`### ${type.toUpperCase()}`)
    for (const e of items) {
      const tags = Object.entries(e.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
      const tagSuffix = tags ? `  _(${tags})_` : ''
      const prov = PROV_PREFIX[e.provenance]
      lines.push(`- \`${prov}\` [${e.id}] ${e.content}${tagSuffix}`)
    }
    lines.push('')
  }

  return lines.join('\n').trim()
}
