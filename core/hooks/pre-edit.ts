/**
 * PreToolUse hook (matcher: Edit|Write). Surfaces the *preventive* memory
 * recorded against the file about to be edited — gotchas, anti-patterns,
 * recurring-bugs — so the trap is seen BEFORE it's stepped in. Nudge, never
 * block.
 *
 * Why this exists (and why it came back): anticipation was originally a push
 * hook, then retired in favor of the pull `prjct guard <file>` / `prjct_guard`
 * MCP tool (provider-agnostic, keeps context lean). But pull depends on the
 * agent's instinct to ask — which the skill-miss-detector proves often fails,
 * and which a freshly-updated model (reset instinct, zero conversation
 * context) fails worst. So we keep BOTH: non-Claude agents pull on demand;
 * Claude gets this push at the exact moment it matters. The hook fires
 * regardless of model, so the knowledge applies across model updates without
 * relying on the agent remembering to look.
 *
 * Same intelligence as `prjct guard` (projectMemory.recallForFile). Only
 * emits when a preventive entry is tagged to the target file; otherwise `{}`
 * — no harness, no noise.
 */

import configManager from '../infrastructure/config-manager'
import type { MemoryEntry } from '../memory/entries'
import { deriveTitle } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { recordSurfacedForActiveTask } from '../services/usefulness/surface-attribution'
import { type HookIo, runHook } from './_runner'
import { safeTruncate } from './_shared'

const MAX_CHARS = 1200
const MAX_ENTRIES = 3

interface HookInput {
  tool_name?: string
  tool_input?: { file_path?: string }
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

async function buildPreEditContext(projectPath: string, filePath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  let hits: MemoryEntry[]
  try {
    hits = projectMemory.recallForFile(config.projectId, filePath, MAX_ENTRIES)
  } catch {
    return null
  }
  if (hits.length === 0) return null

  // Push-path ship attribution: this gotcha just reached the agent at the
  // moment it matters — if the task ships, it earned its keep.
  void recordSurfacedForActiveTask(
    config.projectId,
    projectPath,
    hits.map((e) => e.id)
  )

  const base = filePath.split('/').pop() ?? filePath
  const lines = [`# prjct: heads-up before editing \`${base}\``, '']
  lines.push(
    `${hits.length} preventive memory entr${hits.length === 1 ? 'y' : 'ies'} recorded against this file:`
  )
  lines.push('')
  for (const e of hits) {
    lines.push(`- **[${labelFor(e)}] ${deriveTitle(e)}** — ${flatDetail(e.content)}  \`${e.id}\``)
  }
  lines.push('')
  lines.push('> Nudge, not block. Apply if it still holds; proceed if not.')
  return safeTruncate(lines.join('\n'), MAX_CHARS)
}

export function runPreEditHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PreToolUse',
      projectPath,
      build: async (input, p) => {
        const filePath = input.tool_input?.file_path?.trim()
        if (!filePath) return null
        return buildPreEditContext(p, filePath)
      },
    },
    io
  )
}
