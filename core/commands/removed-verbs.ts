/**
 * Verbs that existed in prjct v1.x but were removed during the v2 cleanup
 * (commits b730bc08, 92660d3b, f6366eb5, e3a163cb — April 2026), plus later
 * feature removals (vault/regen — 2026-06-30, when the Obsidian/markdown
 * vault feature was deleted entirely).
 *
 * These must NOT fall through to the bare-dispatch auto-route to `capture`,
 * because that silently swallows workflow intent into the inbox (e.g. user
 * types `prjct done`, expecting the active task to be completed, and instead
 * creates an inbox note with text "done"). Instead we short-circuit with an
 * explicit migration message and a non-zero exit code so scripts fail loud.
 *
 * Kept as a pure data module — no runtime dependencies — so both the thin
 * daemon shim and the full CLI can import it without pulling in command
 * classes.
 */

interface RemovedVerb {
  /** Exact replacement command, shown verbatim to the user. */
  replacement: string
  /** Short reason shown alongside the replacement. */
  note: string
}

export const REMOVED_VERBS: Readonly<Record<string, RemovedVerb>> = {
  done: {
    replacement: 'prjct status done',
    note: 'Mark the active task complete via the v2 status primitive.',
  },
  pause: {
    replacement: 'prjct status paused',
    note: 'Pause the active task via the v2 status primitive.',
  },
  resume: {
    replacement: 'prjct status active',
    note: 'Resume the active task via the v2 status primitive.',
  },
  reopen: {
    replacement: 'prjct status active',
    note: 'Reopen a completed task by setting status back to active.',
  },
  next: {
    replacement: 'prjct status',
    note: 'Queue view is not part of v2. Use status for the active task.',
  },
  dash: {
    replacement: 'prjct status',
    note: 'The dash command was removed. Use status, or open the web dashboard.',
  },
  bug: {
    replacement: 'prjct capture "<description>" --tags bug',
    note: 'Bugs are captured via the GTD inbox with a tag in v2.',
  },
  idea: {
    replacement: 'prjct capture "<description>" --tags idea',
    note: 'Ideas are captured via the GTD inbox with a tag in v2.',
  },
  linear: {
    replacement: 'MCP server (see `prjct seed list`)',
    note: 'Native Linear CLI was removed; integration is now via MCP.',
  },
  jira: {
    replacement: 'MCP server (see `prjct seed list`)',
    note: 'Native Jira CLI was removed; integration is now via MCP.',
  },
  tokens: {
    replacement: 'prjct status',
    note: 'Token tracking was removed in v2.',
  },
  velocity: {
    replacement: 'prjct status',
    note: 'Velocity reports were removed in v2.',
  },
  plan: {
    replacement: 'prjct init',
    note: 'Planning is now part of init/task flow.',
  },
  vault: {
    replacement: 'prjct search / prjct context memory / MCP prjct_*',
    note: 'The Obsidian/markdown vault was removed. Agents read project knowledge through tools now.',
  },
  regen: {
    replacement: 'prjct sync --full',
    note: 'The vault it regenerated was removed; there is nothing left to rebuild.',
  },
} as const

export function isRemovedVerb(verb: string): boolean {
  return Object.hasOwn(REMOVED_VERBS, verb)
}

/**
 * Build the user-facing migration message for a removed verb.
 * Returns null if the verb is not in the removed list.
 */
export function migrationMessage(verb: string): string | null {
  const entry = REMOVED_VERBS[verb]
  if (!entry) return null
  return `'prjct ${verb}' was removed in v2.\n  → Use: ${entry.replacement}\n  ${entry.note}`
}
