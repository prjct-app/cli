/**
 * Task Stack
 * Manages task breakdown and hierarchical task tracking.
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { TaskStackEntry, TaskStackSummary, TaskSwitchResult } from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import log from '../utils/logger'

const execAsync = promisify(exec)

/**
 * Format duration in human-readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return `${seconds}s`
  }
}

// =============================================================================
// Storage
// =============================================================================

/**
 * Ensure stack file exists
 */
export async function ensureStackFile(stackPath: string): Promise<void> {
  try {
    await fs.access(stackPath)
  } catch (error) {
    if (isNotFoundError(error)) {
      // Create empty file
      await fs.writeFile(stackPath, '')
    } else {
      throw error
    }
  }
}

/**
 * Append entry to stack
 */
export async function appendToStack(stackPath: string, entry: TaskStackEntry): Promise<void> {
  await ensureStackFile(stackPath)
  const line = `${JSON.stringify(entry)}\n`
  await fs.appendFile(stackPath, line)
}

/**
 * Read all stack entries
 */
export async function readStack(stackPath: string): Promise<TaskStackEntry[]> {
  await ensureStackFile(stackPath)
  const content = await fs.readFile(stackPath, 'utf8')

  if (!content.trim()) {
    return []
  }

  const entries: TaskStackEntry[] = []
  const lines = content.split('\n').filter((line) => line.trim())

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch (error) {
      log.error('Error parsing stack line:', getErrorMessage(error))
    }
  }

  return entries
}

/**
 * Write full stack to file
 */
export async function writeStack(stackPath: string, stack: TaskStackEntry[]): Promise<void> {
  const content = `${stack.map((task) => JSON.stringify(task)).join('\n')}\n`
  await fs.writeFile(stackPath, content)
}

/**
 * Generate now.md content for a task
 */
export function generateNowContent(
  task: TaskStackEntry | null,
  customContent: string | null,
  formatDurationFn: (ms: number) => string
): string {
  if (customContent !== undefined && customContent !== null) {
    return customContent
  }

  if (!task) {
    return `# Current Task

**No active task**

Use \`/p:work\` or \`/p:resume\` to start working.

---

_Track your focus with \`/p:work [task]\`_
`
  }

  const started = new Date(task.started)
  const now = new Date()
  const elapsed = formatDurationFn(now.getTime() - started.getTime() - (task.pausedDuration || 0))

  return `---
task: "${task.task}"
started: ${task.started}
agent: ${task.agent}
complexity: ${task.complexity}
dev: ${task.dev}
---

# Current Task

**${task.task}**

- Started: ${started.toLocaleTimeString()} (${elapsed} ago)
- Agent: ${task.agent}
- Complexity: ${task.complexity}

---

When done: \`/p:done\`
Need to pause: \`/p:pause\`
`
}

/**
 * Update now.md file
 */
export async function updateNowFile(
  nowPath: string,
  task: TaskStackEntry | null,
  customContent: string | null,
  formatDurationFn: (ms: number) => string
): Promise<void> {
  const content = generateNowContent(task, customContent, formatDurationFn)
  await fs.writeFile(nowPath, content)
}

// =============================================================================
// Task Stack Class
// =============================================================================

