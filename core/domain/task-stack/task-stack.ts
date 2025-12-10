/**
 * Task Stack Manager - Core class
 * Handles multiple concurrent tasks with pause/resume capability
 */

import path from 'path'
import fs from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import type { TaskEntry, MigrationResult, SwitchResult, StackSummary } from './types'
import { parseNowFile, formatDuration } from './parser'
import { ensureStackFile, appendToStack, readStack, writeStack, updateNowFile } from './storage'

const execAsync = promisify(exec)

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
   * Initialize stack system - migrate from legacy now.md if needed
   */
  async initialize(): Promise<MigrationResult> {
    try {
      // Check if stack already exists
      await fs.access(this.stackPath)
      return { migrated: false }
    } catch {
      // Stack doesn't exist, check for legacy now.md
      return await this.migrateFromLegacy()
    }
  }

  /**
   * Migrate from legacy now.md to stack system
   */
  async migrateFromLegacy(): Promise<MigrationResult> {
    try {
      const nowContent = await fs.readFile(this.nowPath, 'utf8')

      if (!nowContent.trim() || nowContent.includes('No active task')) {
        // Empty or no task, just create empty stack
        await ensureStackFile(this.stackPath)
        return { migrated: true, hadTask: false }
      }

      // Parse task from now.md
      const task = parseNowFile(nowContent)

      // Create initial stack entry
      const entry: TaskEntry = {
        id: `task-${Date.now()}`,
        task: task.description || 'Migrated task',
        agent: task.agent || 'unknown',
        status: 'active',
        started: task.started || new Date().toISOString(),
        paused: null,
        resumed: null,
        completed: null,
        duration: null,
        complexity: task.complexity || 'moderate',
        dev: task.dev || 'unknown',
      }

      // Write to stack
      await appendToStack(this.stackPath, entry)

      return { migrated: true, hadTask: true, task: entry }
    } catch (error) {
      // No now.md or error reading, just create empty stack
      await ensureStackFile(this.stackPath)
      return { migrated: true, hadTask: false, error: (error as Error).message }
    }
  }

  // Re-expose parseNowFile for compatibility
  parseNowFile(content: string) {
    return parseNowFile(content)
  }

  // Re-expose formatDuration for compatibility
  formatDuration(ms: number): string {
    return formatDuration(ms)
  }

  /**
   * Get active task
   */
  async getActiveTask(): Promise<TaskEntry | null> {
    const stack = await readStack(this.stackPath)
    return stack.find((task) => task.status === 'active') || null
  }

  /**
   * Get paused tasks
   */
  async getPausedTasks(): Promise<TaskEntry[]> {
    const stack = await readStack(this.stackPath)
    return stack
      .filter((task) => task.status === 'paused')
      .sort((a, b) => new Date(b.paused!).getTime() - new Date(a.paused!).getTime())
  }

  /**
   * Get all incomplete tasks
   */
  async getIncompleteTasks(): Promise<TaskEntry[]> {
    const stack = await readStack(this.stackPath)
    return stack.filter((task) => task.status !== 'completed')
  }

  /**
   * Start a new task
   */
  async startTask(description: string, agent: string = 'general', complexity: string = 'moderate'): Promise<TaskEntry> {
    // Check if there's already an active task
    const active = await this.getActiveTask()
    if (active) {
      throw new Error(`Already working on: ${active.task}. Use /p:pause to pause it first.`)
    }

    const entry: TaskEntry = {
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
  async pauseTask(reason: string = ''): Promise<TaskEntry> {
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
  async resumeTask(taskId: string | null = null): Promise<TaskEntry> {
    // Check if there's an active task
    const active = await this.getActiveTask()
    if (active) {
      throw new Error(`Already working on: ${active.task}. Complete or pause it first.`)
    }

    const paused = await this.getPausedTasks()
    if (paused.length === 0) {
      throw new Error('No paused tasks to resume')
    }

    let taskToResume: TaskEntry | undefined
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
  async completeTask(): Promise<TaskEntry> {
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
  async switchTask(targetTaskOrDescription: string): Promise<SwitchResult> {
    const active = await this.getActiveTask()
    let pausedTask: TaskEntry | null = null

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
  async updateTask(updatedTask: TaskEntry): Promise<void> {
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
  async updateNowFile(task: TaskEntry | null, customContent: string | null = null): Promise<void> {
    await updateNowFile(this.nowPath, task, customContent, formatDuration)
  }

  /**
   * Get current developer from git or system
   */
  async getCurrentDev(): Promise<string> {
    try {
      const { stdout } = await execAsync('git config user.name')
      return stdout.trim()
    } catch {
      return 'unknown'
    }
  }

  /**
   * Get stack summary for display
   */
  async getStackSummary(): Promise<StackSummary> {
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
