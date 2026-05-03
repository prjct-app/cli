/**
 * Single source of truth for verbs registered in the command registry.
 *
 * Derived from the declarative `command-data.ts` routing table — any
 * entry with a `routing` field is automatically eligible for the
 * daemon fast-path. Adding or removing a verb is a single edit in
 * `command-data.ts`; this file picks up the change automatically.
 *
 * Kept tiny so `bin/prjct.ts` can import it on the fast path without
 * dragging in the heavy command classes. `command-data.ts` is itself
 * pure data + types, so the import chain stays light.
 */

import { COMMANDS } from './command-data'

export const REGISTERED_VERBS_SET: ReadonlySet<string> = new Set(
  COMMANDS.filter((c) => c.routing).map((c) => c.name)
)
