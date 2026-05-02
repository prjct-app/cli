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
import { detectFriction } from '../services/friction-detector'
import { detectAndPersistPatterns } from '../services/pattern-detector'
import { recordCleanupReport, runSessionCleanup } from '../services/session-cleanup'
import { ingestTranscript } from '../services/transcript-learner'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import { ingestCapturedNotes, ingestWorkflowEdits } from '../services/wiki-ingest'
import { emit, readStdinSafe, safeRun } from './_shared'

interface HookInput {
  transcript_path?: string
  session_id?: string
}

export async function runStopHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    const input = await readStdinSafe<HookInput>()
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

    // M1a: auto-capture substantive insights from the assistant's
    // transcript. Conservative heuristics, hashed-dedup, never blocks.
    if (input.transcript_path) {
      try {
        await ingestTranscript(projectPath, input.transcript_path, input.session_id ?? null)
      } catch {
        // Failed parse / unexpected format → swallow. The user can
        // always run `prjct remember` explicitly.
      }
    }

    // M2: detect durable patterns (hot files for now) and persist them
    // as learning memory entries. Lookup-first protocol means Claude
    // finds them on next session start without inflating context.
    try {
      await detectAndPersistPatterns(projectPath)
    } catch {
      // Git failure / non-repo → swallow; nothing to do here.
    }

    // Session-end housekeeping (Phase A): age-out inbox, prune archives
    // and old checkpoints, rotate stale on-disk caches. Best-effort —
    // each step internally swallows its own failures, so the rest of
    // the cleanup still runs even if one step trips.
    try {
      const cleanup = await runSessionCleanup(config.projectId)
      await recordCleanupReport(config.projectId, cleanup)
    } catch {
      /* never block session end on cleanup */
    }

    // Session-end friction capture (Phase B): scan the transcript for
    // user-pushback moments (negation, correction, complaint markers)
    // and persist them as `improvement-signal` memory entries. The
    // next session's Claude reads them via topical recall and
    // synthesises improvement ideas — no regex-based classification
    // here, only signal extraction.
    if (input.transcript_path) {
      try {
        await detectFriction(projectPath, input.transcript_path, input.session_id ?? null)
      } catch {
        /* same contract as transcript-learner — silent best-effort */
      }
    }

    await regenerateWikiDeferred(projectPath, config.projectId).catch(() => undefined)
  })
}
