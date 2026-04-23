/**
 * Stop hook — fires when Claude finishes a turn.
 *
 * Nudges Claude to capture a learning if the turn produced work
 * (files edited) and no recent `remember` / `capture` fired. Pure
 * nudge: `additionalContext` only, never `decision: "block"`. Claude
 * decides whether to save anything.
 *
 * We skip the nudge when:
 *   - No project config.
 *   - No post_edit events recorded this session.
 *   - A recent `remember.*` event already fired in the last 30 min.
 */

import configManager from '../infrastructure/config-manager'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import { ingestCapturedNotes } from '../services/wiki-ingest'
import prjctDb from '../storage/database'
import { buildHookOutput, emit, readStdinSafe, safeRun } from './_shared'

const RECENT_REMEMBER_WINDOW_MS = 30 * 60 * 1000

export async function buildStopContext(projectPath: string): Promise<string | null> {
  const config = await configManager.readConfig(projectPath)
  if (!config?.projectId) return null

  const projectId = config.projectId

  // Did Claude actually touch files this session? If not, nothing to
  // reflect on.
  const sinceIso = new Date(Date.now() - RECENT_REMEMBER_WINDOW_MS).toISOString()
  let edits: Array<{ count: number }>
  try {
    edits = prjctDb.query<{ count: number }>(
      projectId,
      'SELECT COUNT(*) as count FROM events WHERE type = ? AND timestamp > ?',
      'memory.post_edit',
      sinceIso
    )
  } catch {
    return null
  }
  const editCount = edits[0]?.count ?? 0
  if (editCount === 0) return null

  // If a remember already fired in the window, don't nag.
  let remembers: Array<{ count: number }>
  try {
    remembers = prjctDb.query<{ count: number }>(
      projectId,
      "SELECT COUNT(*) as count FROM events WHERE type LIKE 'memory.remember.%' AND timestamp > ?",
      sinceIso
    )
  } catch {
    return null
  }
  if ((remembers[0]?.count ?? 0) > 0) return null

  return [
    '# prjct: capture checkpoint',
    '',
    `${editCount} file edit${editCount === 1 ? '' : 's'} this session without a memory entry.`,
    '',
    'If anything was reusable — a decision, a gotcha, a pattern — `prjct remember <type> "<content>"` keeps it around for future sessions.',
    '',
    '> Skip if nothing worth saving.',
  ].join('\n')
}

export async function runStopHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    await readStdinSafe()
    const context = await buildStopContext(projectPath)
    emit(buildHookOutput('Stop', context))

    // Close the loop: vault notes the user dropped into `captured/` get
    // ingested into DB, then the `_generated/` snapshot is rewritten so
    // both directions stay in sync each turn. Best-effort.
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId) return
    try {
      await ingestCapturedNotes(projectPath)
    } catch {
      // Ingest failure shouldn't block regen — captured/ stays for next turn.
    }
    await regenerateWikiDeferred(projectPath, config.projectId).catch(() => undefined)
  })
}
