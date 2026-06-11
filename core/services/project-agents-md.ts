/**
 * Project AGENTS.md — routing block writer.
 *
 * AGENTS.md is the cross-agent convention (OpenAI Codex et al.) for
 * project instructions. This writes (or refreshes between markers) a
 * compact prjct block so non-Claude agents pick up the prjct contract
 * on project load — the Codex counterpart of `writeProjectClaudeMd`.
 * Vendor-neutral wording: Codex has no hooks injecting context, so the
 * block must stand on its own. Idempotent via `mergeWithMarkers`; user
 * content outside the markers is never touched.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { mergeWithMarkers } from '../infrastructure/ide-project-installer'
import { getErrorMessage, isNotFoundError } from '../types/fs'

const START_MARKER = '<!-- prjct:routing - do not edit between markers -->'
const END_MARKER = '<!-- /prjct:routing - managed by prjct -->'

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

const FULL_BLOCK = `${START_MARKER}
${ROUTING_BODY}
${END_MARKER}
`

/**
 * Write or refresh the prjct routing block at `<projectPath>/AGENTS.md`.
 *
 * - File missing → create with just the block + trailing newline.
 * - File present without markers → append (with separator).
 * - File present with markers → replace block content; user content
 *   outside markers is preserved.
 */
export async function writeProjectAgentsMd(
  projectPath: string
): Promise<{ action: 'created' | 'updated' | 'unchanged'; path: string }> {
  const file = path.join(projectPath, 'AGENTS.md')
  let existing = ''
  let fileExists = true
  try {
    existing = await fs.readFile(file, 'utf-8')
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw new Error(`Could not read ${file}: ${getErrorMessage(error)}`)
    }
    fileExists = false
  }

  const merged = mergeWithMarkers(fileExists ? existing : '', FULL_BLOCK, START_MARKER, END_MARKER)

  if (fileExists && merged.content === existing) {
    return { action: 'unchanged', path: file }
  }

  await fs.writeFile(file, merged.content, 'utf-8')
  return {
    action: fileExists ? 'updated' : 'created',
    path: file,
  }
}

// Exposed for test-only assertions on the exact block shape.
export const _routing = { START_MARKER, END_MARKER, FULL_BLOCK }
