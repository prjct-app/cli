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
import {
  type FibonacciPoint,
  isValidPoint,
  pointsToMinutes,
  pointsToTimeRange,
} from '../domain/fibonacci'
import { linearService } from '../integrations/linear'
import { generateUUID } from '../schemas'
import type { TaskFeedback } from '../schemas/state'
import { queueStorage, stateStorage } from '../storage'
import type { CommandResult } from '../types'
import { getErrorMessage } from '../types/fs'
import {
  mdDone,
  mdJoin,
  mdList,
  mdNextSteps,
  mdRules,
  mdSection,
  mdStats,
  mdSubtasks,
  mdTaskHeader,
  mdWarn,
} from '../utils/md-formatter'
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
import outcomeRecorder from '../workflows/outcome-recorder'
import { configManager, dateHelper, out, PrjctCommandsBase } from './base'

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * /p:now - Set or show current task
   */
  async now(
    task: string | null = null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.md) {
          console.log('> No project ID found. Run `prjct init` first.')
        } else {
          out.failWithHint('NO_PROJECT_ID')
        }
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
          if (!options.md) out.fail(result.error || 'Failed to execute task')
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

        if (options.md) {
          // Markdown output for LLM consumption
          const subtaskList =
            (result as { subtasks?: Array<{ description: string; status: string }> }).subtasks || []
          const header = mdTaskHeader({
            description: taskDescription,
            branch: (result as { branch?: string }).branch,
            linearId,
            type: (result as { type?: string }).type,
          })
          const subtasksMd = subtaskList.length > 0 ? mdSubtasks(subtaskList, 0) : ''
          const rules = mdRules([
            'All commits must include footer: `Generated with [p/](https://www.prjct.app/)`',
            'Never commit directly to main/master',
          ])
          const next = mdNextSteps([
            { label: 'Find relevant files', command: `prjct context files "${task}"` },
            { label: 'Complete subtask', command: 'prjct done --md' },
            { label: 'Pause task', command: 'prjct pause --md' },
          ])
          console.log(mdJoin(header, subtasksMd, rules, next))
        } else {
          out.done(`${task}`, {
            agents: agentCount > 0 ? agentCount : undefined,
          })
          showStateInfo('working')
          showNextSteps('task')
        }

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
          // Fibonacci estimation helpers for templates
          fibonacci: {
            isValidPoint,
            pointsToMinutes,
            pointsToTimeRange,
            storeEstimate: async (points: FibonacciPoint) => {
              const minutes = pointsToMinutes(points)
              await stateStorage.updateCurrentTask(projectId, {
                estimatedPoints: points,
                estimatedMinutes: minutes.typical,
              })
              return minutes
            },
          },
        }
      } else {
        // Read from storage (JSON is source of truth)
        const currentTask = await stateStorage.getCurrentTask(projectId)

        if (!currentTask) {
          if (options.md) {
            console.log(mdWarn('No active task'))
          } else {
            out.warn('no active task')
          }
          return { success: true, message: 'No active task' }
        }

        if (options.md) {
          // Markdown output for current task status
          const duration = currentTask.startedAt
            ? dateHelper.calculateDuration(new Date(currentTask.startedAt))
            : undefined
          const header = mdTaskHeader({
            description: currentTask.description,
            status: 'active',
            branch: (currentTask as { branch?: string }).branch,
            linearId: (currentTask as { linearId?: string }).linearId,
            type: (currentTask as { type?: string }).type,
            duration,
          })
          const subtasks =
            (currentTask as { subtasks?: Array<{ description: string; status: string }> })
              .subtasks || []
          const currentIndex = (currentTask as { currentSubtaskIndex?: number }).currentSubtaskIndex
          const subtasksMd = subtasks.length > 0 ? mdSubtasks(subtasks, currentIndex) : ''
          const next = mdNextSteps([
            { label: 'Complete subtask', command: 'prjct done --md' },
            { label: 'Pause task', command: 'prjct pause --md' },
          ])
          console.log(mdJoin(header, subtasksMd, next))
        } else {
          out.done(`working on: ${currentTask.description}`)
        }
        return { success: true, task: currentTask.description, currentTask }
      }
    } catch (error) {
      if (options.md) {
        console.log(`> Error: ${getErrorMessage(error)}`)
      } else {
        out.fail(getErrorMessage(error))
      }
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:done - Complete current task
   * Optionally accepts structured feedback for the task-to-analysis feedback loop (PRJ-272)
   */
  async done(
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; feedback?: TaskFeedback; md?: boolean } = {}
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
      let actualMinutes = 0
      if (currentTask.startedAt) {
        const started = new Date(currentTask.startedAt)
        duration = dateHelper.calculateDuration(started)
        actualMinutes = Math.round((Date.now() - started.getTime()) / 60_000)
      }

      // Record outcome with estimation data if available
      const estimatedMinutes = (currentTask as { estimatedMinutes?: number }).estimatedMinutes
      const estimatedPoints = (currentTask as { estimatedPoints?: number }).estimatedPoints
      try {
        await outcomeRecorder.record(projectId, {
          sessionId: currentTask.sessionId,
          command: 'done',
          task,
          startedAt: currentTask.startedAt,
          completedAt: dateHelper.getTimestamp(),
          estimatedDuration: estimatedMinutes ? formatMinutesToDuration(estimatedMinutes) : '0m',
          actualDuration: duration || '0m',
          variance: estimatedMinutes ? formatVariance(actualMinutes - estimatedMinutes) : '+0m',
          completedAsPlanned: true,
          qualityScore: 3,
          tags: [(currentTask as { linearId?: string }).linearId].filter(Boolean) as string[],
        })
      } catch {
        // Outcome recording failure should not block workflow
      }

      // Build variance display
      let varianceDisplay = ''
      if (estimatedPoints && estimatedMinutes) {
        const diff = actualMinutes - estimatedMinutes
        const pct =
          estimatedMinutes > 0
            ? Math.round(((actualMinutes - estimatedMinutes) / estimatedMinutes) * 100)
            : 0
        const sign = diff >= 0 ? '+' : ''
        varianceDisplay = ` | est: ${estimatedPoints}pt (${formatMinutesToDuration(estimatedMinutes)}) → ${sign}${pct}%`
      }

      // Write-through: Complete task (JSON → MD → Event)
      // Pass feedback for the task-to-analysis feedback loop (PRJ-272)
      await stateStorage.completeTask(projectId, options.feedback)

      // Sync to Linear if task has linearId
      const linearId = (currentTask as { linearId?: string }).linearId
      if (linearId) {
        try {
          const creds = await getProjectCredentials(projectId)
          const apiKey = await getLinearApiKey(projectId)
          if (apiKey && creds.linear?.teamId) {
            await linearService.initializeFromApiKey(apiKey, creds.linear.teamId)
            await linearService.markDone(linearId)
          }
        } catch {
          // Linear sync failed silently - don't block the workflow
        }
      }

      if (options.md) {
        const durationSuffix = duration ? ` (${duration})` : ''
        console.log(
          mdJoin(
            mdDone('Subtask Complete', `**Completed:** ${task}${durationSuffix}`),
            mdStats({
              Duration: duration || 'unknown',
              ...(varianceDisplay ? { Variance: varianceDisplay.replace(' | ', '') } : {}),
            }),
            mdNextSteps([
              { label: 'Complete next subtask', command: 'p. done' },
              { label: 'Ship when ready', command: 'p. ship' },
            ])
          )
        )
      } else {
        const displaySuffix = duration ? ` (${duration}${varianceDisplay})` : ''
        if (linearId) {
          out.done(`${task}${displaySuffix} → Linear ✓`)
        } else {
          out.done(`${task}${displaySuffix}`)
        }
        showStateInfo('completed')
        showNextSteps('done')
      }

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        estimatedPoints,
        estimatedMinutes,
        actualMinutes,
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
  async next(
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
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
        if (options.md) {
          console.log(mdWarn('Queue is empty'))
        } else {
          out.warn('queue empty')
        }
        return { success: true, message: 'Queue is empty' }
      }

      if (options.md) {
        const items = tasks.map((t) => {
          const typeBadge = t.type ? ` [${t.type}]` : ''
          const priority = t.priority ? ` ${t.priority}` : ''
          return `${t.description}${typeBadge}${priority}`
        })
        console.log(
          mdJoin(
            mdSection('Queue', `${tasks.length} task${tasks.length !== 1 ? 's' : ''}`),
            mdList(items, true),
            mdNextSteps([{ label: 'Start working', command: `p. task "${tasks[0].description}"` }])
          )
        )
      } else {
        out.done(`${tasks.length} task${tasks.length !== 1 ? 's' : ''} queued`)
        showNextSteps('next')
      }

      return { success: true, tasks, count: tasks.length }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:pause - Pause active task to handle interruption
   */
  async pause(
    reason: string = '',
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
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
        if (options.md) {
          console.log(mdWarn('No active task to pause'))
        } else {
          out.warn('no active task to pause')
        }
        return { success: false, message: 'No active task to pause' }
      }

      // Calculate duration worked before pausing
      let durationWorked = ''
      if (currentTask.startedAt) {
        durationWorked = dateHelper.calculateDuration(new Date(currentTask.startedAt))
      }

      // Write-through: Pause task (JSON → MD → Event)
      await stateStorage.pauseTask(projectId, reason)

      if (options.md) {
        console.log(
          mdJoin(
            mdDone('Task Paused', `**Paused:** ${currentTask.description}`),
            mdStats({
              Reason: reason || undefined,
              'Duration worked': durationWorked || undefined,
            }),
            mdNextSteps([
              { label: 'Resume this task', command: 'p. resume' },
              { label: 'Start something new', command: 'p. task' },
            ])
          )
        )
      } else {
        const taskDesc = currentTask.description.slice(0, 40)
        out.done(`paused: ${taskDesc}${reason ? ` (${reason})` : ''}`)
        showStateInfo('paused')
        showNextSteps('pause')
      }

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
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
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
        if (options.md) {
          console.log(mdWarn(`Already working on: ${currentTask.description}`))
        } else {
          out.warn('already working on a task')
        }
        return { success: false, message: `Already working on: ${currentTask.description}` }
      }

      // Write-through: Resume task (JSON → MD → Event)
      const resumed = await stateStorage.resumeTask(projectId)

      if (!resumed) {
        if (options.md) {
          console.log(mdWarn('No paused task found'))
        } else {
          out.warn('no paused task to resume')
        }
        return { success: false, message: 'No paused task found' }
      }

      if (options.md) {
        console.log(
          mdJoin(
            mdDone('Task Resumed', `**Resumed:** ${resumed.description}`),
            mdNextSteps([{ label: 'Continue working, then finish', command: 'p. done' }])
          )
        )
      } else {
        out.done(`resumed: ${resumed.description.slice(0, 40)}`)
        showStateInfo('working')
        showNextSteps('resume')
      }

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

// =============================================================================
// Helpers
// =============================================================================

/** Format minutes to a human-readable duration string */
function formatMinutesToDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Format a variance in minutes to a string like "+30m" or "-15m" */
function formatVariance(diffMinutes: number): string {
  const sign = diffMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(diffMinutes)
  if (abs >= 60) {
    const hours = Math.floor(abs / 60)
    const mins = abs % 60
    return mins > 0 ? `${sign}${hours}h ${mins}m` : `${sign}${hours}h`
  }
  return `${sign}${abs}m`
}
