/**
 * CwdChanged hook — fires when Claude Code's working directory changes.
 *
 * Use case: the human `cd`s into a different prjct project (or a
 * worktree with its own `.prjct/prjct.config.json`). Without a fresh
 * context dump, the session is still holding the previous project's
 * persona/memory. This hook re-injects whatever the new cwd declares.
 *
 * If the new cwd has no prjct project, we emit `{}` — no noise.
 */

import { buildHookOutput, emit, readStdinSafe, safeRun } from './_shared'
import { buildSessionContext } from './session-start'

interface HookInput {
  cwd?: string
}

export async function runCwdChangedHook(fallbackCwd: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    const input = await readStdinSafe<HookInput>()
    const cwd = input.cwd || fallbackCwd
    const context = await buildSessionContext(cwd)
    emit(buildHookOutput('CwdChanged', context))
  })
}
