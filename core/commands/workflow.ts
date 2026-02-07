/**
 * Workflow Commands: work (now), done, next, pause, resume
 * Core task management - Write-Through Architecture
 *
 * Uses storage layer: JSON (source) → MD (context) → Event (sync)
 *
 * AGENTIC: Uses template-executor for Claude-driven decisions.
 * TypeScript provides infrastructure; Claude decides via templates.
 */

import commandExecutor from '../agentic/command-executor'
import { templateExecutor } from '../agentic/template-executor'
import { linearService } from '../integrations/linear'
import { generateUUID } from '../schemas'
import { queueStorage, stateStorage } from '../storage'
import type { CommandResult } from '../types'
import { getErrorMessage } from '../types/fs'
import { showNextSteps, showStateInfo } from '../utils/next-steps'
import { getLinearApiKey, getProjectCredentials } from '../utils/project-credentials'
import {
  formatWorkflowPreferences,
  type HookCommand,
  type HookPhase,
  listWorkflowPreferences,
  type PreferenceScope,
  removeWorkflowPreference,
  runWorkflowHooks,
  setWorkflowPreference,
} from '../workflow/workflow-preferences'
import { configManager, dateHelper, out, PrjctCommandsBase } from './base'

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * /p:now - Set or show current task
   */
  async now(
    task: string | null = null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      if (task) {
        // Run before_task hooks (using memory-based preferences)
        const beforeResult = await runWorkflowHooks(projectId, 'before', 'task', {
          projectPath,
          skipHooks: options.skipHooks,
        })
        if (!beforeResult.success) {
          return { success: false, error: `Hook failed: ${beforeResult.failed}` }
        }

        // AGENTIC: Use CommandExecutor for full orchestration support
        const result = await commandExecutor.execute('task', { task }, projectPath)

        if (!result.success) {
          out.fail(result.error || 'Failed to execute task')
          return { success: false, error: result.error }
        }

        // Check if task is a Linear issue ID (e.g., PRJ-139)
        let linearId: string | undefined
        let taskDescription = task
        const linearPattern = /^[A-Z]+-\d+$/
        if (linearPattern.test(task)) {
          try {
            const creds = await getProjectCredentials(projectId)
            const apiKey = await getLinearApiKey(projectId)
            if (apiKey && creds.linear?.teamId) {
              await linearService.initializeFromApiKey(apiKey, creds.linear.teamId)
              const issue = await linearService.fetchIssue(task)
              if (issue) {
                linearId = task
                taskDescription = `${task}: ${issue.title}`
                // Mark as in progress in Linear
                await linearService.markInProgress(task)
              }
            }
          } catch {
            // Linear fetch failed - continue with task as-is
          }
        }

        // Write-through: JSON → MD → Event
        await stateStorage.startTask(projectId, {
          id: generateUUID(),
          description: taskDescription,
          sessionId: generateUUID(),
          linearId,
        } as Parameters<typeof stateStorage.startTask>[1])

        // Get available agents for backward compatibility
        const availableAgents = await templateExecutor.getAvailableAgents(projectPath)
        const _agentsList =
          availableAgents.length > 0 ? availableAgents.join(', ') : 'none (run p. sync)'

        // Build metrics from orchestrator context
        const agentCount = result.orchestratorContext?.agents?.length || availableAgents.length
        out.done(`${task}`, {
          agents: agentCount > 0 ? agentCount : undefined,
        })
        showStateInfo('working')
        showNextSteps('task')

        await this.logToMemory(projectPath, 'task_started', {
          task,
          agenticMode: true,
          availableAgents,
          orchestratorContext: result.orchestratorContext,
          timestamp: dateHelper.getTimestamp(),
        })

        // Run after_task hooks
        await runWorkflowHooks(projectId, 'after', 'task', {
          projectPath,
          skipHooks: options.skipHooks,
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
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:done - Complete current task
   */
  async done(
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Read from storage
      const currentTask = await stateStorage.getCurrentTask(projectId)

      if (!currentTask) {
        out.warn('no active task')
        return { success: true, message: 'No active task to complete' }
      }

      // Run before_done hooks (using memory-based preferences)
      const beforeResult = await runWorkflowHooks(projectId, 'before', 'done', {
        projectPath,
        skipHooks: options.skipHooks,
      })
      if (!beforeResult.success) {
        return { success: false, error: `Hook failed: ${beforeResult.failed}` }
      }

      const task = currentTask.description
      let duration = ''
      if (currentTask.startedAt) {
        const started = new Date(currentTask.startedAt)
        duration = dateHelper.calculateDuration(started)
      }

      // Write-through: Complete task (JSON → MD → Event)
      await stateStorage.completeTask(projectId)

      // Sync to Linear if task has linearId
      const linearId = (currentTask as { linearId?: string }).linearId
      if (linearId) {
        try {
          const creds = await getProjectCredentials(projectId)
          const apiKey = await getLinearApiKey(projectId)
          if (apiKey && creds.linear?.teamId) {
            await linearService.initializeFromApiKey(apiKey, creds.linear.teamId)
            await linearService.markDone(linearId)
            out.done(`${task}${duration ? ` (${duration})` : ''} → Linear ✓`)
          } else {
            out.done(`${task}${duration ? ` (${duration})` : ''}`)
          }
        } catch {
          // Linear sync failed silently - don't block the workflow
          out.done(`${task}${duration ? ` (${duration})` : ''}`)
        }
      } else {
        out.done(`${task}${duration ? ` (${duration})` : ''}`)
      }
      showStateInfo('completed')
      showNextSteps('done')

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        timestamp: dateHelper.getTimestamp(),
      })

      // Run after_done hooks
      await runWorkflowHooks(projectId, 'after', 'done', {
        projectPath,
        skipHooks: options.skipHooks,
      })

      return { success: true, task, duration }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
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
        out.failWithHint('NO_PROJECT_ID')
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
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
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
        out.failWithHint('NO_PROJECT_ID')
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
      showStateInfo('paused')
      showNextSteps('pause')

      await this.logToMemory(projectPath, 'task_paused', {
        task: currentTask.description,
        reason,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: currentTask.description, reason }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:resume - Resume most recently paused task
   */
  async resume(
    _taskId: string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
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
      showStateInfo('working')
      showNextSteps('resume')

      await this.logToMemory(projectPath, 'task_resumed', {
        task: resumed.description,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task: resumed.description }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:workflow - View and manage workflow preferences
   *
   * When called without arguments, shows current preferences.
   * With arguments, parses natural language and updates preferences.
   */
  async workflow(
    input: string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      if (!input) {
        // Show current preferences
        const preferences = await listWorkflowPreferences(projectId)
        console.log(formatWorkflowPreferences(preferences))
        return { success: true, preferences }
      }

      // Return info for template-based processing
      // The template/LLM will parse the natural language and call the appropriate functions
      return {
        success: true,
        projectId,
        input,
        // Export functions for template use
        setWorkflowPreference: async (pref: {
          hook: HookPhase
          command: HookCommand
          action: string
          scope: PreferenceScope
        }) => {
          await setWorkflowPreference(projectId, {
            ...pref,
            createdAt: dateHelper.getTimestamp(),
          })
        },
        removeWorkflowPreference: async (hook: HookPhase, command: HookCommand) => {
          await removeWorkflowPreference(projectId, hook, command)
        },
        listWorkflowPreferences: async () => {
          return listWorkflowPreferences(projectId)
        },
      }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }
}
