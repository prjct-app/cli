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
import { deburr } from '../utils/deburr'
import { memoryFingerprint } from './content-fingerprint'
import {
  collectSupersededIds,
  dedupeLatestByKey,
  type EventRow,
  type MemoryEntry,
  type MemoryProvenance,
  type MemoryType,
  matchesTags,
  matchesTopic,
  rowToEntry,
  type ShippedRow,
  shippedRowToEntry,
} from './entries'
import { REMEMBER_ACTION_PREFIX, REMEMBER_EVENT_PREFIX, REMEMBER_EVENT_RANGE } from './events'

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

  /**
   * Drop entries the author explicitly marked obsolete — an entry tagged
   * `supersedes:mem_X` / `duplicates:mem_X` retires X, and an entry tagged
   * `superseded-by:…` retires itself. Author-declared compaction, not a
   * heuristic. Default: true. Set false for the link/index layer, which
   * must keep retired entries resolvable so their wikilinks don't rot.
   */
  pruneSuperseded?: boolean
}

const DEFAULT_RECALL_LIMIT = 25
/** Row-count multiplier to give in-memory filters room to work. */
const OVERFETCH_FACTOR = 4
const MIN_OVERFETCH = 100

/**
 * Dead-id set for the FTS mirror: every entry retired by an author-declared
 * relationship tag, regardless of result window. Scans only live rows whose
 * tags mention a relationship key (LIKE pre-filter keeps it to a handful of
 * rows on a hot path that runs per prompt). Best-effort: empty set on error.
 */
function collectMirrorSupersededIds(projectId: string): Set<string> {
  try {
    const rows = prjctDb.query<{ id: string; tags: string | null }>(
      projectId,
      `SELECT id, tags FROM memories
        WHERE deleted_at IS NULL
          AND (tags LIKE '%supersede%' OR tags LIKE '%duplicates%')`
    )
    const pseudo: Pick<MemoryEntry, 'id' | 'tags'>[] = []
    for (const row of rows) {
      if (!row.tags) continue
      try {
        const parsed = JSON.parse(row.tags) as unknown
        if (parsed && typeof parsed === 'object') {
          pseudo.push({ id: row.id, tags: parsed as Record<string, string> })
        }
      } catch {
        // legacy non-JSON tags — skip
      }
    }
    return collectSupersededIds(pseudo as MemoryEntry[])
  } catch {
    return new Set()
  }
}

/**
 * Read authored memory from the Schema v2 tables (memory_entries +
 * memory_entry_tags), mapped to the MemoryEntry shape. One indexed query for
 * the rows + one batched query for their tags — no JSON.parse per row. The
 * memory_entries_from_events trigger keeps these complete for every writer.
 */
