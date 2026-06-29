/**
 * Shared writer for prjct's per-project routing blocks (CLAUDE.md,
 * AGENTS.md). One read-merge-write skeleton, marker-managed via
 * `mergeWithMarkers` — the per-file modules supply only their filename
 * and body. Keeping the skeleton in one place means the merge/idempotency
 * contract can't silently desync between agent surfaces.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { mergeWithMarkers } from '../infrastructure/ide-project-installer'
import { getErrorMessage, isNotFoundError } from '../types/fs'

export const ROUTING_START_MARKER = '<!-- prjct:routing - do not edit between markers -->'
export const ROUTING_END_MARKER = '<!-- /prjct:routing - managed by prjct -->'

/**
 * The ONLY content prjct ever writes into a client repo's instruction surfaces
 * (AGENTS.md / CLAUDE.md), and only when the user explicitly runs `prjct
 * agents`. Clean-repo sovereignty doctrine: a project repo's sole prjct
 * footprint is `.prjct/`; every rule and all project knowledge live in prjct's
 * SQLite and the global agent config, pulled on demand.
 *
 * This is a MAP of the harness, not a ruleset: it names each organ (memory/KB,
 * skills, agents, guardrails) and the ONE command to pull it, so the model
 * knows WHERE to look without loading anything wholesale. Never inline the
 * rules/RAG protocol/verb map themselves — those belong in prjct.
 */
export const MINIMAL_ROUTING_BODY = `## prjct — map of this project's harness
This project uses prjct. Recognize intent and run the verb yourself.
This file holds no rules — pull on demand. The harness lives in prjct:
- \`prjct work --md\` — entrypoint: the work cycle + related context.
- \`prjct context memory <topic>\` / \`prjct search "<q>"\` — memory + knowledge base (voice, glossary, decisions, gotchas, learnings).
- \`prjct guard <file>\` before a risky edit · \`prjct remember <type> "<text>"\` to persist outcomes.
Skills, the agent catalog, and rules live in prjct — pulled, never inlined here.`

export interface RoutingWriteResult {
  action: 'created' | 'updated' | 'unchanged'
  path: string
}

/**
 * Write or refresh a prjct routing block at `<projectPath>/<filename>`.
 *
 * - File missing → create with just the block + trailing newline.
 * - File present without markers → append (with separator).
 * - File present with markers → replace block content; user content
 *   outside markers is preserved.
 */
export async function writeRoutingBlock(
  projectPath: string,
  filename: string,
  fullBlock: string
): Promise<RoutingWriteResult> {
  const file = path.join(projectPath, filename)
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

  const merged = mergeWithMarkers(
    fileExists ? existing : '',
    fullBlock,
    ROUTING_START_MARKER,
    ROUTING_END_MARKER
  )

  if (fileExists && merged.content === existing) {
    return { action: 'unchanged', path: file }
  }

  await fs.writeFile(file, merged.content, 'utf-8')
  return { action: fileExists ? 'updated' : 'created', path: file }
}
