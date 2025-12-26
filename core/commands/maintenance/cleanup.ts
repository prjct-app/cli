/**
 * Cleanup Commands
 *
 * Memory and project file cleanup operations.
 */

import path from 'path'

import type { CommandResult, CleanupOptions } from '../types'
import {
  pathManager,
  configManager,
  jsonlHelper,
  dateHelper,
  out
} from '../base'
import { ideasStorage, queueStorage } from '../../storage'
import { memoryService } from '../../services'

/**
 * Memory cleanup helper
 */
export async function cleanupMemory(projectPath: string): Promise<{
  success: boolean
  results: { rotated: string[]; totalSize: number; freedSpace: number }
}> {
  const projectId = await configManager.getProjectId(projectPath)

  const results = { rotated: [] as string[], totalSize: 0, freedSpace: 0 }
  const jsonlFiles = [
    pathManager.getFilePath(projectId!, 'memory', 'context.jsonl'),
    pathManager.getFilePath(projectId!, 'progress', 'shipped.md'),
    pathManager.getFilePath(projectId!, 'planning', 'ideas.md'),
  ]

  for (const filePath of jsonlFiles) {
    try {
      const sizeMB = await jsonlHelper.getFileSizeMB(filePath)
      if (sizeMB > 0) {
        results.totalSize += sizeMB
        const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(filePath, 10)
        if (rotated) {
          results.rotated.push(path.basename(filePath))
          results.freedSpace += sizeMB
        }
      }
    } catch {
      // skip
    }
  }

  return { success: true, results }
}

/**
 * Internal cleanup helper for memory during normal cleanup
 */
export async function cleanupMemoryInternal(projectPath: string): Promise<void> {
  const projectId = await configManager.getProjectId(projectPath)
  const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')
  await jsonlHelper.rotateJsonLinesIfNeeded(memoryPath, 10)
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
      out.fail('no project ID')
      return { success: false, error: 'No project ID found' }
    }

    const cleaned: string[] = []

    // Clean memory (keep last 100 entries)
    const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
    try {
      const entries = await jsonlHelper.readJsonLines(memoryPath)

      if (entries.length > 100) {
        const kept = entries.slice(-100)
        await jsonlHelper.writeJsonLines(memoryPath, kept)
        cleaned.push(`Memory: ${entries.length - 100} old entries removed`)
      } else {
        cleaned.push('Memory: No cleanup needed')
      }
    } catch {
      cleaned.push('Memory: No file found')
    }

    // Clean ideas using ideasStorage
    try {
      const result = await ideasStorage.cleanup(projectId)
      if (result.removed > 0) {
        cleaned.push(`Ideas: ${result.removed} old archived ideas removed`)
      } else {
        cleaned.push('Ideas: No cleanup needed')
      }
    } catch {
      cleaned.push('Ideas: No file found')
    }

    // Check queue for completed tasks using queueStorage
    try {
      const tasks = await queueStorage.getActiveTasks(projectId)
      const completedTasks = tasks.filter(t => t.completed).length

      if (completedTasks > 0) {
        cleaned.push(
          `Queue: ${completedTasks} completed tasks found (not removed - use /p:done to clear)`
        )
      } else {
        cleaned.push('Queue: No completed tasks')
      }
    } catch {
      cleaned.push('Queue: No file found')
    }

    await cleanupMemoryInternal(projectPath)

    await memoryService.log(projectPath, 'cleanup_performed', {
      items: cleaned.length,
      timestamp: dateHelper.getTimestamp(),
    })

    out.done(`${cleaned.length} items cleaned`)
    return { success: true, cleaned }
  } catch (error) {
    out.fail((error as Error).message)
    return { success: false, error: (error as Error).message }
  }
}
