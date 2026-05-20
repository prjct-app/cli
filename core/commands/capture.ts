/**
 * `prjct capture` — GTD-style universal inbox.
 *
 * The 80% of dumps during the day ("llamar a Ana", "leer paper X",
 * "idea: auto-tag tasks") aren't commitments and don't deserve a
 * branch, worktree, or task id. They deserve a single keystroke to
 * persist and keep going. `capture` does exactly that:
 *
 *   prjct capture "<anything>" [--tags k:v,k:v]
 *
 * Writes a memory entry with `type=inbox`. Claude (or the human via a
 * `clarify` workflow) can retype later to a real type — the entry's id
 * travels, tags travel, content travels.
 *
 * Anti-harness: `capture` does one thing — persist. It doesn't
 * classify, doesn't suggest a type, doesn't ask the LLM for follow-up.
 * If the caller wants structure later, that's a different verb.
 */

import { projectMemory } from '../memory/project-memory'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { failHard } from '../utils/md-aware'
import out from '../utils/output'
import { scanForPromptInjection } from '../utils/prompt-injection'
import { scanForSecrets } from '../utils/secret-scanner'
import { PrjctCommandsBase } from './base'

export class CaptureCommands extends PrjctCommandsBase {
  /**
   * /p:capture "<anything>" [--tags k:v,...]
   *
   * Project init isn't required — you might capture in a fresh repo
   * and only later `prjct init`. If there's no project yet, the call
   * fails fast with a helpful hint.
   */
  async capture(
    content: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; tags?: string; force?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      if (!content || !content.trim()) {
        out.info('Usage: prjct capture "<anything>" [--tags k:v,...]')
        return { success: false, error: 'Content required' }
      }

      const text = content.trim()

      const secretHits = scanForSecrets(text)
      if (secretHits.length > 0 && !options.force) {
        out.fail(
          `refusing to capture content that looks like a secret (${secretHits.join(', ')}). Re-run with --force if intentional.`
        )
        return { success: false, error: 'Secret-like content detected' }
      }

      const injectionHits = scanForPromptInjection(text)
      if (injectionHits.length > 0 && !options.force) {
        out.fail(
          `refusing to capture content that looks like prompt injection (${injectionHits.join(', ')}). Captures are inlined into LLM context — re-run with --force if intentional.`
        )
        return { success: false, error: 'Prompt-injection-like content detected' }
      }

      const tags = parseFlagTags(options.tags)

      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      await projectMemory.remember(projectPath, {
        type: 'inbox',
        content: text,
        tags,
        provenance: 'declared',
      })

      const preview = text.length > 60 ? `${text.slice(0, 57)}…` : text
      if (options.md) console.log(`✓ captured: ${preview}`)
      else out.done(`captured: ${preview}`)

      return { success: true, type: 'inbox', content: text, tags }
    } catch (error) {
      const msg = getErrorMessage(error)
      return failHard(msg)
    }
  }
}

function parseFlagTags(raw: string | undefined): Record<string, string> {
  if (!raw) return {}
  const tags: Record<string, string> = {}
  for (const token of raw.split(',')) {
    const pair = token.trim()
    const idx = pair.indexOf(':')
    if (idx > 0) tags[pair.slice(0, idx)] = pair.slice(idx + 1)
  }
  return tags
}
