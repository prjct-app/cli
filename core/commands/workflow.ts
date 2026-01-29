/**
 * Workflow Commands: work (now), done, next, pause, resume
 * Core task management - Write-Through Architecture
 *
 * Uses storage layer: JSON (source) → MD (context) → Event (sync)
 *
 * AGENTIC: Uses template-executor for Claude-driven decisions.
 * TypeScript provides infrastructure; Claude decides via templates.
 */

import type { CommandResult, ProjectContext } from '../types'
import { generateUUID } from '../schemas'
import {
  PrjctCommandsBase,
  contextBuilder,
  configManager,
  dateHelper,
  out
} from './base'
import { stateStorage, queueStorage } from '../storage'
import { templateExecutor } from '../agentic/template-executor'
import commandExecutor from '../agentic/command-executor'
import { showNextSteps } from '../utils/next-steps'

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * /p:now - Set or show current task
   */
  async now(task: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      if (task) {
        // AGENTIC: Use CommandExecutor for full orchestration support
        const result = await commandExecutor.execute('task', { task }, projectPath)

        if (!result.success) {
          out.fail(result.error || 'Failed to execute task')
          return { success: false, error: result.error }
        }

        // Write-through: JSON → MD → Event
        await stateStorage.startTask(projectId, {
          id: generateUUID(),
          description: task,
          sessionId: generateUUID()
        })

        // Get available agents for backward compatibility
        const availableAgents = await templateExecutor.getAvailableAgents(projectPath)
        const agentsList = availableAgents.length > 0
          ? availableAgents.join(', ')
          : 'none (run p. sync)'

        out.done(`${task} [specialists: ${agentsList}]`)
        showNextSteps('task')

        await this.logToMemory(projectPath, 'task_started', {
          task,
          agenticMode: true,
          availableAgents,
          orchestratorContext: result.orchestratorContext,
          timestamp: dateHelper.getTimestamp(),
        })

        return {
          // Include full CommandExecutor result first (orchestratorContext, prompt, etc.)
          ...result,
          // Then override with our specific values
          success: true,
          task,
          agenticMode: true,
          availableAgents,
        }
      } else {
        // Read from storage (JSON is source of truth)
        const currentTask = await stateStorage.getCurrentTask(projectId)

        if (!currentTask) {
          out.warn('no active task')
          return { success: true, message: 'No active task' }
        }

        out.done(`working on: ${currentTask.description}`)
        return { success: true, task: currentTask.description, currentTask }
      }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:done - Complete current task
   */
  async done(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      // Read from storage
      const currentTask = await stateStorage.getCurrentTask(projectId)

      if (!currentTask) {
        out.warn('no active task')
        return { success: true, message: 'No active task to complete' }
      }

      const task = currentTask.description
      let duration = ''
      if (currentTask.startedAt) {
        const started = new Date(currentTask.startedAt)
        duration = dateHelper.calculateDuration(started)
      }

      // Write-through: Complete task (JSON → MD → Event)
      await stateStorage.completeTask(projectId)

      out.done(`${task}${duration ? ` (${duration})` : ''}`)
      showNextSteps('done')

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        timestamp: dateHelper.getTimestamp(),
      })
      return { success: true, task, duration }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:next - Show priority queue
   */
  async next(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      // Read queue from storage
      const tasks = await queueStorage.getActiveTasks(projectId)

      if (tasks.length === 0) {
        out.warn('queue empty')
        return { success: true, message: 'Queue is empty' }
      }

      out.done(`${tasks.length} task${tasks.length !== 1 ? 's' : ''} queued`)
      showNextSteps('next')

      return { success: true, tasks, count: tasks.length }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:pause - Pause active task to handle interruption
   */
  async pause(reason: string = '', projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      const currentTask = await stateStorage.getCurrentTask(projectId)

      if (!currentTask) {
        out.warn('no active task to pause')
        return { success: false, message: 'No active task to pause' }
      }

      // Write-through: Pause task (JSON → MD → Event)
      await stateStorage.pauseTask(projectId, reason)

      const taskDesc = currentTask.description.slice(0, 40)
      out.done(`paused: ${taskDesc}${reason ? ` (${reason})` : ''}`)
      showNextSteps('pause')

      await this.logToMemory(projectPath, 'task_paused', {
        task: currentTask.description,
        reason,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: currentTask.description, reason }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:resume - Resume most recently paused task
   */
  async resume(taskId: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      // Check if already working on a task
      const currentTask = await stateStorage.getCurrentTask(projectId)
      if (currentTask) {
        out.warn('already working on a task')
        return { success: false, message: `Already working on: ${currentTask.description}` }
      }

      // Write-through: Resume task (JSON → MD → Event)
      const resumed = await stateStorage.resumeTask(projectId)

      if (!resumed) {
        out.warn('no paused task to resume')
        return { success: false, message: 'No paused task found' }
      }

      out.done(`resumed: ${resumed.description.slice(0, 40)}`)
      showNextSteps('resume')

      await this.logToMemory(projectPath, 'task_resumed', {
        task: resumed.description,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: resumed.description }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
