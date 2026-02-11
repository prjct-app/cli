/**
 * Cleanup Commands
 *
 * Memory and project file cleanup operations.
 * Storage: SQLite events table
 */

import { memoryService } from '../services'
import { ideasStorage, queueStorage } from '../storage'
import prjctDb from '../storage/database'
import type { CleanupOptions, CommandResult } from '../types'
import { getErrorMessage } from '../types/fs'
import { configManager, dateHelper, out } from './base'

/**
 * Memory cleanup helper - prunes old memory events
 */
export async function cleanupMemory(projectPath: string): Promise<{
  success: boolean
  results: { rotated: string[]; totalSize: number; freedSpace: number }
}> {
  const projectId = await configManager.getProjectId(projectPath)

  const results = { rotated: [] as string[], totalSize: 0, freedSpace: 0 }

  if (!projectId) return { success: true, results }

  // Count memory events and prune if over threshold
  const countRow = prjctDb.get<{ cnt: number }>(
    projectId,
    "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.%'"
  )
  const total = countRow?.cnt ?? 0

  if (total > 500) {
    // Keep last 500, delete the rest
    const toDelete = total - 500
    prjctDb.run(
      projectId,
      "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE type LIKE 'memory.%' ORDER BY id ASC LIMIT ?)",
      toDelete
    )
    results.rotated.push('memory-events')
    results.freedSpace = toDelete
  }

  return { success: true, results }
}

/**
 * Internal cleanup helper for memory during normal cleanup
 */
export async function cleanupMemoryInternal(projectPath: string): Promise<void> {
  const projectId = await configManager.getProjectId(projectPath)
  if (!projectId) return

  // Prune old memory events beyond 500
  const countRow = prjctDb.get<{ cnt: number }>(
    projectId,
    "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.%'"
  )
  const total = countRow?.cnt ?? 0

  if (total > 500) {
    const toDelete = total - 500
    prjctDb.run(
      projectId,
      "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE type LIKE 'memory.%' ORDER BY id ASC LIMIT ?)",
      toDelete
    )
  }
}

/**
 * /p:cleanup - Clean temp files and old entries
 */
export async function cleanup(
  options: CleanupOptions = {},
  projectPath: string = process.cwd()
): Promise<CommandResult> {
  try {
    const isMemoryMode = options.memory === true || options.type === 'memory'

    if (isMemoryMode) {
      out.spin('cleaning memory...')
      const result = await cleanupMemory(projectPath)
      out.done('memory cleaned')
      return result
    }

    out.spin('cleaning up...')

    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      out.failWithHint('NO_PROJECT_ID')
      return { success: false, error: 'No project ID found' }
    }

    const cleaned: string[] = []

    // Clean memory (keep last 100 entries)
    const countRow = prjctDb.get<{ cnt: number }>(
      projectId,
      "SELECT COUNT(*) as cnt FROM events WHERE type LIKE 'memory.%'"
    )
    const total = countRow?.cnt ?? 0

    if (total > 100) {
      const toDelete = total - 100
      prjctDb.run(
        projectId,
        "DELETE FROM events WHERE id IN (SELECT id FROM events WHERE type LIKE 'memory.%' ORDER BY id ASC LIMIT ?)",
        toDelete
      )
      cleaned.push(`Memory: ${toDelete} old entries removed`)
    } else {
      cleaned.push('Memory: No cleanup needed')
    }

    // Clean ideas using ideasStorage
    try {
      const result = await ideasStorage.cleanup(projectId)
      if (result.removed > 0) {
        cleaned.push(`Ideas: ${result.removed} old archived ideas removed`)
      } else {
        cleaned.push('Ideas: No cleanup needed')
      }
    } catch (error) {
      cleaned.push(`Ideas: Error - ${getErrorMessage(error)}`)
    }

    // Check queue for completed tasks using queueStorage
    try {
      const tasks = await queueStorage.getActiveTasks(projectId)
      const completedTasks = tasks.filter((t) => t.completed).length

      if (completedTasks > 0) {
        cleaned.push(
          `Queue: ${completedTasks} completed tasks found (not removed - use /p:done to clear)`
        )
      } else {
        cleaned.push('Queue: No completed tasks')
      }
    } catch (error) {
      cleaned.push(`Queue: Error - ${getErrorMessage(error)}`)
    }

    await cleanupMemoryInternal(projectPath)

    await memoryService.log(projectPath, 'cleanup_performed', {
      items: cleaned.length,
      timestamp: dateHelper.getTimestamp(),
    })

    out.done(`${cleaned.length} items cleaned`)
    return { success: true, cleaned }
  } catch (error) {
    out.fail(getErrorMessage(error))
    return { success: false, error: getErrorMessage(error) }
  }
}
