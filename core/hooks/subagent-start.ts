/**
 * SubagentStart hook — inject a compact project digest into spawned
 * subagents. Without this, subagents start with zero project context
 * and re-investigate facts the main session already knows.
 *
 * Uses `buildSubagentDigest` (role + this worktree's active task + top
 * traps) rather than the full session context: SubagentStart emits via
 * `systemMessage` (its schema rejects `additionalContext`), which sits
 * outside the cached prompt prefix, so variable content is safe here.
 * Same rules: describe WHAT, never HOW.
 */

import { type HookIo, runHook } from './_runner'
import { buildSubagentDigest } from './session-start'

export function runSubagentStartHook(
  projectPath: string = process.cwd(),
  io?: HookIo
): Promise<void> {
  return runHook(
    {
      event: 'SubagentStart',
      projectPath,
      build: (_input, p) => buildSubagentDigest(p),
    },
    io
  )
}
