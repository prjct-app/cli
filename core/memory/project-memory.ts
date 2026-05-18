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
 * Base memory types — the ones we ship on every project regardless of
 * which pack is active. Additional types come from `packs/*` manifests
 * (e.g. `insight`, `okr`, `stakeholder`). Users can also save to any
 * type they invent — `MemoryType` is intentionally just `string` so
 * the API stays open. See `isKnownMemoryType()` when you need to check
 * whether a string matches a base type.
 *
 * Rationale: imposing a rigid ontology would be harness. Tags + types
 * are freeform; Claude (and the human) decide what makes sense for
 * this project.
 */
export const BASE_MEMORY_TYPES = [
  // Code-centric (always useful — kept from v1 for continuity)
  'fact',
  'decision',
  'learning',
  'gotcha',
  'pattern',
  'anti-pattern',
  'shipped',
  // GTD / day-to-day (capture, triage, review)
  'inbox',
  'todo',
  'idea',
  // PM / Research (insights, questions, sources)
  'insight',
  'question',
  'source',
  // Founder / Ops (people, stakeholders, goals)
  'person',
  // SDD: spec is the artifact that frames work BEFORE implementation.
  // Authoritative storage is the `specs` table; a memory event is also
  // emitted on creation so specs surface in `prjct context memory spec`.
  'spec',
] as const

/** @deprecated use BASE_MEMORY_TYPES. Kept as alias for backward compat. */
export const MEMORY_TYPES = BASE_MEMORY_TYPES

type BaseMemoryType = (typeof BASE_MEMORY_TYPES)[number]

/**
 * Freeform memory type — any non-empty string. Base types are listed
 * in `BASE_MEMORY_TYPES` for discovery/validation; user-defined types
 * like `recipe` or `workout` persist without special handling.
 */
export type MemoryType = string

/** True when the given value matches a base (well-known) memory type. */
function _isKnownMemoryType(value: string): value is BaseMemoryType {
  return (BASE_MEMORY_TYPES as readonly string[]).includes(value)
}

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
  /**
   * Collapse entries that share `(type, tags.key)` to the newest one.
   * Entries without a `key` tag are unaffected. Default: true.
   *
   * Rationale: callers who `prjct remember` the same conceptual fact
   * with the same `key` repeatedly (e.g. an updated decision) should
   * see the latest assertion, not a stack of stale duplicates. Same
   * "latest winner per key" pattern gstack uses in
   * `gstack-learnings-search` (garrytan/gstack).
   */
  dedupeByKey?: boolean
}

const DEFAULT_RECALL_LIMIT = 25
/** Row-count multiplier to give in-memory filters room to work. */
const OVERFETCH_FACTOR = 4
const MIN_OVERFETCH = 100

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

/**
 * Collapse entries that share `(type, tags.key)` down to the newest one.
 * `entries` must already be sorted newest-first — this function preserves
 * the input order and drops later (older) duplicates per group. Entries
 * without a `key` tag are passed through unchanged.
 */
