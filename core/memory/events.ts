/**
 * Constants for memory-service event type prefixes.
 *
 * memoryService.log(action) stores rows as `memory.<action>`. These helpers
 * let callers stop repeating the string in query filters and avoid drift
 * between writers (primitives.ts) and readers (project-memory.ts, wiki,
 * workflow-engine).
 */

const MEMORY_EVENT_PREFIX = 'memory.'

/** Written by `prjct remember` — one row per captured memory entry. */
export const REMEMBER_ACTION_PREFIX = 'remember.'

/** `memoryService.log`'s full event type for remember rows. */
export const REMEMBER_EVENT_PREFIX = `${MEMORY_EVENT_PREFIX}${REMEMBER_ACTION_PREFIX}` // memory.remember.

/** Written by `prjct tag` — most recent row per active task holds the tag dict. */
export const TAG_EVENT_TYPE = `${MEMORY_EVENT_PREFIX}task.tagged`

/**
 * Prefix-range bounds for INDEXED type scans.
 *
 * SQLite cannot use an index for `type LIKE ?` with a bound parameter —
 * the scan bounds are unknown at prepare time, so every such query is a
 * full `SCAN events` (EXPLAIN-confirmed). `type >= lo AND type < hi` is
 * the exact same predicate as `LIKE '<prefix>%'` but drives a `SEARCH`
 * on the `(type, id)` index. `hi` is the prefix with its final char
 * bumped one code point ('.' → '/').
 *
 * Use these for every prefix-filtered query against `events.type`; keep
 * `LIKE` only where the row is already pinned by `id = ?`.
 */
function prefixUpperBound(prefix: string): string {
  return prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)
}

/** [lo, hi) bounds matching `LIKE 'memory.%'`. */
export const MEMORY_EVENT_RANGE = [
  MEMORY_EVENT_PREFIX,
  prefixUpperBound(MEMORY_EVENT_PREFIX),
] as const

/** [lo, hi) bounds matching `LIKE 'memory.remember.%'`. */
export const REMEMBER_EVENT_RANGE = [
  REMEMBER_EVENT_PREFIX,
  prefixUpperBound(REMEMBER_EVENT_PREFIX),
] as const

/** Written by `prjct status` and workflow status-transition steps. */
export const STATUS_CHANGE_ACTION = 'status.changed'
