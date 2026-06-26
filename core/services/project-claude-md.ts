/**
 * Project CLAUDE.md — routing block writer.
 *
 * Writes (or refreshes between markers) a small block at the project's
 * `CLAUDE.md` that tells Claude "this project uses prjct — refer to
 * the global skill, don't make the user type commands". The
 * read-merge-write skeleton lives in `routing-block.ts`, shared with
 * the AGENTS.md writer.
 */

import { AGENT_RAG_PROTOCOL } from './agent-rag-protocol'
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

- **\`prjct work\` is the single normal entrypoint.** prjct classifies the
  AI Agile work cycle and reports the persisted pipeline station. Trivial work
  proceeds directly. Substantive implementation work follows an intent brief +
  strict evidence: reviewed intent, tests before implementation when required,
  then code. Resume from \`prjct work --md\`; do not invent a parallel plan.
- **Lookup is pull-first and bounded.**
${AGENT_RAG_PROTOCOL}
- **Routine synthesis auto-executes, no permission.** When the user mentions
  a decision, learning, gotcha, or reusable context, save it via
  \`prjct remember <type>\` immediately and confirm in one line. Legacy inbox
  aliases exist for old scripts but should not be the normal path. Asking "want
  me to save that?" is the failure mode. Author every entry in ENGLISH.
- **Destructive verbs suggest first.** \`ship\`, \`prefs set\`,
  and the audit/security/investigate workflows surface a one-line plan
  ("I'll run \`prjct ship\` — bumps version, opens PR. Ok?") and wait for
  green light.

When in doubt: synthesized memory is safe; ship is never silent.`

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
