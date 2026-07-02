/**
 * SubagentStart hook — inject a compact project digest into spawned
 * subagents. Without this, subagents start with zero project context
 * and re-investigate facts the main session already knows.
 *
 * Uses `buildSubagentDigest` (role + this worktree's active work cycle + top
 * traps) rather than the full session context: SubagentStart emits via
 * `systemMessage` (its schema rejects `additionalContext`), which sits
 * outside the cached prompt prefix, so variable content is safe here.
 * Same rules: describe WHAT, never HOW.
 */

import configManager from '../infrastructure/config-manager'
import { prjctDb } from '../storage/database'
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
      afterEmit: async (_input, p) => {
        // Fan-out telemetry: one event per spawn, attributed to the active
        // cycle, so `prjct performance` can show how many subagents a cycle
        // cost (was the crew worth it?). Best-effort, silent.
        try {
          const config = await configManager.readConfig(p)
          if (!config?.projectId) return
          const { collectActiveTasks } = await import('../services/task-overview')
          const overview = await collectActiveTasks(config.projectId, p)
          prjctDb.appendEvent(config.projectId, 'subagent.spawned', {
            taskId: overview.current?.id ?? null,
          })
        } catch {
          /* telemetry only */
        }
      },
    },
    io
  )
}
