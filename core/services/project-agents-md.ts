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
  MINIMAL_ROUTING_BODY,
  ROUTING_END_MARKER,
  ROUTING_START_MARKER,
  type RoutingWriteResult,
  writeRoutingBlock,
} from './routing-block'

const FULL_BLOCK = `${ROUTING_START_MARKER}
${MINIMAL_ROUTING_BODY}
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
