/**
 * Project CLAUDE.md — routing block writer.
 *
 * Writes (or refreshes between markers) a small block at the project's
 * `CLAUDE.md` that tells Claude "this project uses prjct — refer to
 * the global skill, don't make the user type commands". Idempotent
 * via the same `mergeWithMarkers` helper used by the global config.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { mergeWithMarkers } from '../infrastructure/ide-project-installer'
import { getErrorMessage, isNotFoundError } from '../types/fs'

const START_MARKER = '<!-- prjct:routing - do not edit between markers -->'
const END_MARKER = '<!-- /prjct:routing - managed by prjct -->'

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

const FULL_BLOCK = `${START_MARKER}
${ROUTING_BODY}
${END_MARKER}
`

/**
 * Write or refresh the prjct routing block at `<projectPath>/CLAUDE.md`.
 *
 * - File missing → create with just the block + trailing newline.
 * - File present without markers → append (with separator).
 * - File present with markers → replace block content; user content
 *   outside markers is preserved.
 */
export async function writeProjectClaudeMd(
  projectPath: string
): Promise<{ action: 'created' | 'updated' | 'unchanged'; path: string }> {
  const file = path.join(projectPath, 'CLAUDE.md')
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
