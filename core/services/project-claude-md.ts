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
