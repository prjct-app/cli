/**
 * Project CLAUDE.md — routing block writer.
 *
 * Writes (or refreshes between markers) a small block at the project's
 * `CLAUDE.md` that tells Claude "this project uses prjct — refer to
 * the global skill, don't make the user type commands". The
 * read-merge-write skeleton lives in `routing-block.ts`, shared with
 * the AGENTS.md writer.
 */

import {
  ROUTING_END_MARKER,
  ROUTING_START_MARKER,
  type RoutingWriteResult,
  writeRoutingBlock,
} from './routing-block'

const ROUTING_BODY = `## prjct usage

This project uses prjct for memory + workflow tracking. **Do not ask the
user to run prjct commands** — recognize their intent and run the right
verb yourself.

The full verb intent map and the suggest-vs-auto-execute protocol live
in the global skill at \`~/.claude/skills/prjct/SKILL.md\`. Two reminders
that travel with this project:

- **Routine captures auto-execute, no permission.** When the user mentions
  a decision, learning, gotcha, or random thought, save it via
  \`prjct remember <type>\` or \`prjct capture\` immediately and confirm in
  one line. Asking "want me to save that?" is the failure mode. Author
  every entry in ENGLISH, whatever language the user speaks.
- **Destructive verbs suggest first.** \`ship\`, \`status done\`, \`prefs set\`,
  and the audit/security/investigate workflows surface a one-line plan
  ("I'll run \`prjct ship\` — bumps version, opens PR. Ok?") and wait for
  green light.

When in doubt: capture is always safe; ship is never silent.`

const FULL_BLOCK = `${ROUTING_START_MARKER}
${ROUTING_BODY}
${ROUTING_END_MARKER}
`

/** Write or refresh the prjct routing block at `<projectPath>/CLAUDE.md`. */
export async function writeProjectClaudeMd(projectPath: string): Promise<RoutingWriteResult> {
  return writeRoutingBlock(projectPath, 'CLAUDE.md', FULL_BLOCK)
}

// Exposed for test-only assertions on the exact block shape.
export const _routing = {
  START_MARKER: ROUTING_START_MARKER,
  END_MARKER: ROUTING_END_MARKER,
  FULL_BLOCK,
}
