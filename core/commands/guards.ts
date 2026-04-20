/**
 * Small pure-function guards for commands.
 *
 * The v2 primitives all need the same two checks: "is this a prjct project
 * at all?" and "is there an active task?". Before this module those lived
 * inline in every verb, each with its own slightly different error copy.
 * Now everyone shares the exact same branches.
 */

import configManager from '../infrastructure/config-manager'
import type { CurrentTask } from '../schemas/state'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import out from '../utils/output'

type Guard<T> = { ok: true; value: T } | { ok: false; result: CommandResult }

/**
 * Resolve the projectId for the current repo or fail with a user-facing
 * error. Wraps the three-line boilerplate that every v2 primitive needed.
 */
export async function requireProjectId(projectPath: string): Promise<Guard<string>> {
  const projectId = await configManager.getProjectId(projectPath)
  if (!projectId) {
    out.failWithHint('NO_PROJECT_ID')
    return { ok: false, result: { success: false, error: 'No project ID found' } }
  }
  return { ok: true, value: projectId }
}

/**
 * Resolve the active task or fail with a uniform message. Accepts an
 * already-resolved projectId so we don't ping the config twice in verbs
 * that also need the id.
 */
export async function requireActiveTask(
  projectId: string,
  options: { md?: boolean } = {}
): Promise<Guard<CurrentTask>> {
  const active = await stateStorage.getCurrentTask(projectId)
  if (!active) {
    const msg = 'No active task — start one with `prjct task "<desc>"`'
    if (options.md) console.log(`> ${msg}`)
    else out.warn('no active task')
    return { ok: false, result: { success: false, error: msg } }
  }
  return { ok: true, value: active }
}
