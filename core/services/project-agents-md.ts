/**
 * Project AGENTS.md — routing block writer.
 *
 * AGENTS.md is the cross-agent convention (OpenAI Codex et al.) for
 * project instructions — the Codex counterpart of `writeProjectClaudeMd`.
 * Vendor-neutral wording: Codex has no hooks injecting context, so the
 * block must stand on its own. The read-merge-write skeleton lives in
 * `routing-block.ts`, shared with the CLAUDE.md writer.
 */

import {
  ROUTING_END_MARKER,
  ROUTING_START_MARKER,
  type RoutingWriteResult,
  writeRoutingBlock,
} from './routing-block'

const ROUTING_BODY = `## prjct — project memory & workflow

This project uses prjct for persistent memory + workflow tracking.
Recognize the user's intent and run the right verb yourself — do not
ask them to type prjct commands.

- Recall before re-reading source: \`prjct search "<query>"\` or
  \`prjct context memory <topic>\` (decisions, gotchas, learnings).
- Flow: \`prjct task "<desc>"\` → work → \`prjct status done\` → \`prjct ship\`.
- Persist outcomes as you go: \`prjct remember <decision|gotcha|learning|fact> "<text>"\`
  (author entries in English), \`prjct capture "<text>"\` for stray thoughts.
- Before editing a risky file: \`prjct guard <file>\` surfaces known traps.
- Prefer the \`prjct_*\` MCP tools when available; otherwise run the CLI
  with \`--md\` for agent-readable output.

Routine captures auto-execute (confirm in one line); \`ship\` and other
destructive verbs surface a one-line plan and wait for a green light.`

const FULL_BLOCK = `${ROUTING_START_MARKER}
${ROUTING_BODY}
${ROUTING_END_MARKER}
`

/** Write or refresh the prjct routing block at `<projectPath>/AGENTS.md`. */
export async function writeProjectAgentsMd(projectPath: string): Promise<RoutingWriteResult> {
  return writeRoutingBlock(projectPath, 'AGENTS.md', FULL_BLOCK)
}

// Exposed for test-only assertions on the exact block shape.
export const _routing = {
  START_MARKER: ROUTING_START_MARKER,
  END_MARKER: ROUTING_END_MARKER,
  FULL_BLOCK,
}
