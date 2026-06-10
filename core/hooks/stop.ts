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

import fs from 'node:fs/promises'
import configManager from '../infrastructure/config-manager'
import { embeddingService } from '../services/embeddings'
import { detectFriction } from '../services/friction-detector'
import { detectAndPersistPatterns } from '../services/pattern-detector'
import { recordCleanupReport, runSessionCleanup } from '../services/session-cleanup'
import { detectSkillMisses } from '../services/skill-miss-detector'
import { parseTranscriptJsonl, type TranscriptJsonlLine } from '../services/transcript-jsonl'
import { ingestTranscript } from '../services/transcript-learner'
import { usefulnessService } from '../services/usefulness'
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

        // Read + parse the transcript ONCE. Three consumers below
        // (transcript-learner, friction-detector, skill-miss-detector) each
        // used to re-read and re-tokenize the same multi-hundred-KB JSONL.
        let transcriptLines: TranscriptJsonlLine[] | undefined
        if (input.transcript_path) {
          const raw = await fs.readFile(input.transcript_path, 'utf-8').catch(() => null)
          if (raw !== null) transcriptLines = parseTranscriptJsonl(raw)
        }

        // Captured notes → memory entries (existing behavior).
        try {
          await ingestCapturedNotes(p)
        } catch {
          // Ingest failure shouldn't block regen — captured/ stays for next turn.
        }

        // M1b INPUT: workflow overrides → workflow_rules table.
        try {
          await ingestWorkflowEdits(p, config)
        } catch {
          // Same contract — failed parses leave the file in place for the user.
        }

        // M1a: auto-capture substantive insights from the assistant's
        // transcript. Conservative heuristics, hashed-dedup, never blocks.
        if (input.transcript_path) {
          try {
            await ingestTranscript(p, input.transcript_path, input.session_id ?? null, {
              preloadedConfig: config,
              preloadedLines: transcriptLines,
            })
          } catch {
            // Failed parse / unexpected format → swallow. The user can
            // always run `prjct remember` explicitly.
          }
        }

        // M2: detect durable patterns (hot files for now) and persist them
        // as learning memory entries. Lookup-first protocol means Claude
        // finds them on next session start without inflating context.
        try {
          await detectAndPersistPatterns(p, config)
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
            const friction = await detectFriction(
              p,
              input.transcript_path,
              input.session_id ?? null,
              {
                preloadedLines: transcriptLines,
              }
            )
            // AUTOMATIC negative reinforcement (no command): if the user
            // pushed back this session, demote the memories that were in
            // context for the active task. prjct learns from mistakes on its
            // own — the explicit `corrects:` tag is now an optional override,
            // not a requirement.
            if (friction.signalsRecorded > 0) {
              // Per-worktree: penalize memories surfaced for THIS workspace's
              // task, not a sibling worktree's. Falls back to singular.
              const { collectActiveTasks } = await import('../services/task-overview')
              const overview = await collectActiveTasks(config.projectId, p)
              const taskId = overview.current?.id
              if (taskId) usefulnessService.penalizeSurfaced(config.projectId, taskId)
            }
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
            await detectSkillMisses(p, input.transcript_path, input.session_id ?? null, {
              preloadedLines: transcriptLines,
            })
          } catch {
            /* silent best-effort — must never block session end */
          }
        }

        // Semantic index maintenance: embed memory entries written this
        // session so semantic recall stays current. The default provider is
        // the in-process local embedder (no network, no key), so this runs for
        // every project; a configured HTTP endpoint transparently takes over.
        // Best-effort, idempotent (only un-embedded entries are touched), and
        // must never block session end.
        try {
          // First arg is the projectId, NOT the path: passing `p` here keyed
          // every query to path.join(projectsDir, <abs path>) — a phantom DB
          // under ~/.prjct-cli/projects/Users/... that made the session-end
          // backfill a silent no-op (ghost dirs confirmed on disk).
          await embeddingService.backfill(config.projectId, config, new Date().toISOString())
        } catch {
          /* never block session end on index maintenance */
        }

        await regenerateWikiDeferred(p, config.projectId).catch(() => undefined)
      },
    },
    io
  )
}
