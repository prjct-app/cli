/**
 * Surface attribution for the PUSH paths.
 *
 * The pull path (`prjct context memory` / `prjct_mem_list`) records which
 * entries were surfaced during the active task, so a successful ship
 * credits them (+SHIP_WEIGHT). The push paths — the pre-edit guard hook,
 * the per-prompt trap cue, `prjct guard` — surfaced knowledge at the
 * exact moment it prevented a bug and earned NOTHING: an effective gotcha
 * decayed in ranking precisely because the push delivery worked. This
 * helper closes that asymmetry — resolve the active task (per-worktree)
 * and log the surfaced ids. Fire-and-forget, never throws.
 */

import { usefulnessService } from './index'

export async function recordSurfacedForActiveTask(
  projectId: string,
  projectPath: string,
  memoryIds: string[]
): Promise<void> {
  if (memoryIds.length === 0) return
  try {
    const { resolveActiveTask } = await import('../task-service')
    const task = await resolveActiveTask(projectId, projectPath)
    if (task?.id) usefulnessService.recordSurfaced(projectId, memoryIds, task.id)
    // Push-path (guard/prompt trap): delivering a gotcha at edit time is
    // already proof of use — credit usefulness now, not only on ship.
    for (const id of memoryIds) usefulnessService.recordFetch(projectId, id)
  } catch {
    /* best-effort — attribution must never break a hook or a guard */
  }
}
