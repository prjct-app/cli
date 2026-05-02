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

export async function runHook<I = Record<string, unknown>>(opts: RunHookOptions<I>): Promise<void> {
  const projectPath = opts.projectPath ?? process.cwd()
  await safeRun(async () => {
    const input = await readStdinSafe<I>()
    const context = opts.build ? await opts.build(input, projectPath) : null
    emit(buildHookOutput(opts.event, context))
    if (opts.afterEmit) await opts.afterEmit(input, projectPath)
  })
}
