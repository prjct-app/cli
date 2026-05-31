/**
 * PreToolUse hook (matcher: Edit|Write) — ANTICIPATION (RAG north star,
 * pillar 3).
 *
 * Right before a file is edited, surface the preventive memory recorded
 * against THAT file — gotchas, anti-patterns, recurring bugs — so the trap is
 * seen before it's stepped in. This is the "prevent bugs / know the project"
 * half made proactive: not a search the agent has to remember to run, but a
 * heads-up at the exact moment it matters.
 *
 * Strict + quiet by design: it injects nothing unless a genuinely preventive
 * memory matches the file (see projectMemory.recallForFile), so it never
 * becomes per-edit noise.
 */

import configManager from '../infrastructure/config-manager'
import { deriveTitle, type MemoryEntry, projectMemory } from '../memory/project-memory'
import { type HookIo, runHook } from './_runner'
import { safeTruncate } from './_shared'

const MAX_CHARS = 700

interface EditOrWriteToolInput {
  file_path?: string
}

interface HookInput {
  tool_name?: string
  tool_input?: EditOrWriteToolInput
}

function render(filePath: string, hits: MemoryEntry[]): string {
  const base = filePath.split('/').pop() ?? filePath
  const lines = [`# prjct: heads up before editing \`${base}\``, '']
  lines.push('Preventive memory recorded against this file — check before you change it:')
  lines.push('')
  for (const e of hits) {
    const label =
      e.type === 'gotcha'
        ? 'gotcha'
        : e.tags?.pattern === 'recurring-bug'
          ? 'recurring-bug'
          : e.type
    const flat = e.content.replace(/\s+/g, ' ').trim()
    const detail = flat.length > 220 ? `${flat.slice(0, 219)}…` : flat
    lines.push(`- **[${label}] ${deriveTitle(e)}** — ${detail}  \`${e.id}\``)
  }
  lines.push('', '> Surfaced as prevention. Apply if relevant; ignore if not.')
  return safeTruncate(lines.join('\n'), MAX_CHARS)
}

/**
 * Build the pre-edit context block for `input` under `projectPath`, or
 * null when nothing preventive matches the edited file. Exported so the
 * anticipation contract (quiet unless a real trap matches) is testable
 * without driving stdin through the runner.
 */
export async function buildPreEditContext(
  input: HookInput,
  projectPath: string
): Promise<string | null> {
  const file = input.tool_input?.file_path
  if (!file) return null
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null
  let hits: MemoryEntry[]
  try {
    hits = projectMemory.recallForFile(config.projectId, file, 3)
  } catch {
    return null
  }
  if (hits.length === 0) return null
  return render(file, hits)
}

export function runPreEditHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PreToolUse',
      projectPath,
      build: (input, p) => buildPreEditContext(input, p),
    },
    io
  )
}
