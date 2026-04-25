/**
 * Stop hook — fires when Claude finishes a turn.
 *
 * Nudges Claude to capture a learning if the turn produced raw edits
 * but nothing durable got written anywhere — no ship, no capture, no
 * remember, no status change, no tag. Pure nudge: `additionalContext`
 * only, never `decision: "block"`.
 *
 * We treat every `memory.*` event EXCEPT `memory.post_edit` as a
 * checkpoint (ships, captures, remembers, tagged tasks, status
 * transitions, bug reports, llm analysis saves…). The hook used to
 * only look at `memory.remember.%`, which meant shipping a feature,
 * capturing to inbox, or closing a task still left the nag firing.
 */

import configManager from '../infrastructure/config-manager'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import { ingestCapturedNotes } from '../services/wiki-ingest'
import prjctDb from '../storage/database'
import type { LocalConfig } from '../types/config'
import { buildHookOutput, emit, readStdinSafe, safeRun } from './_shared'

const RECENT_REMEMBER_WINDOW_MS = 30 * 60 * 1000
const POST_EDIT_EVENT = 'memory.post_edit'

export async function buildStopContext(
  projectPath: string,
  preloadedConfig?: LocalConfig | null
): Promise<string | null> {
  const config = preloadedConfig ?? (await configManager.readConfig(projectPath))
  if (!config?.projectId) return null

  const projectId = config.projectId
  const sinceIso = new Date(Date.now() - RECENT_REMEMBER_WINDOW_MS).toISOString()

  // Single pass over the events table: count edits vs. everything else
  // in the memory namespace. Avoids two round-trips and keeps the two
  // counts on a consistent snapshot.
  let rows: Array<{ type: string; count: number }>
  try {
    rows = prjctDb.query<{ type: string; count: number }>(
      projectId,
      `SELECT
         CASE WHEN type = ? THEN 'edit' ELSE 'checkpoint' END AS type,
         COUNT(*) AS count
       FROM events
       WHERE type LIKE 'memory.%' AND timestamp > ?
       GROUP BY 1`,
      POST_EDIT_EVENT,
      sinceIso
    )
  } catch {
    return null
  }

  let editCount = 0
  let checkpointCount = 0
  for (const r of rows) {
    if (r.type === 'edit') editCount = r.count
    else checkpointCount = r.count
  }

  // No edits → nothing to reflect on.
  if (editCount === 0) return null
  // Anything durable already landed (ship, capture, remember, tag,
  // status change…) → don't nag.
  if (checkpointCount > 0) return null

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
    // Read once; pass to both the context builder and the regen call.
    const config = await configManager.readConfig(projectPath).catch(() => null)
    const context = await buildStopContext(projectPath, config)
    emit(buildHookOutput('Stop', context))

    // Close the loop: vault notes the user dropped into `captured/` get
    // ingested into DB, then the `_generated/` snapshot is rewritten so
    // both directions stay in sync each turn. Best-effort.
    if (!config?.projectId) return
    try {
      await ingestCapturedNotes(projectPath)
    } catch {
      // Ingest failure shouldn't block regen — captured/ stays for next turn.
    }
    await regenerateWikiDeferred(projectPath, config.projectId).catch(() => undefined)
  })
}
