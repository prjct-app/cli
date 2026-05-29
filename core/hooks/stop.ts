/**
 * Stop hook — fires when Claude finishes a turn.
 *
 * Silent by contract. The hook does several useful things, all in
 * `afterEmit` so the host parser doesn't wait on housekeeping:
 *   1. Ingest captured/ notes + workflow edits → SQLite.
 *   2. Mine the assistant transcript for substantive captures.
 *   3. Detect durable patterns (hot files, debt growth).
 *   4. Run session-end housekeeping (inbox age-out, archive prune).
 *   5. Detect friction signals from user pushback in the transcript.
 *   6. Regenerate the `_generated/` vault snapshot.
 *
 * Each step internally swallows its own failures, so the rest of
 * cleanup still runs even if one step trips. The hook deliberately
 * injects no user-visible message — see mem_220 for the anti-harness
 * rationale (we used to nag "N edits without a memory entry"; that
 * delegated capture to Claude instead of doing it ourselves).
 */

import configManager from '../infrastructure/config-manager'
import { embeddingService } from '../services/embeddings'
import { detectFriction } from '../services/friction-detector'
import { detectAndPersistPatterns } from '../services/pattern-detector'
import { recordCleanupReport, runSessionCleanup } from '../services/session-cleanup'
import { detectSkillMisses } from '../services/skill-miss-detector'
import { ingestTranscript } from '../services/transcript-learner'
import { regenerateWikiDeferred } from '../services/wiki-generator'
import { ingestCapturedNotes, ingestWorkflowEdits } from '../services/wiki-ingest'
import { type HookIo, runHook } from './_runner'

interface HookInput {
  transcript_path?: string
  session_id?: string
}

export function runStopHook(projectPath: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'Stop',
      projectPath,
      afterEmit: async (input, p) => {
        const config = await configManager.readConfig(p).catch(() => null)
        if (!config?.projectId) return

        // Captured notes → memory entries (existing behavior).
        try {
          await ingestCapturedNotes(p)
        } catch {
          // Ingest failure shouldn't block regen — captured/ stays for next turn.
        }

        // M1b INPUT: workflow overrides → workflow_rules table.
        try {
          await ingestWorkflowEdits(p)
        } catch {
          // Same contract — failed parses leave the file in place for the user.
        }

        // M1a: auto-capture substantive insights from the assistant's
        // transcript. Conservative heuristics, hashed-dedup, never blocks.
        if (input.transcript_path) {
          try {
            await ingestTranscript(p, input.transcript_path, input.session_id ?? null)
          } catch {
            // Failed parse / unexpected format → swallow. The user can
            // always run `prjct remember` explicitly.
          }
        }

        // M2: detect durable patterns (hot files for now) and persist them
        // as learning memory entries. Lookup-first protocol means Claude
        // finds them on next session start without inflating context.
        try {
          await detectAndPersistPatterns(p)
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
            await detectFriction(p, input.transcript_path, input.session_id ?? null)
          } catch {
            /* same contract as transcript-learner — silent best-effort */
          }
        }

        // Session-end skill-miss capture (harness #16): flag captured
        // project knowledge (decision/gotcha/anti-pattern) that was
        // relevant to this session's work but never referenced. Persisted
        // as `improvement-signal` and surfaced under the existing block at
        // the next session start — advisory, never a gate. Same silent
        // best-effort contract as the friction detector above.
        if (input.transcript_path) {
          try {
            await detectSkillMisses(p, input.transcript_path, input.session_id ?? null)
          } catch {
            /* silent best-effort — must never block session end */
          }
        }

        // Semantic index maintenance (opt-in): when an embeddings provider is
        // configured, embed memory entries written this session so semantic
        // recall stays current. Best-effort and — in daemon mode — detached,
        // so the network round-trip never blocks session end. No-op (and no
        // network) when embeddings are disabled or the index is current.
        if (embeddingService.isEnabled(config)) {
          try {
            await embeddingService.backfill(p, config, new Date().toISOString())
          } catch {
            /* never block session end on index maintenance */
          }
        }

        await regenerateWikiDeferred(p, config.projectId).catch(() => undefined)
      },
    },
    io
  )
}