function dedupeLatestByKey(entries: MemoryEntry[]): MemoryEntry[] {
  const seen = new Set<string>()
  const out: MemoryEntry[] = []
  for (const entry of entries) {
    const key = entry.tags.key
    if (!key) {
      out.push(entry)
      continue
    }
    const groupId = `${entry.type}::${key}`
    if (seen.has(groupId)) continue
    seen.add(groupId)
    out.push(entry)
  }
  return out
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

    // Phase 1.5 / B1: also publish to the sync queue so prjct-cloud
    // mirrors memories. memoryService.log writes to the local events
    // table, but it doesn't enqueue a SyncEvent for push — that's
    // what this call does. Best-effort; a sync queue write must not
    // fail the local memory write.
    try {
      const { default: configManager } = await import('../infrastructure/config-manager')
      const cfg = await configManager.readConfig(projectPath)
      const projectId = cfg?.projectId
      if (!projectId) return
      const { publishCRUD } = await import('../sync/publish-helper')
      const entityId =
        args.tags?.spec_id ??
        args.tags?.task_id ??
        args.tags?.id ??
        args.source ??
        `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      await publishCRUD({
        projectId,
        entityType: 'memories',
        entityId,
        eventType: 'upsert',
        data: {
          id: entityId,
          type: args.type,
          content: args.content,
          tags: args.tags ?? {},
          source: args.source ?? null,
          provenance: args.provenance ?? 'declared',
          rememberedAt: new Date().toISOString(),
        },
      })
    } catch {
      // Best-effort — local memory write already succeeded.
    }
  },

  /**
   * Fetch matching entries across memory sources, newest-first.
   * Returns an empty array on failure — callers treat recall as best-effort.
   */
  recall(projectId: string, opts: RecallOpts = {}): MemoryEntry[] {
    const limit = opts.limit ?? DEFAULT_RECALL_LIMIT
    // We over-fetch from each source so in-memory filters (topic/tags/types)
    // still have headroom to return `limit` results. 4× is a heuristic:
    // enough for the common "filter by one type" case, cheap enough
    // otherwise.
    const overfetch = Math.max(limit * OVERFETCH_FACTOR, MIN_OVERFETCH)
    const rows = prjctDb.query<EventRow>(
      projectId,
      'SELECT id, type, data, timestamp FROM events WHERE type LIKE ? ORDER BY id DESC LIMIT ?',
      `${REMEMBER_EVENT_PREFIX}%`,
      overfetch
    )
    const shipped = prjctDb.query<ShippedRow>(
      projectId,
      'SELECT id, name, type, shipped_at, data FROM shipped_features ORDER BY shipped_at DESC LIMIT ?',
      overfetch
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

    // Latest-winner dedupe: when an entry has a `key` tag, only the
    // newest entry per (type, key) survives. Entries without a key fall
    // through unchanged. Sort-then-dedupe order matters — must run AFTER
    // sort so the first match per group is the newest.
    if (opts.dedupeByKey !== false) {
      entries = dedupeLatestByKey(entries)
    }

    return entries.slice(0, limit)
  },

  /**
   * Resolve a single memory entry by its `mem_<rowid>` id (or a bare
   * numeric id). This is the legibility fix: every `mem_NNNN` reference
   * the topical-memory injection / a memory body cites (`relates=mem_X`,
   * `resolves=mem_Y`) is otherwise an opaque dangling pointer that
   * neither a human (in Obsidian) nor an LLM can resolve. Returns null
   * if the id doesn't exist or isn't a remember-event row.
   */
  getById(projectId: string, id: string): MemoryEntry | null {
    const m = String(id)
      .trim()
      .match(/^(?:mem[_-])?(\d+)$/i)
    if (!m) return null
    const rowId = Number(m[1])
    try {
      const row = prjctDb.get<EventRow>(
        projectId,
        'SELECT id, type, data, timestamp FROM events WHERE id = ? AND type LIKE ?',
        rowId,
        `${REMEMBER_EVENT_PREFIX}%`
      )
      return row ? rowToEntry(row) : null
    } catch {
      return null
    }
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
/**
 * Render options. `vault: true` makes the output Obsidian-navigable:
 * every entry gets a block anchor (`^mem-N`) so it is a real link
 * target, and every `mem_N` token (cross-refs like `resolves=mem_X`
 * AND inline mentions) becomes a wikilink — closing the dangling-
 * pointer class (mem_3233). `idTypeIndex` maps `mem_N → type` across
 * ALL entries so a link can point at the right per-type file; unknown
 * ids fall back to a bare `[[mem_N]]` (still clickable, not dead text).
 * Without opts the output is byte-identical to before (CLI/terminal).
 */
export interface FormatMemoryMdOptions {
  vault?: boolean
  idTypeIndex?: Map<string, string>
}

/** `mem_3135` / `mem-3135` → `[[decision#^mem-3135|mem_3135]]` (or `[[mem_3135]]` if type unknown). */
function linkifyMemRefs(text: string, idTypeIndex?: Map<string, string>): string {
  return text.replace(/\bmem[_-](\d+)\b/g, (_m, n: string) => {
    const canonical = `mem_${n}`
    const type = idTypeIndex?.get(canonical)
    return type ? `[[${type}#^mem-${n}|${canonical}]]` : `[[${canonical}]]`
  })
}

export function formatMemoryMd(entries: MemoryEntry[], opts?: FormatMemoryMdOptions): string {
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
    'inbox',
    'todo',
    'idea',
    'insight',
    'question',
    'source',
    'person',
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

  const renderGroup = (type: string, items: MemoryEntry[]) => {
    if (items.length === 0) return
    lines.push(`### ${type.toUpperCase()}`)
    for (const e of items) {
      const tags = Object.entries(e.tags)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
      const prov = PROV_PREFIX[e.provenance]
      // `[mem_N · type]` not bare `[mem_N]`: a reference says WHAT it is
      // at a glance. CLI/terminal: `mem_N` stays plain text so grep
      // resolves it, full entry one command away (`prjct context memory
      // mem_N`). Vault: every `mem_N` (cross-refs + inline mentions)
      // becomes a wikilink and the entry gets an Obsidian block anchor
      // (`^mem-N`) so it is a real navigable target (mem_3233 — the
      // dangling-pointer class is closed where the user actually reads:
      // Obsidian).
      const content = opts?.vault ? linkifyMemRefs(e.content, opts.idTypeIndex) : e.content
      const tagSuffix = tags
        ? `  _(${opts?.vault ? linkifyMemRefs(tags, opts.idTypeIndex) : tags})_`
        : ''
      const rowid = e.id.replace(/^mem[_-]/, '')
      const anchor = opts?.vault ? ` ^mem-${rowid}` : ''
      lines.push(`- \`${prov}\` [${e.id} · ${e.type}] ${content}${tagSuffix}${anchor}`)
    }
    lines.push('')
  }

  const rendered = new Set<MemoryType>()
  for (const type of order) {
    const items = groups.get(type)
    if (!items || items.length === 0) continue
    renderGroup(type, items)
    rendered.add(type)
  }
  // Render any custom types not in the canonical order so they aren't
  // silently dropped (e.g. user-defined types from packs).
  for (const [type, items] of groups) {
    if (rendered.has(type)) continue
    renderGroup(type, items)
  }

  return lines.join('\n').trim()
}
