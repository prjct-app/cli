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

import { type HookIo, runHook } from './_runner'
import { buildSessionContext } from './session-start'

interface HookInput {
  cwd?: string
}

export function runCwdChangedHook(fallbackCwd: string = process.cwd(), io?: HookIo): Promise<void> {
  return runHook<HookInput>(
    {
      event: 'CwdChanged',
      projectPath: fallbackCwd,
      build: async (input, fallback) => {
        const cwd = input.cwd || fallback
        return buildSessionContext(cwd)
      },
    },
    io
  )
}