export class TaskStack {
  projectPath: string
  stackPath: string
  nowPath: string

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.stackPath = path.join(projectPath, 'core', 'stack.jsonl')
    this.nowPath = path.join(projectPath, 'core', 'now.md')
  }

  /**
   * Get active task
   */
  async getActiveTask(): Promise<TaskStackEntry | null> {
    const stack = await readStack(this.stackPath)
    return stack.find((task) => task.status === 'active') || null
  }

  /**
   * Get paused tasks
   */
  async getPausedTasks(): Promise<TaskStackEntry[]> {
    const stack = await readStack(this.stackPath)
    return stack
      .filter((task) => task.status === 'paused')
      .sort((a, b) => new Date(b.paused!).getTime() - new Date(a.paused!).getTime())
  }

  /**
   * Get all incomplete tasks
   */
  async getIncompleteTasks(): Promise<TaskStackEntry[]> {
    const stack = await readStack(this.stackPath)
    return stack.filter((task) => task.status !== 'completed')
  }

  /**
   * Start a new task
   */
  async startTask(
    description: string,
    agent: string = 'general',
    complexity: string = 'moderate'
  ): Promise<TaskStackEntry> {
    // Check if there's already an active task
    const active = await this.getActiveTask()
    if (active) {
      throw new Error(`Already working on: ${active.task}. Use /p:pause to pause it first.`)
    }

    const entry: TaskStackEntry = {
      id: `task-${Date.now()}`,
      task: description,
      agent,
      status: 'active',
      started: new Date().toISOString(),
      paused: null,
      resumed: null,
      completed: null,
      duration: null,
      complexity,
      dev: await this.getCurrentDev(),
    }

    await appendToStack(this.stackPath, entry)
    await updateNowFile(this.nowPath, entry, null, formatDuration)

    return entry
  }

  /**
   * Pause the active task
   */
  async pauseTask(reason: string = ''): Promise<TaskStackEntry> {
    const active = await this.getActiveTask()
    if (!active) {
      throw new Error('No active task to pause')
    }

    // Update the task
    active.status = 'paused'
    active.paused = new Date().toISOString()
    if (reason) {
      active.pauseReason = reason
    }

    // Rewrite stack with updated task
    await this.updateTask(active)

    // Update now.md to show paused state
    await updateNowFile(this.nowPath, null, `Paused: ${active.task}`, formatDuration)

    return active
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string | null = null): Promise<TaskStackEntry> {
    // Check if there's an active task
    const active = await this.getActiveTask()
    if (active) {
      throw new Error(`Already working on: ${active.task}. Complete or pause it first.`)
    }

    const paused = await this.getPausedTasks()
    if (paused.length === 0) {
      throw new Error('No paused tasks to resume')
    }

    let taskToResume: TaskStackEntry | undefined
    if (taskId) {
      taskToResume = paused.find((t) => t.id === taskId)
      if (!taskToResume) {
        throw new Error(`Task ${taskId} not found or not paused`)
      }
    } else {
      // Resume most recently paused
      taskToResume = paused[0]
    }

    // Update the task
    taskToResume.status = 'active'
    taskToResume.resumed = new Date().toISOString()

    // Calculate paused duration
    if (taskToResume.paused) {
      const pausedMs = Date.now() - new Date(taskToResume.paused).getTime()
      taskToResume.pausedDuration = (taskToResume.pausedDuration || 0) + pausedMs
    }

    // Rewrite stack with updated task
    await this.updateTask(taskToResume)

    // Update now.md
    await updateNowFile(this.nowPath, taskToResume, null, formatDuration)

    return taskToResume
  }

  /**
   * Complete the active task
   */
  async completeTask(): Promise<TaskStackEntry> {
    const active = await this.getActiveTask()
    if (!active) {
      throw new Error('No active task to complete')
    }

    // Update the task
    active.status = 'completed'
    active.completed = new Date().toISOString()

    // Calculate duration (excluding paused time)
    const totalMs = Date.now() - new Date(active.started).getTime()
    const pausedMs = active.pausedDuration || 0
    active.duration = totalMs - pausedMs
    active.durationFormatted = formatDuration(active.duration)

    // Rewrite stack with updated task
    await this.updateTask(active)

    // Clear now.md
    await updateNowFile(this.nowPath, null, '', formatDuration)

    return active
  }

  /**
   * Switch tasks (atomic pause + resume/start)
   */
  async switchTask(targetTaskOrDescription: string): Promise<TaskSwitchResult> {
    const active = await this.getActiveTask()
    let pausedTask: TaskStackEntry | null = null

    // Pause current if exists
    if (active) {
      pausedTask = await this.pauseTask('Switched to another task')
    }

    try {
      // Check if target is a task ID or description
      const paused = await this.getPausedTasks()
      const existingTask = paused.find((t) => t.id === targetTaskOrDescription)

      if (existingTask) {
        // Resume existing task
        return {
          paused: pausedTask,
          resumed: await this.resumeTask(targetTaskOrDescription),
          type: 'resumed',
        }
      } else {
        // Start new task
        return {
          paused: pausedTask,
          started: await this.startTask(targetTaskOrDescription),
          type: 'started',
        }
      }
    } catch (error) {
      // If switch fails, resume the original task
      if (pausedTask) {
        await this.resumeTask(pausedTask.id)
      }
      throw error
    }
  }

  /**
   * Update a task in the stack
   */
  async updateTask(updatedTask: TaskStackEntry): Promise<void> {
    const stack = await readStack(this.stackPath)
    const index = stack.findIndex((t) => t.id === updatedTask.id)

    if (index === -1) {
      throw new Error(`Task ${updatedTask.id} not found`)
    }

    stack[index] = updatedTask
    await writeStack(this.stackPath, stack)
  }

  /**
   * Update now.md to reflect current state
   */
  async updateNowFile(
    task: TaskStackEntry | null,
    customContent: string | null = null
  ): Promise<void> {
    await updateNowFile(this.nowPath, task, customContent, formatDuration)
  }

  /**
   * Get current developer from git or system
   */
  async getCurrentDev(): Promise<string> {
    try {
      const { stdout } = await execAsync('git config user.name')
      return stdout.trim()
    } catch (_error) {
      // Git not available or not configured - return unknown (expected)
      return 'unknown'
    }
  }

  /**
   * Get stack summary for display
   */
  async getStackSummary(): Promise<TaskStackSummary> {
    const active = await this.getActiveTask()
    const paused = await this.getPausedTasks()
    const stack = await readStack(this.stackPath)
    const completed = stack.filter((t) => t.status === 'completed')

    return {
      active,
      paused,
      pausedCount: paused.length,
      completed,
      completedCount: completed.length,
      totalTasks: stack.length,
    }
  }
}

// =============================================================================
// Exports
// =============================================================================

export default TaskStack