function recallEntriesFromV2(projectId: string, overfetch: number): MemoryEntry[] {
  const rows = prjctDb.query<{
    id: string
    type: string
    content: string
    provenance: string | null
    created_at: number
  }>(
    projectId,
    `SELECT id, type, content, provenance, created_at
     FROM memory_entries
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    overfetch
  )
  if (rows.length === 0) return []
  const placeholders = rows.map(() => '?').join(',')
  const tagRows = prjctDb.query<{ entry_id: string; key: string; value: string }>(
    projectId,
    `SELECT entry_id, key, value FROM memory_entry_tags WHERE entry_id IN (${placeholders})`,
    ...rows.map((r) => r.id)
  )
  const tagsById = new Map<string, Record<string, string>>()
  for (const t of tagRows) {
    let m = tagsById.get(t.entry_id)
    if (!m) {
      m = {}
      tagsById.set(t.entry_id, m)
    }
    m[t.key] = t.value
  }
  return rows.map((r) => ({
    id: r.id,
    type: r.type as MemoryType,
    content: r.content,
    tags: tagsById.get(r.id) ?? {},
    rememberedAt: new Date(r.created_at).toISOString(),
    provenance: (r.provenance ?? 'declared') as MemoryProvenance,
  }))
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
      /** Skips the config read when the caller already resolved it — the
       *  Stop-hook detectors fire several remembers per turn and each used
       *  to re-read + re-parse prjct.config.json. */
      projectId?: string
    }
  ): Promise<void> {
    const tags = args.tags ?? {}
    const provenance = args.provenance ?? 'declared'
    const contentHash = memoryFingerprint(args.content)

    // Resolve the project once and reuse it for both the dedup guard and the
    // sync publish below (each used to read + parse the config independently).
    let projectId: string | undefined = args.projectId
    if (!projectId) {
      try {
        const { default: configManager } = await import('../infrastructure/config-manager')
        projectId = (await configManager.readConfig(projectPath))?.projectId
      } catch {
        /* config unreadable — dedup + sync are best-effort; the local write proceeds */
      }
    }

    // Dedup net: a verbatim re-capture of the same (type, content) adds no
    // knowledge — it only dilutes recall and burns slots in the fixed-size
    // injection budget. Skip it. This is the universal guard behind EVERY
    // capture path (manual `remember`, the friction / skill-miss detectors,
    // wiki-ingest), so a single detector re-firing each session can't spam the
    // store. Best-effort: any lookup failure falls through to a normal write —
    // a dedup miss is cheaper than a dropped capture.
    if (projectId) {
      try {
        const dup = prjctDb.get<{ id: string }>(
          projectId,
          'SELECT id FROM memories WHERE content_hash = ? AND type = ? AND deleted_at IS NULL LIMIT 1',
          contentHash,
          args.type
        )
        if (dup) return
      } catch {
        /* fall through — never block a capture on the dedup check */
      }
    }

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
    if (logResult?.projectId && !projectId) projectId = logResult.projectId

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
             (id, project_id, title, content, tags, type, provenance, content_hash,
              user_triggered, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          memId,
          logResult.projectId,
          title,
          args.content,
          JSON.stringify(tags),
          args.type,
          provenance,
          contentHash,
          0,
          now,
          now
        )
        // memory_entries (Schema v2) is populated by the memory_entries_from_events
        // trigger (migration 40) on the events insert above — covers every writer
        // uniformly, so no per-call dual-write is needed here.
      } catch {
        // Non-critical — events row is the source of truth.
      }
    }

    // Reinforcement loop: credit the entries this new one references — they
    // just proved load-bearing (the project is building on them). Feeds the
    // usefulness ranking so proven knowledge surfaces first over time.
    // Best-effort; dynamic import avoids a static service cycle.
    if (logResult?.projectId) {
      try {
        const { usefulnessService } = await import('../services/usefulness')
        usefulnessService.recordReferences(logResult.projectId, args.content, tags)
        // Negative half of the loop: an entry tagged corrects:/contradicts:
        // marks the referenced one as a mistake → demote it in recall.
        usefulnessService.recordCorrection(logResult.projectId, tags)
      } catch {
        /* never block a capture on reinforcement bookkeeping */
      }
    }

    // Phase 1.5 / B1: also publish to the sync queue so prjct-cloud
    // mirrors memories. memoryService.log writes to the local events
    // table, but it doesn't enqueue a SyncEvent for push — that's
    // what this call does. Best-effort; a sync queue write must not
    // fail the local memory write.
    if (!projectId) return
    try {
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
          // Origin authored time. We're creating the memory right now on
          // THIS machine, so now() IS the origin — receivers preserve it
          // verbatim instead of stamping their own ingestion clock.
          created_at: new Date().toISOString(),
          rememberedAt: new Date().toISOString(),
        },
      })
    } catch {
      // Best-effort — local memory write already succeeded.
    }

    try {
      const { requestVaultRegeneration } = await import('../services/vault-regeneration')
      await requestVaultRegeneration(projectPath, projectId)
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
    // Sanitize: deburr first (FTS5 unicode61 indexes with
    // remove_diacritics, so "búsqueda" must query as "busqueda"), then
    // keep only token-friendly chars and drop FTS5-reserved operators so
    // a user prompt with literal "OR"/"AND"/"NEAR" doesn't hijack the
    // MATCH parse. Trailing-* allows prefix matching.
    const sanitized = keywords
      .map((kw) => deburr(kw).replace(/[^a-z0-9-]/gi, ''))
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
      // Overfetch: superseded pruning below may drop rows, and this is
      // the surface that feeds the per-prompt trap cue — a stale decision
      // must not consume the only result slot.
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
        limit * 2
      )
    } catch {
      return []
    }

    let entries = rows.map((row) => {
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

    // Author-declared compaction, same contract as recall(): a superseded
    // or duplicated entry must not surface as live advice. Unlike recall's
    // window-scoped prune, BM25 ordering rarely returns the SUPERSEDING
    // entry alongside the stale one, so the dead-id set comes from a scan
    // of all live mirror rows carrying relationship tags (small, indexed
    // by the LIKE pre-filter) instead of just the result window.
    const dead = collectMirrorSupersededIds(projectId)
    if (dead.size > 0) entries = entries.filter((e) => !dead.has(e.id))
    return entries.slice(0, limit)
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

    // C1 read flip: authored memory comes from the normalized v2 tables
    // (memory_entries + memory_entry_tags), kept complete for every writer by
    // the memory_entries_from_events trigger. Typed columns + indexed tags —
    // no per-row JSON.parse of events.data on this per-prompt path.
    const v2entries = wantEvents ? recallEntriesFromV2(projectId, overfetch) : []
    const shipped = wantShipped
      ? prjctDb.query<ShippedRow>(
          projectId,
          'SELECT id, name, type, shipped_at, data FROM shipped_features ORDER BY shipped_at DESC LIMIT ?',
          overfetch
        )
      : []

    let entries: MemoryEntry[] = [...v2entries, ...shipped.map(shippedRowToEntry)]

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

    // Author-declared compaction: drop entries explicitly retired via
    // supersedes / superseded-by / duplicates. Runs before the slice so a
    // retired entry never consumes a result slot. Opt out (link/index layer)
    // to keep retired entries resolvable.
    if (opts.pruneSuperseded !== false) {
      const dead = collectSupersededIds(entries)
      if (dead.size > 0) entries = entries.filter((e) => !dead.has(e.id))
    }

    return entries.slice(0, limit)
  },

  /**
   * Anticipation lookup (RAG north star, pillar 3): the PREVENTIVE memories
   * recorded against a specific file — gotchas, anti-patterns, recurring-bug
   * patterns. Pulled on demand before editing — via `prjct guard <file>` or
   * the `prjct_guard` MCP tool — so the trap is seen before it's stepped in.
   *
   * Deliberately strict: only the "you'll break something" types, so the
   * result is empty for most files and never becomes noise. Plain decisions /
   * learnings about the file are NOT included here.
   *
   * Matches the stored `file` tag (repo-relative) against the edited path by
   * exact / suffix / basename so an absolute path from the editor still hits.
   */
  recallForFile(
    projectId: string,
    filePath: string,
    limit = 3,
    opts: { preventiveOnly?: boolean } = {}
  ): MemoryEntry[] {
    if (!filePath) return []
    const base = filePath.split('/').pop() ?? filePath
    const isPreventive = (e: MemoryEntry) =>
      e.type === 'gotcha' || e.type === 'anti-pattern' || e.tags?.pattern === 'recurring-bug'
    // The `file_tag` generated column (migration 27) + partial index narrow
    // the scan to file-tagged remember rows in SQL — exact / suffix / basename
    // matching mirrors the original JS filter. Preventive-type filtering and
    // superseded pruning stay in JS over the (small) matched set.
    let matches: MemoryEntry[]
    try {
      const rows = prjctDb.query<EventRow>(
        projectId,
        `SELECT id, type, data, timestamp FROM events
          WHERE file_tag IS NOT NULL
            AND (file_tag = ? OR ? LIKE '%/' || file_tag OR file_tag = ? OR file_tag LIKE '%/' || ?)
          ORDER BY id DESC`,
        filePath,
        filePath,
        base,
        base
      )
      matches = rows.map(rowToEntry).filter(isPreventive)
    } catch {
      return []
    }
    // Also surface the task CONTEXT that touched this file ("this file was
    // changed during these tasks, by these authors") — the git-anchored
    // second-brain answer to "what happened here / who?" without git blame.
    // Context entries carry a comma-joined `files` tag, so match in JS.
    // The pre-edit PUSH opts out (`preventiveOnly`): a heads-up that fires on
    // every edit must carry only TRAPS, not file history — history stays one
    // pull away via `prjct guard` when the agent actually asks "what happened?".
    if (!opts.preventiveOnly) {
      try {
        const ctxRows = prjctDb.query<EventRow>(
          projectId,
          `SELECT id, type, data, timestamp FROM events
          WHERE type = ? ORDER BY id DESC LIMIT 200`,
          `${REMEMBER_EVENT_PREFIX}context`
        )
        for (const e of ctxRows.map(rowToEntry)) {
          const files = (e.tags?.files ?? '').split(',').map((f) => f.trim())
          if (files.some((f) => f === filePath || f === base || f.endsWith(`/${base}`))) {
            matches.push(e)
          }
        }
      } catch {
        /* best-effort — preventive matches still stand */
      }
    }
    const dead = collectSupersededIds(matches)
    if (dead.size > 0) matches = matches.filter((e) => !dead.has(e.id))
    return matches.slice(0, limit)
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
   * Count remembered entries of ONE exact type, straight from the event store
   * (the same source recall reads). A targeted COUNT — no `LIKE` overfetch, no
   * JSON parse, no JS type-filter — for the hot prompt-hook path that only
   * needs a number (e.g. inbox depth). Exact-match equality uses the
   * `(type, …)` index, and it's not capped, so it can't undercount past a
   * fixed limit the way the old `recall({types}).length` did.
   */
  countByType(projectId: string, type: string): number {
    try {
      const row = prjctDb.get<{ n: number }>(
        projectId,
        'SELECT COUNT(*) AS n FROM events WHERE type = ?',
        `${REMEMBER_EVENT_PREFIX}${type}`
      )
      return row?.n ?? 0
    } catch {
      return 0
    }
  },

  /**
   * Recall entries of ONE exact type, newest-first, WITHOUT the broad
   * `type LIKE 'memory.remember.%'` overfetch (4×) + JS type-filter that
   * `recall` does. For hot paths that need a single type's recent entries
   * (e.g. the improvement-signal block on every prompt). Skips supersede/dedup
   * — fine for keyless, non-superseded types like `improvement-signal`.
   */
  recallByType(projectId: string, type: string, limit: number): MemoryEntry[] {
    if (limit <= 0) return []
    try {
      const rows = prjctDb.query<EventRow>(
        projectId,
        'SELECT id, type, data, timestamp FROM events WHERE type = ? ORDER BY id DESC LIMIT ?',
        `${REMEMBER_EVENT_PREFIX}${type}`,
        limit
      )
      return rows.map(rowToEntry)
    } catch {
      return []
    }
  },

  /**
   * Forget a memory entry by id across EVERY read path, so it stops surfacing:
   *   - `events` row deleted — recall() + allEntriesForIndex read events directly
   *     (events has no deleted_at; the dedup migration likewise hard-deletes).
   *   - `memories` mirror soft-deleted (deleted_at) — searchFts filters on it.
   *   - any stored embedding dropped — so it can't resurface via semantic search.
   * Returns true iff a remember-event row existed and was removed. Best-effort
   * on the mirror/embedding cleanups (their absence must not fail the forget).
   */
  forget(projectId: string, id: string): boolean {
    const m = String(id)
      .trim()
      .match(/^(?:mem[_-])?(\d+)$/i)
    if (!m) return false
    const rowId = Number(m[1])
    const memId = `mem_${rowId}`
    let removed = false

    // Source event (recall + vault index read events directly). A memories
    // mirror row can outlive its event and vice-versa, so clean each
    // independently and report success if EITHER surface had the entry.
    try {
      const ev = prjctDb.get<{ id: number }>(
        projectId,
        'SELECT id FROM events WHERE id = ? AND type LIKE ?',
        rowId,
        `${REMEMBER_EVENT_PREFIX}%`
      )
      if (ev) {
        prjctDb.run(projectId, 'DELETE FROM events WHERE id = ?', rowId)
        removed = true
      }
    } catch {}

    // FTS mirror — soft-delete so searchFts (filters deleted_at) stops it.
    try {
      const mem = prjctDb.get<{ id: string }>(
        projectId,
        'SELECT id FROM memories WHERE id = ? AND deleted_at IS NULL',
        memId
      )
      if (mem) {
        prjctDb.run(
          projectId,
          'UPDATE memories SET deleted_at = ? WHERE id = ?',
          new Date().toISOString(),
          memId
        )
        removed = true
      }
    } catch {}

    // Drop any stored embedding so it can't resurface via semantic search.
    try {
      prjctDb.run(projectId, 'DELETE FROM memory_embeddings WHERE memory_id = ?', memId)
    } catch {}

    // Schema v2: soft-delete the normalized row so recall (which now reads
    // memory_entries) stops returning it. The deleted event won't re-create it
    // (trigger only fires on INSERT).
    try {
      prjctDb.run(
        projectId,
        'UPDATE memory_entries SET deleted_at = ? WHERE id = ?',
        Date.now(),
        memId
      )
    } catch {}

    return removed
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
  /**
   * Entries that still LACK a vector for `model` — the embedding-backfill
   * work list, via SQL anti-join instead of deserializing the whole corpus
   * and set-diffing in JS. The improvement-signal / hot-file exclusions
   * mirror `isModelMemory` as SQL pre-filters; callers still apply
   * `isModelMemory` over the (small) result for authority.
   */
  unembeddedEntriesForIndex(projectId: string, model: string): MemoryEntry[] {
    try {
      const rows = prjctDb.query<EventRow>(
        projectId,
        `SELECT e.id, e.type, e.data, e.timestamp FROM events e
          WHERE e.type >= ? AND e.type < ?
            AND e.type != ?
            AND NOT EXISTS (
              SELECT 1 FROM memory_embeddings me
               WHERE me.memory_id = 'mem_' || e.id AND me.model = ?
            )
          ORDER BY e.id DESC`,
        ...REMEMBER_EVENT_RANGE,
        `${REMEMBER_EVENT_PREFIX}improvement-signal`,
        model
      )
      const shipped = prjctDb.query<ShippedRow>(
        projectId,
        `SELECT s.id, s.name, s.type, s.shipped_at, s.data FROM shipped_features s
          WHERE NOT EXISTS (
            SELECT 1 FROM memory_embeddings me
             WHERE me.memory_id = 'ship_' || s.id AND me.model = ?
          )
          ORDER BY s.shipped_at DESC`,
        model
      )
      return [...rows.map(rowToEntry), ...shipped.map(shippedRowToEntry)]
    } catch {
      return []
    }
  },

  allEntriesForIndex(projectId: string): MemoryEntry[] {
    try {
      const rows = prjctDb.query<EventRow>(
        projectId,
        'SELECT id, type, data, timestamp FROM events WHERE type >= ? AND type < ? ORDER BY id DESC',
        ...REMEMBER_EVENT_RANGE
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
}
