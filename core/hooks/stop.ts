/**
 * Stop hook — fires when Claude finishes a turn.
 *
 * Silent by contract. The hook does two useful things:
 *   1. Ingests any markdown notes the user dropped into the vault's
 *      `captured/` directory into SQLite.
 *   2. Regenerates the `_generated/` vault snapshot so the on-disk
 *      files reflect current DB state.
 *
 * It deliberately injects no user-visible message. An earlier version
 * nagged Claude with "N file edits this session without a memory
 * entry" when it counted raw `memory.post_edit` events but no
 * checkpoint events. That nag violated prjct's anti-harness contract:
 * memory capture flows through the explicit primitives (`remember`,
 * `capture`, `ship`) — telling the model "you forgot to capture" is
 * exactly the kind of harness behavior the project rejects (mem_220).
 * If prjct wants implicit checkpointing, it has to do it itself, not
 * delegate the chore to Claude.
 */

import configManager from '../infrastructure/config-manager'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import { ingestCapturedNotes, ingestWorkflowEdits } from '../services/wiki-ingest'
import { emit, readStdinSafe, safeRun } from './_shared'

export async function runStopHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    await readStdinSafe()
    emit({})

    // Side effects: ingest user-authored content → DB, then refresh the
    // _generated/ snapshot. Best-effort; failures stay silent so the
    // host session is never disturbed.
    const config = await configManager.readConfig(projectPath).catch(() => null)
    if (!config?.projectId) return

    // Captured notes → memory entries (existing behavior).
    try {
      await ingestCapturedNotes(projectPath)
    } catch {
      // Ingest failure shouldn't block regen — captured/ stays for next turn.
    }

    // M1b INPUT: workflow overrides → workflow_rules table.
    try {
      await ingestWorkflowEdits(projectPath)
    } catch {
      // Same contract — failed parses leave the file in place for the user.
    }

    await regenerateWikiDeferred(projectPath, config.projectId).catch(() => undefined)
  })
}
