/**
 * Single source of truth for verbs registered in the command registry.
 *
 * Kept as a tiny string-only module so `bin/prjct.ts` can import it on the
 * daemon fast-path without dragging in the heavy command classes. Any new
 * registered verb lands here AND in `register.ts` — the CI check in
 * `__tests__/commands/verb-names.test.ts` enforces they stay in sync.
 */

export const REGISTERED_VERBS = [
  'task',
  'ship',
  'tag',
  'remember',
  'status',
  'workflow',
  'init',
  'analyze',
  'sync',
  'context',
  'login',
  'logout',
  'auth',
  'seed',
  'install',
  'capture',
] as const

export type RegisteredVerb = (typeof REGISTERED_VERBS)[number]

export const REGISTERED_VERBS_SET: ReadonlySet<string> = new Set(REGISTERED_VERBS)
