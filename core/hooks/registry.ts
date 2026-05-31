/**
 * Hook runner registry — the single source of truth mapping a Claude Code
 * hook subcommand name to its runner.
 *
 * Both entry paths consume this:
 *   - the cold path (`bin/prjct.ts` → `prjct hook <name>`), and
 *   - the warm path (the daemon, which runs the same runner with a
 *     `HookIo` bridge so the hook body never touches process stdin/stdout).
 *
 * Keeping the mapping here (instead of a switch duplicated in both places)
 * means adding a hook is a one-line change that both paths pick up — the
 * same drift-killer applied to spec routing in `core/commands/route-spec.ts`.
 */

import type { HookIo } from './_runner'
import { runCwdChangedHook } from './cwd-changed'
import { runPostEditHook } from './post-edit'
import { runPreCommitHook } from './pre-commit'
import { runPromptHook } from './prompt'
import { runSessionStartHook } from './session-start'
import { runStopHook } from './stop'
import { runSubagentStartHook } from './subagent-start'

/** A hook runner: runs the hook for `projectPath`. With `io` it runs in
 *  daemon (warm) mode; without, in process (cold) mode. */
export type HookRunner = (projectPath: string, io?: HookIo) => Promise<void>

export const HOOK_RUNNERS: Record<string, HookRunner> = {
  'session-start': runSessionStartHook,
  prompt: runPromptHook,
  'pre-commit': runPreCommitHook,
  'post-edit': runPostEditHook,
  stop: runStopHook,
  'subagent-start': runSubagentStartHook,
  'cwd-changed': runCwdChangedHook,
}

export function getHookRunner(name: string | undefined): HookRunner | undefined {
  return name ? HOOK_RUNNERS[name] : undefined
}
