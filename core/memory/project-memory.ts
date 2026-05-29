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
 * `remember.<type>`) for user-captured entries, plus `shipped_features`
 * for auto-recorded ships.
 */

import { memoryService } from '../services/memory-service'
import prjctDb from '../storage/database'
import { escapeMarkdownInline } from '../utils/prompt-injection'
import { REMEMBER_ACTION_PREFIX, REMEMBER_EVENT_PREFIX } from './events'

/**
 * Base memory types. Additional types come from `packs/*` manifests;
 * user-invented types persist as freeform strings (`MemoryType = string`).
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

/** Freeform memory type — any non-empty string. */
export type MemoryType = string

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
  // (or Claude) explicitly captured them. Auto-capture flows can override
  // by setting `provenance` explicitly.
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
    const tags = args.tags ?? {}
    const provenance = args.provenance ?? 'declared'
    const logResult = await memoryService.log(
      projectPath,
      `${REMEMBER_ACTION_PREFIX}${args.type}`,
      {
        content: args.content,
        tags,
        source: args.source,
        provenance,
      }
    )

    // Dual-write to the `memories` table so the FTS5 index (memories_fts)
    // stays fresh. The trigger memories_ai keeps the FTS rows in sync.
    // Best-effort: the audit-trail event already landed in `events`; if
    // memories insert fails we just lose the FTS row for this entry.
    if (logResult?.eventId != null) {
      try {
        const memId = `mem_${logResult.eventId}`
        const now = new Date().toISOString()
        const titleSrc = args.content.split('\n')[0] ?? args.content
        const title = titleSrc.slice(0, 80)
        prjctDb.run(
          logResult.projectId,
          `INSERT OR IGNORE INTO memories
             (id, project_id, title, content, tags, type, provenance, user_triggered,
              created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          memId,
          logResult.projectId,
          title,
          args.content,
          JSON.stringify(tags),
          args.type,
          provenance,
          0,
          now,
          now
        )
      } catch {
        // Non-critical — events row is the source of truth.
      }
    }

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
   * FTS5 BM25 search over the `memories` table. Returns the top-N entries
   * ranked by relevance to the supplied keywords (with recency as the
   * tie-breaker). Best-effort: empty array on any failure (FTS unavailable,
   * malformed MATCH, etc.).
   *
   * The hook UserPromptSubmit calls this first for topical recall; if FTS
   * misses (empty index, no matches), the caller falls back to `recall()`.
   */
  searchFts(projectId: string, keywords: string[], limit: number): MemoryEntry[] {
    if (keywords.length === 0 || limit <= 0) return []
    // Sanitize: keep only token-friendly chars, drop FTS5-reserved
    // operators so a user prompt with literal "OR"/"AND"/"NEAR" doesn't
    // hijack the MATCH parse. Trailing-* allows prefix matching.
    const sanitized = keywords
      .map((kw) => kw.replace(/[^a-z0-9-]/gi, ''))
      .filter((kw) => kw.length >= 2)
    if (sanitized.length === 0) return []
    const matchExpr = sanitized.map((kw) => `"${kw}"*`).join(' OR ')

    type FtsRow = {
      id: string
      title: string
      content: string
      tags: string | null
      type: string | null
      provenance: string | null
      created_at: string
    }
    let rows: FtsRow[]
    try {
      rows = prjctDb.query<FtsRow>(
        projectId,
        `SELECT m.id, m.title, m.content, m.tags, m.type, m.provenance, m.created_at
         FROM memories_fts ft
         JOIN memories m ON m.rowid = ft.rowid
         WHERE memories_fts MATCH ?
           AND m.deleted_at IS NULL
         ORDER BY bm25(memories_fts) ASC, m.created_at DESC
         LIMIT ?`,
        matchExpr,
        limit
      )
    } catch {
      return []
    }

    return rows.map((row) => {
      let tags: Record<string, string> = {}
      if (row.tags) {
        try {
          const parsed = JSON.parse(row.tags) as unknown
          if (parsed && typeof parsed === 'object') tags = parsed as Record<string, string>
        } catch {
          // Comma-joined legacy form (migration 10 backfill). Best-effort.
        }
      }
      return {
        id: row.id,
        type: row.type ?? 'fact',
        content: row.content,
        tags,
        rememberedAt: row.created_at,
        provenance: (row.provenance ?? 'declared') as MemoryProvenance,
      }
    })
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

    // Memory entries live in two tables: `events` (user-captured via
    // remember/capture) and `shipped_features` (auto-recorded ships).
    // When the caller filtered by `types`, we can skip whichever source
    // can never satisfy the filter — saves a query per recall.
    const typesFilter = opts.types && opts.types.length > 0 ? new Set(opts.types) : null
    const wantShipped = typesFilter ? typesFilter.has('shipped') : true
    const wantEvents = typesFilter ? [...typesFilter].some((t) => t !== 'shipped') : true

    const rows = wantEvents
      ? prjctDb.query<EventRow>(
          projectId,
          'SELECT id, type, data, timestamp FROM events WHERE type LIKE ? ORDER BY id DESC LIMIT ?',
          `${REMEMBER_EVENT_PREFIX}%`,
          overfetch
        )
      : []
    const shipped = wantShipped
      ? prjctDb.query<ShippedRow>(
          projectId,
          'SELECT id, name, type, shipped_at, data FROM shipped_features ORDER BY shipped_at DESC LIMIT ?',
          overfetch
        )
      : []

    let entries: MemoryEntry[] = [...rows.map(rowToEntry), ...shipped.map(shippedRowToEntry)]

    if (typesFilter) {
      entries = entries.filter((e) => typesFilter.has(e.type))
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
   * Follow each seed entry's cross-references ONE hop and return the linked
   * entries (deduped against the seed, capped).
   *
   * The relationship graph already exists as text — a decision captured with
   * `--tags resolves:mem_2609` (or an inline `mem_2609` mention) renders as a
   * wikilink in the vault — but no RETRIEVAL path ever traversed it. So
   * recalling "the decision that resolved X" left X itself (the superseded
   * decision, the bug it fixed, the spec it implements) invisible to the
   * agent unless it manually looked it up. This surfaces those one hop out so
   * a single recall carries its own context. Bounded by `cap` so a densely
   * linked entry can't balloon the injected context.
   */
  expandWithLinks(projectId: string, seed: MemoryEntry[], cap = 5): MemoryEntry[] {
    if (seed.length === 0 || cap <= 0) return []
    const refRe = /\bmem[_-](\d+)\b/g
    // Tag keys whose values name a related entry. Kept explicit (not "any
    // tag") so an arbitrary `mem_N`-looking tag value can't pull noise.
    const relKeys = ['resolves', 'relates', 'supersedes', 'superseded-by', 'duplicates', 'spec']
    const seen = new Set(seed.map((e) => e.id))
    const linked: MemoryEntry[] = []

    for (const entry of seed) {
      if (linked.length >= cap) break
      const refs = new Set<string>()
      for (const key of relKeys) {
        const v = entry.tags?.[key]
        if (!v) continue
        for (const m of String(v).matchAll(refRe)) refs.add(`mem_${m[1]}`)
      }
      for (const m of entry.content.matchAll(refRe)) refs.add(`mem_${m[1]}`)

      for (const ref of refs) {
        if (linked.length >= cap) break
        if (seen.has(ref)) continue
        seen.add(ref)
        const e = projectMemory.getById(projectId, ref)
        if (e) linked.push(e)
      }
    }
    return linked
  },

  /**
   * EVERY entry — no limit, no topic/type filter, no latest-winner
   * dedupe. The vault link layer needs this: `recall()` collapses
   * `(type, key)` duplicates and caps results, so an older entry that
   * a current one still references (`resolves=mem_2609`) vanishes from
   * the index and its links rot to a dangling `[[mem_2609]]`. Building
   * the `mem_N → {type,title}` index from the full set is what keeps
   * every cross-reference resolvable (the mem_3233 dangling class, at
   * graph scale). Read-only, best-effort.
   */
  allEntriesForIndex(projectId: string): MemoryEntry[] {
    try {
      const rows = prjctDb.query<EventRow>(
        projectId,
        'SELECT id, type, data, timestamp FROM events WHERE type LIKE ? ORDER BY id DESC',
        `${REMEMBER_EVENT_PREFIX}%`
      )
      const shipped = prjctDb.query<ShippedRow>(
        projectId,
        'SELECT id, name, type, shipped_at, data FROM shipped_features ORDER BY shipped_at DESC'
      )
      return [...rows.map(rowToEntry), ...shipped.map(shippedRowToEntry)]
    } catch {
      return []
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
  /**
   * Wrap each entry in `<user_content>` tags and escape tag values.
   * Set on surfaces that feed straight into an LLM (UserPromptSubmit hook,
   * MCP memory tools) so the model sees a clear data/instruction boundary.
   */
  boundary?: 'llm'
  /** `mem_N → type` so a cross-ref resolves to the right vault target. */
  idTypeIndex?: Map<string, string>
  /**
   * `mem_N → human title` (from {@link deriveTitle}). When present the
   * wikilink display text is the title, not the opaque `mem_N` — the
   * graph reads as knowledge for a human and an LLM, not DB keys.
   * Additive: absent → legacy `mem_N` display (CLI lock unaffected).
   */
  idTitleIndex?: Map<string, string>
  /**
   * Types rendered as their own per-entry note. Combined with
   * {@link idSlugIndex}, refs to these link by the note's real basename
   * `[[<slug>|title]]`; everything else uses the aggregated-file block
   * anchor `[[type#^mem-N|title]]`. Absent → legacy block-anchor form.
   */
  perEntryTypes?: ReadonlySet<string>
  /**
   * `mem_N → note basename (slug, no extension)` for per-entry notes.
   * The link MUST target the real file, not the `mem_N` alias:
   * Obsidian's GRAPH view resolves links by path/basename and ignores
   * frontmatter `aliases` (backlinks/click honor aliases; the graph
   * does not). With `hideUnresolved:true` an alias-only link is treated
   * as unresolved and hidden → no edge. Linking by slug is what makes
   * the relations actually appear in the graph (the v2.23.3 regression).
   */
  idSlugIndex?: Map<string, string>
}

const TITLE_MAX = 72

/** Make a title safe as Obsidian wikilink display text. */
function linkLabel(s: string): string {
  return s
    .replace(/[[\]|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Deterministic, LLM-free human title for an entry, derived from its
 * content. Used as the per-entry note filename slug, H1, and every
 * wikilink's display text so the vault graph is legible knowledge, not
 * `mem_3247` keys. Pure + stable: same entry → same title.
 */
export function deriveTitle(entry: Pick<MemoryEntry, 'content' | 'type' | 'id' | 'tags'>): string {
  let raw = (entry.content ?? '').trim()
  raw = raw.replace(/^(?:[-*•]\s+|\s+)+/, '')
  raw = raw.replace(/^(?:\[\[[^\]]*\]\]|mem[_-]\d+)[\s:,-]*/i, '').trim()
  let cut = raw.length
  for (const b of [/\n/, /\.\s/, /:\s/, /;\s/, /\s—\s/, /\s\(/]) {
    const m = raw.match(b)
    if (m && m.index !== undefined && m.index > 4 && m.index < cut) cut = m.index
  }
  let title = raw.slice(0, cut).replace(/\s+/g, ' ').trim()
  title = title
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .trim()
  if (title.length > TITLE_MAX) {
    const slice = title.slice(0, TITLE_MAX)
    const sp = slice.lastIndexOf(' ')
    title = `${(sp > 40 ? slice.slice(0, sp) : slice).trim()}…`
  }
  if (title.length < 6) title = `${entry.type} ${entry.id}`
  const pr = entry.tags?.pr
  if (pr && !new RegExp(`\\b#?${pr}\\b`).test(title)) title = `${title} (PR #${pr})`
  return title
}

/**
 * `mem_3135` → `[[mem_3135|<title>]]` (per-entry note, via alias) or
 * `[[gotcha#^mem-3135|<title>]]` (aggregated file block anchor).
 *
 * When the id is NOT in the index it no longer exists (forgotten /
 * pre-history). The old mem_3233 fix linked it anyway (`[[mem_N]]`,
 * "clickable not dead text") — but at graph scale that IS the bug the
 * user reported: every deleted ref became an orphan dangling node, a
 * dust of `mem_N` dots. An unresolvable id is not knowledge; render it
 * as muted inline-code text (honest, no fake node, no graph noise).
 */
export function linkifyMemRefs(text: string, opts?: FormatMemoryMdOptions): string {
  // Author-written bare `[[mem_N]]` wikilinks (common in spec free-text)
  // must go through the SAME resolver — otherwise an unresolvable one
  // renders as the broken `[[\`mem_N\`]]`. Collapse the exact shape
  // (no pipe, no #) back to a token first.
  return text
    .replace(/\[\[(mem[_-]\d+)\]\]/gi, '$1')
    .replace(/\bmem[_-](\d+)\b/g, (_m, n: string) => {
      const canonical = `mem_${n}`
      const type = opts?.idTypeIndex?.get(canonical)
      const title = opts?.idTitleIndex?.get(canonical)
      const slug = opts?.idSlugIndex?.get(canonical)
      const display = title ? linkLabel(title) : canonical
      // Per-entry note → link the REAL basename so the graph draws the
      // edge (alias-only links are invisible to Obsidian's graph).
      if (slug && type && opts?.perEntryTypes?.has(type)) {
        return `[[${slug}|${display}]]`
      }
      if (type) {
        return `[[${type}#^mem-${n}|${display}]]`
      }
      return title ? `[[${canonical}|${display}]]` : `\`${canonical}\``
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

  const llmBoundary = opts?.boundary === 'llm'

  const renderGroup = (type: string, items: MemoryEntry[]) => {
    if (items.length === 0) return
    lines.push(`### ${type.toUpperCase()}`)
    for (const e of items) {
      const tags = Object.entries(e.tags)
        .map(([k, v]) => `${k}=${llmBoundary ? escapeMarkdownInline(v) : v}`)
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
      const content = opts?.vault ? linkifyMemRefs(e.content, opts) : e.content
      const tagSuffix = tags ? `  _(${opts?.vault ? linkifyMemRefs(tags, opts) : tags})_` : ''
      const rowid = e.id.replace(/^mem[_-]/, '')
      const anchor = opts?.vault ? ` ^mem-${rowid}` : ''
      const row = `- \`${prov}\` [${e.id} · ${e.type}] ${content}${tagSuffix}${anchor}`
      if (llmBoundary) {
        // Wrap user-captured content in an explicit data boundary so the
        // LLM treats it as data, not instructions, even if the body
        // contains command-like text.
        lines.push(`<user_content id="${e.id}" type="${e.type}">`)
        lines.push(row)
        lines.push('</user_content>')
      } else {
        lines.push(row)
      }
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
