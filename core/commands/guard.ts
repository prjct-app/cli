/**
 * `prjct guard <file>` — ANTICIPATION primitive, provider-agnostic.
 *
 * Surfaces the *preventive* memory recorded against a file — gotchas,
 * anti-patterns, recurring-bugs — so the trap is seen before it's stepped in.
 * This is pillar 3 (anticipation) of the RAG north star: "anticipar, prevenir
 * bugs, conocerse para que el dev y el LLM sean uno mismo".
 *
 * Pull, not push: this is the CLI face of the same intelligence behind the
 * `prjct_guard` MCP tool. The agent (Claude or Codex) asks for a file's traps
 * on demand instead of us injecting them into every turn's context. Keeping
 * anticipation pull-based is what stops it from bloating the context window.
 *
 * Quiet by design: prints "clear to edit" (exit 0) when nothing genuinely
 * preventive matches, so it never becomes noise.
 */

import { deriveTitle, type MemoryEntry, projectMemory } from '../memory/project-memory'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'

interface GuardOptions extends MdOption {
  limit?: number
}

function labelFor(e: MemoryEntry): string {
  if (e.type === 'gotcha') return 'gotcha'
  if (e.tags?.pattern === 'recurring-bug') return 'recurring-bug'
  return e.type
}

function flatDetail(content: string, max = 220): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export class GuardCommands extends PrjctCommandsBase {
  async guard(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: GuardOptions = {}
  ): Promise<CommandResult> {
    const file = (input ?? '').trim().split(/\s+/).filter(Boolean)[0]
    if (!file) {
      const msg = 'Usage: prjct guard <file> — surfaces preventive memory before you edit it.'
      if (options.md) console.log(`> ${msg}`)
      else out.fail(msg)
      return { success: false, error: 'Missing file argument' }
    }

    const guard = await requireProject(projectPath, options)
    if (!guard.ok) return guard.result

    const limit = typeof options.limit === 'number' && options.limit > 0 ? options.limit : 3
    let hits: MemoryEntry[]
    try {
      hits = projectMemory.recallForFile(guard.value, file, limit)
    } catch {
      hits = []
    }

    const base = file.split('/').pop() ?? file

    if (hits.length === 0) {
      const msg = `No preventive memory recorded against \`${base}\` — clear to edit.`
      if (options.md) console.log(`> ${msg}`)
      else out.done(`No preventive memory for ${base} — clear to edit.`)
      return { success: true, file, hits: 0 }
    }

    if (options.md) {
      const lines = [
        `# prjct: heads up before editing \`${base}\``,
        '',
        'Preventive memory recorded against this file — check before you change it:',
        '',
      ]
      for (const e of hits) {
        lines.push(
          `- **[${labelFor(e)}] ${deriveTitle(e)}** — ${flatDetail(e.content)}  \`${e.id}\``
        )
      }
      lines.push('', '> Surfaced as prevention. Apply if relevant; ignore if not.')
      console.log(lines.join('\n'))
    } else {
      out.info(
        `⚠ ${hits.length} preventive memory entr${hits.length === 1 ? 'y' : 'ies'} for ${base}:`
      )
      for (const e of hits) {
        out.info(`  • [${labelFor(e)}] ${deriveTitle(e)} — ${flatDetail(e.content, 120)} (${e.id})`)
      }
    }

    return { success: true, file, hits: hits.length }
  }
}
