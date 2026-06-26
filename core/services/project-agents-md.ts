/**
 * Project AGENTS.md — routing block writer.
 *
 * AGENTS.md is the cross-agent convention (OpenAI Codex et al.) for
 * project instructions — the Codex counterpart of `writeProjectClaudeMd`.
 * Vendor-neutral wording: Codex has no hooks injecting context, so the
 * block must stand on its own. The read-merge-write skeleton lives in
 * `routing-block.ts`, shared with the CLAUDE.md writer.
 */

import { AGENT_RAG_PROTOCOL } from './agent-rag-protocol'
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
  \`prjct context memory <topic>\` (past work, decisions, gotchas, learnings).
- \`prjct work "<intent>"\` is the single normal entrypoint. prjct classifies
  the AI Agile work cycle, reports the persisted pipeline station, and surfaces
  related second brain context before you plan or edit.
- Lookup is pull-first and bounded:
${AGENT_RAG_PROTOCOL}
- Trivial work proceeds directly; no intent brief is required for typo/docs/rerun
  style work.
- Substantive implementation work follows a persisted intent brief + strict
  evidence: create/link a reviewed intent, write tests before implementation
  when required, then code against those tests.
- Resume from the station shown by \`prjct work --md\`;
  do not invent a parallel plan or ask the user to run separate methodology
  commands first.
- Agent instruction surfaces use fixed templates. User work text is data,
  not executable instruction text and not copied into managed instructions.
- Persist outcomes as synthesized memory: \`prjct remember <decision|gotcha|learning|context> "<text>"\`
  (author entries in English). Legacy inbox aliases exist for old scripts but
  should not be the normal path.
- Before editing a risky file: \`prjct guard <file>\` surfaces known traps.
- Prefer the \`prjct_*\` MCP tools when available; otherwise run the CLI
  with \`--md\` for agent-readable output.

Routine synthesis auto-executes (confirm in one line); \`ship\` and other
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
