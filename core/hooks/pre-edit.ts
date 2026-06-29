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
import { deriveTitle, flatDetail, preventiveLabel } from '../memory/format'
import { projectMemory } from '../memory/project-memory'
import { loopGuardVerdict } from '../services/loop-guard'
import { recordSurfacedForActiveTask } from '../services/usefulness/surface-attribution'
import { stateStorage } from '../storage/state-storage'
import { type HookIo, runHook } from './_runner'
import { safeTruncate } from './_shared'

const MAX_CHARS = 1200
const MAX_ENTRIES = 3

interface HookInput {
  tool_name?: string
  tool_input?: { file_path?: string }
}

async function buildPreEditContext(projectPath: string, filePath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  let hits: MemoryEntry[]
  try {
    // preventiveOnly: this push fires on EVERY edit, so it carries only traps
    // (gotchas / anti-patterns / recurring-bugs). File history ("what happened
    // here") is noise at edit time and stays one pull away via `prjct guard`.
    hits = projectMemory.recallForFile(config.projectId, filePath, MAX_ENTRIES, {
      preventiveOnly: true,
    })
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
    lines.push(
      `- **[${preventiveLabel(e)}] ${deriveTitle(e)}** — ${flatDetail(e.content)}  \`${e.id}\``
    )
  }
  lines.push('')
  lines.push('> Nudge, not block. Apply if it still holds; proceed if not.')
  return safeTruncate(lines.join('\n'), MAX_CHARS)
}

/**
 * Hard loop guard: when the active cycle has run past `config.maxTurnsPerCycle`
 * without `prjct work --extend`, DENY the edit. Rig-agnostic — any host that
 * honors a PreToolUse deny blocks here; others ignore it and get the forceful
 * per-turn injection instead. Best-effort: any error ⇒ no deny (never blocks on
 * a bug). Returns null when the guard is unset/under budget/acknowledged.
 */
async function decideHardStop(projectPath: string): Promise<{ deny: string } | null> {
  try {
    const config = await configManager.readConfig(projectPath)
    if (!config?.projectId || !config.maxTurnsPerCycle) return null
    const task = await stateStorage.getCurrentTask(config.projectId)
    const verdict = loopGuardVerdict(config, task)
    return verdict.stopped ? { deny: verdict.message } : null
  } catch {
    return null
  }
}

export function runPreEditHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'PreToolUse',
      projectPath,
      decide: (_input, p) => decideHardStop(p),
      build: async (input, p) => {
        const filePath = input.tool_input?.file_path?.trim()
        if (!filePath) return null
        return buildPreEditContext(p, filePath)
      },
    },
    io
  )
}
