/**
 * SubagentStart hook — inject persona + recent memory into spawned
 * subagents. Without this, subagents start with zero project context
 * and re-investigate facts the main session already knows.
 *
 * Reuses `buildSessionContext` to keep the per-subagent injection
 * consistent with what the main session sees. Same rules: describe
 * WHAT (role, MCPs, recent memory), never CÓMO.
 */

import { type HookIo, runHook } from './_runner'
import { buildSessionContext } from './session-start'

export function runSubagentStartHook(
  projectPath: string = process.cwd(),
  io?: HookIo
): Promise<void> {
  return runHook(
    {
      event: 'SubagentStart',
      projectPath,
      build: (_input, p) => buildSessionContext(p),
    },
    io
  )
}
