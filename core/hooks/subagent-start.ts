/**
 * SubagentStart hook — inject persona + recent memory into spawned
 * subagents. Without this, subagents start with zero project context
 * and re-investigate facts the main session already knows.
 *
 * Reuses `buildSessionContext` to keep the per-subagent injection
 * consistent with what the main session sees. Same rules: describe
 * WHAT (role, MCPs, recent memory), never CÓMO.
 */

import { buildHookOutput, emit, readStdinSafe, safeRun } from './_shared'
import { buildSessionContext } from './session-start'

export async function runSubagentStartHook(projectPath: string = process.cwd()): Promise<void> {
  await safeRun(async () => {
    await readStdinSafe()
    const context = await buildSessionContext(projectPath)
    emit(buildHookOutput('SubagentStart', context))
  })
}
