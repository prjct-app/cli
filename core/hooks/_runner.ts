/**
 * Hook lifecycle runner. Replaces the boilerplate quartet
 * `safeRun + readStdinSafe + buildHookOutput + emit` that every hook
 * entry-point used to repeat verbatim.
 *
 * A hook now declares only what makes IT distinctive:
 *   - the Claude Code event name (so the output schema is correct)
 *   - an optional `build` that produces the additionalContext / null
 *   - an optional `afterEmit` for side-effects that must not block the
 *     host (DB writes, vault regen, self-heal, etc.)
 *
 * The runner guarantees:
 *   1. Never throws past the harness — `safeRun` swallows all errors.
 *   2. stdin is read with the standard 200ms timeout.
 *   3. Output is JSON-validated against the event's schema by
 *      `buildHookOutput` (e.g. SessionStart accepts hookSpecificOutput,
 *      Stop only accepts systemMessage).
 *   4. After-effects run AFTER `emit` so the host parser doesn't wait
 *      on side-effect work.
 *
 * Two execution modes share ALL of the above:
 *   - Process mode (`io` omitted): the cold path Claude Code spawns —
 *     reads `process.stdin`, writes `process.stdout`, awaits `afterEmit`.
 *   - Daemon mode (`io` supplied): the warm path — input comes pre-parsed
 *     from the wire request, output goes to a sink (returned to the
 *     client), and `afterEmit` is DETACHED so it never blocks the daemon's
 *     serialized request chain. Same build + same fail-soft contract.
 */

import { buildHookOutput, emit, readStdinSafe, safeRun } from './_shared'

export interface RunHookOptions<I> {
  /** Claude Code event name (SessionStart, UserPromptSubmit, etc.). */
  event: string
  /** Project path; defaults to process.cwd(). */
  projectPath?: string
  /** Build the additionalContext / systemMessage body. Return null to
   *  inject nothing (the runner emits `{}` instead). Omit for hooks
   *  that are purely side-effect driven. */
  build?: (input: I, projectPath: string) => Promise<string | null>
  /** Optional side-effects that run AFTER emit. The runner already
   *  swallows errors thrown here via safeRun; explicit try/catch is
   *  only needed when you want to keep going after a sub-step fails. */
  afterEmit?: (input: I, projectPath: string) => Promise<void>
}

/**
 * Daemon-mode I/O bridge. When present, the hook runs warm inside the
 * daemon instead of cold in a freshly-spawned process.
 */
export interface HookIo {
  /** The hook event payload, already parsed from the wire request. */
  input: unknown
  /** Receives the exact bytes the process path would write to stdout
   *  (a JSON line terminated by `\n`). The daemon returns this verbatim
   *  to the client, which writes it raw — byte-identical to the cold path. */
  sink: (chunk: string) => void
  /** Schedule `afterEmit` to run WITHOUT blocking the response or the
   *  daemon's request chain (typically `setImmediate` + error swallow). */
  detachAfterEmit: (fn: () => Promise<void>) => void
}

export async function runHook<I = Record<string, unknown>>(
  opts: RunHookOptions<I>,
  io?: HookIo
): Promise<void> {
  const projectPath = opts.projectPath ?? process.cwd()

  if (io) {
    // Daemon (warm) path. Mirror the process path's fail-soft contract:
    // any throw becomes the empty no-op `{}` so a broken hook can never
    // disturb the host session.
    try {
      const input = io.input as I
      const context = opts.build ? await opts.build(input, projectPath) : null
      io.sink(`${JSON.stringify(buildHookOutput(opts.event, context))}\n`)
      if (opts.afterEmit) io.detachAfterEmit(() => opts.afterEmit!(input, projectPath))
    } catch {
      io.sink('{}\n')
    }
    return
  }

  // Process (cold) path — unchanged.
  await safeRun(async () => {
    const input = await readStdinSafe<I>()
    const context = opts.build ? await opts.build(input, projectPath) : null
    emit(buildHookOutput(opts.event, context))
    if (opts.afterEmit) await opts.afterEmit(input, projectPath)
  })
}
