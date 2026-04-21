/**
 * Constants for memory-service event type prefixes.
 *
 * memoryService.log(action) stores rows as `memory.<action>`. These helpers
 * let callers stop repeating the string in query filters and avoid drift
 * between writers (primitives.ts) and readers (project-memory.ts, wiki,
 * workflow-engine).
 */

export const MEMORY_EVENT_PREFIX = 'memory.'

/** Written by `prjct remember` — one row per captured memory entry. */
export const REMEMBER_ACTION_PREFIX = 'remember.'

/** `memoryService.log`'s full event type for remember rows. */
export const REMEMBER_EVENT_PREFIX = `${MEMORY_EVENT_PREFIX}${REMEMBER_ACTION_PREFIX}` // memory.remember.

/** Written by `prjct tag` — most recent row per active task holds the tag dict. */
export const TAG_EVENT_TYPE = `${MEMORY_EVENT_PREFIX}task.tagged`

/** Written by `prjct status` and workflow status-transition steps. */
export const STATUS_CHANGE_ACTION = 'status.changed'
