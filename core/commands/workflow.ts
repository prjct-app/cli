/**
 * Workflow Commands: work (now), done, next, pause, resume
 * Core task management - Write-Through Architecture
 *
 * Uses storage layer: JSON (source) → MD (context) → Event (sync)
 *
 * AGENTIC: Uses template-executor for Claude-driven decisions.
 * TypeScript provides infrastructure; Claude decides via templates.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import commandExecutor from '../agentic/command-executor'
import { templateExecutor } from '../agentic/template-executor'
import {
  type FibonacciPoint,
  isValidPoint,
  pointsToMinutes,
  pointsToTimeRange,
} from '../domain/fibonacci'
import pathManager from '../infrastructure/path-manager'
import { linearService } from '../integrations/linear'
import { generateUUID } from '../schemas'
import type { AnalysisSchema } from '../schemas/analysis'
import type { TaskFeedback } from '../schemas/state'
import { sessionSnapshotManager } from '../session/session-snapshot'
import { analysisStorage, queueStorage, stateStorage } from '../storage'
import type { WorkflowRule } from '../storage/workflow-rule-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import { findRelevantFiles } from '../tools/context/files-tool'
import type { CommandResult } from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import {
  mdActionRequired,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdRelevantFiles,
  mdRules,
  mdSection,
  mdStats,
  mdSubtasks,
  mdTaskHeader,
} from '../utils/md-formatter'
import { showNextSteps, showStateInfo } from '../utils/next-steps'
import { getLinearApiKey, getProjectCredentials } from '../utils/project-credentials'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import { listWorkflowPreferences } from '../workflow/workflow-preferences'
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
        // Run before_task rules (gates + hooks)
        const beforeResult = await executeWorkflowRules(projectId, 'task', 'before', {
          projectPath,
          skipRules: options.skipHooks,
        })
        if (!beforeResult.success) {
          const msg =
            beforeResult.gatesFailed.length > 0
              ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
              : `Hook failed: ${beforeResult.hooksFailed.join(', ')}`
          return { success: false, error: msg }
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
                await linearService.markInProgress(task)
              }
            }
          } catch {
            // Linear fetch failed - continue with task as-is
          }
        }

        if (options.md) {
          // --md path: rich context provider, no orchestration
          // Check for active task before starting — friendly message instead of error
          const existingTask = await stateStorage.getCurrentTask(projectId)
          if (existingTask) {
            mdActionRequired(
              'blocked',
              'task_already_active',
              [
                { label: 'Complete current task first', command: 'prjct done --md' },
                { label: 'Pause current and start this one', command: 'prjct pause --md' },
                { label: 'Cancel' },
              ],
              { current_task: existingTask.description, requested_task: taskDescription }
            )
            return { success: true, message: 'Task already active', currentTask: existingTask }
          }

          // Start task immediately — no executor to fail
          await stateStorage.startTask(projectId, {
            id: generateUUID(),
            description: taskDescription,
            sessionId: generateUUID(),
            linearId,
          } as Parameters<typeof stateStorage.startTask>[1])

          // Load project context in parallel (non-blocking, graceful)
          const globalPath = pathManager.getGlobalProjectPath(projectId)
          const [branch, analysis, repoAnalysisRaw, relevantFilesResult] = await Promise.all([
            getGitBranch(),
            analysisStorage.getActive(projectId).catch(() => null),
            loadRepoAnalysis(globalPath),
            findRelevantFiles(taskDescription, projectPath, { maxFiles: 8, minScore: 0.15 }).catch(
              () => ({ files: [], metrics: { filesScanned: 0, filesReturned: 0, scanDuration: 0 } })
            ),
          ])

          // Check for session snapshot (PRJ-285) — inject continuity context
          let continuityContext: string | null = null
          try {
            const snapshot = sessionSnapshotManager.getSnapshot(projectId)
            if (snapshot) {
              continuityContext = sessionSnapshotManager.formatContinuityContext(snapshot)
              sessionSnapshotManager.clearSnapshot(projectId)
            }
          } catch {
            // Non-critical
          }

          // Build sections
          const header = mdTaskHeader({ description: taskDescription, branch, linearId })
          const projectContext = buildProjectContext(analysis, repoAnalysisRaw)
          const files = mdRelevantFiles(
            relevantFilesResult.files.map((f) => ({
              path: f.path,
              description: f.reasons.join(', '),
            }))
          )
          const rules = buildRules(repoAnalysisRaw)
          const patterns = buildPatterns(analysis)
          const next = mdNextSteps([
            { label: 'Find relevant files', command: `prjct context files "${task}"` },
            { label: 'Complete subtask', command: 'prjct done --md' },
            { label: 'Pause task', command: 'prjct pause --md' },
          ])

          console.log(
            mdOutput(continuityContext, header, projectContext, files, rules, patterns, next)
          )

          await this.logToMemory(projectPath, 'task_started', {
            task,
            timestamp: dateHelper.getTimestamp(),
          })

          await executeWorkflowRules(projectId, 'task', 'after', {
            projectPath,
            skipRules: options.skipHooks,
          })

          return { success: true, task, taskDescription }
        }

        // AGENTIC: Use CommandExecutor for full orchestration support (non-md path)
        const result = await commandExecutor.execute('task', { task }, projectPath)

        if (!result.success) {
          out.fail(result.error || 'Failed to execute task')
          return { success: false, error: result.error }
        }

        // Write-through: JSON → MD → Event (only after executor succeeds)
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

        // Run after_task rules
        await executeWorkflowRules(projectId, 'task', 'after', {
          projectPath,
          skipRules: options.skipHooks,
        })

        return {
          ...result,
          success: true,
          task,
          agenticMode: true,
          availableAgents,
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
            mdActionRequired('idle', 'no_active_task', [
              { label: 'Start a task', command: 'prjct task "description" --md' },
              { label: 'Check queue', command: 'prjct next --md' },
            ])
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
          console.log(mdOutput(header, subtasksMd, next))
        } else {
          out.done(`working on: ${currentTask.description}`)
        }
        return { success: true, task: currentTask.description, currentTask }
      }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) {
        if (msg.includes('Cannot run') || msg.includes('working state')) {
          mdActionRequired(
            'blocked',
            'state_conflict',
            [
              { label: 'Complete current task', command: 'prjct done --md' },
              { label: 'Pause current task', command: 'prjct pause --md' },
            ],
            { error: msg.split('.')[0] }
          )
        } else {
          console.log(JSON.stringify({ status: 'error', error: msg }))
        }
      } else {
        out.fail(msg)
      }
      return { success: false, error: msg }
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
        if (options.md) {
          mdActionRequired('idle', 'no_active_task', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
            { label: 'Check queue', command: 'prjct next --md' },
          ])
        } else {
          out.warn('no active task')
        }
        return { success: true, message: 'No active task to complete' }
      }

      // Run before_done rules (gates + hooks)
      const beforeResult = await executeWorkflowRules(projectId, 'done', 'before', {
        projectPath,
        skipRules: options.skipHooks,
      })
      if (!beforeResult.success) {
        const msg =
          beforeResult.gatesFailed.length > 0
            ? `Blocked: ${beforeResult.gatesFailed.join(', ')}`
            : `Hook failed: ${beforeResult.hooksFailed.join(', ')}`
        return { success: false, error: msg }
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

      // Clear session snapshot on completion (PRJ-285)
      try {
        sessionSnapshotManager.clearSnapshot(projectId)
      } catch {
        // Non-critical
      }

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
          mdOutput(
            mdDone('Completed', `${task}${durationSuffix}`),
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

      // Run after_done rules
      await executeWorkflowRules(projectId, 'done', 'after', {
        projectPath,
        skipRules: options.skipHooks,
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
          mdActionRequired('empty', 'queue_empty', [
            { label: 'Add a task', command: 'prjct task "description" --md' },
            { label: 'Add a bug', command: 'prjct bug "description" --md' },
          ])
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
          mdOutput(
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
          mdActionRequired('idle', 'no_active_task', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no active task to pause')
        }
        return { success: true, message: 'No active task to pause' }
      }

      // Calculate duration worked before pausing
      let durationWorked = ''
      if (currentTask.startedAt) {
        durationWorked = dateHelper.calculateDuration(new Date(currentTask.startedAt))
      }

      // Write-through: Pause task (JSON → MD → Event)
      await stateStorage.pauseTask(projectId, reason)

      // Capture session snapshot for continuity (PRJ-285)
      try {
        await sessionSnapshotManager.capture(projectId, projectPath, {
          taskDescription: currentTask.description,
          taskStatus: 'paused',
          sessionId: currentTask.sessionId,
          activeSubtaskIndex: currentTask.currentSubtaskIndex,
          subtaskCount: currentTask.subtasks?.length,
          linearId: (currentTask as { linearId?: string }).linearId,
          startedAt: currentTask.startedAt,
        })
      } catch {
        // Snapshot capture is non-critical
      }

      if (options.md) {
        console.log(
          mdOutput(
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
          mdActionRequired(
            'blocked',
            'task_already_active',
            [
              { label: 'Continue working', command: 'prjct done --md' },
              { label: 'Pause and switch', command: 'prjct pause --md' },
            ],
            { current_task: currentTask.description }
          )
        } else {
          out.warn('already working on a task')
        }
        return { success: true, message: `Already working on: ${currentTask.description}` }
      }

      // Write-through: Resume task (JSON → MD → Event)
      const resumed = await stateStorage.resumeTask(projectId)

      if (!resumed) {
        if (options.md) {
          mdActionRequired('idle', 'no_paused_task', [
            { label: 'Start a new task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no paused task to resume')
        }
        return { success: true, message: 'No paused task found' }
      }

      if (options.md) {
        console.log(
          mdOutput(
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
   * /p:workflow - View and manage workflow rules
   *
   * Subcommands:
   *   (none)         Show all rules
   *   <command>      Show rules for a specific command (task, done, ship, sync)
   *   add "action" before|after <command>   Add a hook
   *   gate <command> "action"               Add a gate (blocking)
   *   rm <id>        Remove a rule by ID
   *   reset          Remove all rules
   */
  async workflow(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
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

      const trimmed = input?.trim() ?? ''
      // Parse: extract the subcommand keyword
      // Need to handle quoted strings carefully
      const subcommand = trimmed.split(/\s+/)[0]?.toLowerCase()

      switch (subcommand) {
        case 'add':
          return this._workflowAdd(trimmed.slice(3).trim(), projectId, options)
        case 'gate':
          return this._workflowGate(trimmed.slice(4).trim(), projectId, options)
        case 'rm':
          return this._workflowRm(trimmed.slice(2).trim(), projectId, options)
        case 'reset':
          return this._workflowReset(projectId, options)
        default:
          // Show rules, optionally filtered by command name
          return this._workflowShow(subcommand || null, projectId, options)
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
   * Parse a quoted or unquoted action string from input.
   * Returns [action, rest] where rest is the remaining unparsed input.
   */
  private _parseAction(input: string): [string, string] {
    const trimmed = input.trim()
    if (trimmed.startsWith('"')) {
      const endQuote = trimmed.indexOf('"', 1)
      if (endQuote === -1) return [trimmed.slice(1), '']
      return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
    }
    if (trimmed.startsWith("'")) {
      const endQuote = trimmed.indexOf("'", 1)
      if (endQuote === -1) return [trimmed.slice(1), '']
      return [trimmed.slice(1, endQuote), trimmed.slice(endQuote + 1).trim()]
    }
    // Unquoted: take everything up to 'before' or 'after' keyword
    const match = trimmed.match(/^(.+?)\s+(before|after)\s+/i)
    if (match) return [match[1].trim(), trimmed.slice(match[1].length).trim()]
    return [trimmed, '']
  }

  /**
   * Add a hook rule: "npm test" before ship
   */
  private async _workflowAdd(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: "action" before|after command
    const [action, rest] = this._parseAction(input)
    if (!action || !rest) {
      const msg = 'Usage: prjct workflow add "command" before|after <task|done|ship|sync>'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const parts = rest.split(/\s+/)
    const position = parts[0]?.toLowerCase()
    const command = parts[1]?.toLowerCase()

    if (!position || !['before', 'after'].includes(position)) {
      const msg = 'Position must be "before" or "after"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    if (!command || !['task', 'done', 'ship', 'sync'].includes(command)) {
      const msg = 'Command must be one of: task, done, ship, sync'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const ruleId = workflowRuleStorage.addRule(projectId, {
      type: 'hook',
      command,
      position,
      action,
      description: null,
      enabled: true,
      timeoutMs: 60000,
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    })

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('Rule Added', `#${ruleId} [hook] ${position} ${command} → \`${action}\``),
          mdNextSteps([
            { label: 'View all rules', command: 'prjct workflow --md' },
            { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
          ])
        )
      )
    } else {
      out.done(`rule #${ruleId} added: [hook] ${position} ${command} → ${action}`)
    }

    return { success: true, ruleId }
  }

  /**
   * Add a gate rule: ship "npm test"
   */
  private async _workflowGate(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: command "action"
    const parts = input.trim().split(/\s+/)
    const command = parts[0]?.toLowerCase()

    if (!command || !['task', 'done', 'ship', 'sync'].includes(command)) {
      const msg = 'Usage: prjct workflow gate <task|done|ship|sync> "command"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const actionInput = input.slice(input.indexOf(command) + command.length).trim()
    const [action] = this._parseAction(actionInput)

    if (!action) {
      const msg = 'Usage: prjct workflow gate <command> "shell command"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const ruleId = workflowRuleStorage.addRule(projectId, {
      type: 'gate',
      command,
      position: 'before',
      action,
      description: null,
      enabled: true,
      timeoutMs: 60000,
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    })

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('Gate Added', `#${ruleId} [gate] before ${command} → \`${action}\``),
          mdNextSteps([
            { label: 'View all rules', command: 'prjct workflow --md' },
            { label: 'Remove this gate', command: `prjct workflow rm ${ruleId} --md` },
          ])
        )
      )
    } else {
      out.done(`gate #${ruleId} added: before ${command} → ${action}`)
    }

    return { success: true, ruleId }
  }

  /**
   * Remove a rule by ID
   */
  private async _workflowRm(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const ruleId = parseInt(input.trim(), 10)
    if (Number.isNaN(ruleId)) {
      const msg = 'Usage: prjct workflow rm <rule-id>'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const removed = workflowRuleStorage.removeRule(projectId, ruleId)
    if (!removed) {
      const msg = `Rule #${ruleId} not found`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    if (options.md) {
      console.log(mdOutput(mdDone('Rule Removed', `Removed rule #${ruleId}`)))
    } else {
      out.done(`removed rule #${ruleId}`)
    }

    return { success: true }
  }

  /**
   * Reset all workflow rules
   */
  private async _workflowReset(
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const count = workflowRuleStorage.resetRules(projectId)

    if (options.md) {
      console.log(mdOutput(mdDone('Rules Reset', `Removed ${count} rule${count !== 1 ? 's' : ''}`)))
    } else {
      out.done(`reset: removed ${count} rule${count !== 1 ? 's' : ''}`)
    }

    return { success: true, count }
  }

  /**
   * Show workflow rules (optionally filtered by command)
   */
  private async _workflowShow(
    command: string | null,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const validCommands = ['task', 'done', 'ship', 'sync']

    let rules: WorkflowRule[]
    if (command && validCommands.includes(command)) {
      rules = workflowRuleStorage.getRulesForCommand(projectId, command)
    } else {
      rules = workflowRuleStorage.getAllRules(projectId)
    }

    // Also get legacy preferences for display
    const legacyPrefs = await listWorkflowPreferences(projectId)

    if (rules.length === 0 && legacyPrefs.length === 0) {
      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Workflow Rules', 'No rules configured'),
            mdNextSteps([
              { label: 'Add a hook', command: 'prjct workflow add "npm test" before ship --md' },
              { label: 'Add a gate', command: 'prjct workflow gate ship "npm test" --md' },
            ])
          )
        )
      } else {
        out.warn('no workflow rules configured')
        console.log('')
        console.log('  Add a hook:  prjct workflow add "npm test" before ship')
        console.log('  Add a gate:  prjct workflow gate ship "npm test"')
        console.log('  Reset all:   prjct workflow reset')
      }
      return { success: true, rules: [], legacy: legacyPrefs }
    }

    if (options.md) {
      const items: string[] = []
      for (const r of rules) {
        const enabled = r.enabled ? '' : ' (disabled)'
        items.push(`#${r.id} [${r.type}] ${r.position} ${r.command} → \`${r.action}\`${enabled}`)
      }
      for (const p of legacyPrefs) {
        items.push(`[legacy] ${p.key} → \`${p.action}\` (${p.scope})`)
      }

      const title = command ? `Workflow Rules: ${command}` : 'Workflow Rules'
      console.log(
        mdOutput(
          mdSection(title, `${rules.length} rule${rules.length !== 1 ? 's' : ''}`),
          mdList(items),
          mdNextSteps([
            { label: 'Add a hook', command: 'prjct workflow add "cmd" before ship --md' },
            { label: 'Add a gate', command: 'prjct workflow gate ship "cmd" --md' },
            { label: 'Remove a rule', command: 'prjct workflow rm <id> --md' },
          ])
        )
      )
    } else {
      const title = command ? `WORKFLOW RULES: ${command.toUpperCase()}` : 'WORKFLOW RULES'
      console.log('')
      console.log(title)
      console.log('──────────────────────────────────')

      for (const r of rules) {
        const enabled = r.enabled ? '' : ' (disabled)'
        console.log(
          `  #${r.id} [${r.type}]   ${r.position.padEnd(6)} ${r.command.padEnd(5)}  → ${r.action}${enabled}`
        )
      }

      if (legacyPrefs.length > 0) {
        console.log('')
        console.log('  Legacy preferences:')
        for (const p of legacyPrefs) {
          console.log(`  [legacy] ${p.key.padEnd(15)} → ${p.action} (${p.scope})`)
        }
      }

      console.log('')
      console.log('Commands: add | gate | rm | reset')
    }

    return { success: true, rules, legacy: legacyPrefs }
  }

  /**
   * /p:sessions - Show recent sessions across all projects (PRJ-285)
   */
  async sessions(
    _projectPath: string = process.cwd(),
    options: { md?: boolean; cleanup?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      // Auto-clean old snapshots
      if (options.cleanup) {
        const cleaned = await sessionSnapshotManager.cleanup()
        if (options.md) {
          console.log(
            mdDone('Cleanup', `Removed ${cleaned} stale snapshot${cleaned !== 1 ? 's' : ''}`)
          )
        } else {
          out.done(`cleaned ${cleaned} stale snapshot${cleaned !== 1 ? 's' : ''}`)
        }
        return { success: true, cleaned }
      }

      const snapshots = await sessionSnapshotManager.listAllSnapshots()

      if (snapshots.length === 0) {
        if (options.md) {
          mdActionRequired('empty', 'no_sessions', [
            { label: 'Start a task', command: 'prjct task "description" --md' },
          ])
        } else {
          out.warn('no recent sessions found')
        }
        return { success: true, message: 'No recent sessions' }
      }

      if (options.md) {
        const items = snapshots.map((s) => {
          const ago = dateHelper.formatDuration(Date.now() - new Date(s.timestamp).getTime())
          const project = s.projectName || s.projectId.slice(0, 8)
          const subtaskInfo =
            s.subtaskCount && s.activeSubtaskIndex !== undefined
              ? ` (${s.activeSubtaskIndex + 1}/${s.subtaskCount})`
              : ''
          return `[${s.taskStatus}] **${project}** — ${s.taskDescription}${subtaskInfo} (${ago} ago)`
        })

        console.log(
          mdOutput(
            mdSection(
              'Recent Sessions',
              `${snapshots.length} session${snapshots.length !== 1 ? 's' : ''} across projects`
            ),
            mdList(items),
            mdNextSteps([
              { label: 'Resume a session', command: 'prjct resume --md' },
              { label: 'Clean old sessions', command: 'prjct sessions --cleanup --md' },
            ])
          )
        )
      } else {
        out.done(`${snapshots.length} recent session${snapshots.length !== 1 ? 's' : ''}`)
        for (const s of snapshots) {
          const ago = dateHelper.formatDuration(Date.now() - new Date(s.timestamp).getTime())
          const project = s.projectName || s.projectId.slice(0, 8)
          console.log(`  [${s.taskStatus}] ${project} — ${s.taskDescription} (${ago} ago)`)
        }
      }

      return { success: true, snapshots, count: snapshots.length }
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

/** Get current git branch name */
async function getGitBranch(): Promise<string | undefined> {
  try {
    const { execSync } = await import('node:child_process')
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim() || undefined
  } catch {
    return undefined
  }
}

/** Load repo-analysis.json from global project path */
async function loadRepoAnalysis(globalPath: string): Promise<Record<string, unknown> | null> {
  try {
    const analysisPath = path.join(globalPath, 'analysis', 'repo-analysis.json')
    const content = await fs.readFile(analysisPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (isNotFoundError(error)) return null
    return null
  }
}

/** Build project context section from sealed analysis + repo-analysis */
function buildProjectContext(
  analysis: AnalysisSchema | null,
  repoAnalysis: Record<string, unknown> | null
): string | null {
  if (!analysis && !repoAnalysis) return null

  const ecosystem = (repoAnalysis?.ecosystem as string) || null
  const languages = analysis?.languages?.join(', ') || null
  const frameworks = analysis?.frameworks?.join(', ') || null
  const packageManager = analysis?.packageManager || null
  const sourceDir =
    analysis?.sourceDir ||
    ((repoAnalysis?.structure as Record<string, unknown>)?.srcDir as string) ||
    null
  const testDir =
    analysis?.testDir ||
    ((repoAnalysis?.structure as Record<string, unknown>)?.testDir as string) ||
    null

  const stats: Record<string, string | number | null | undefined> = {}
  if (ecosystem) stats.Ecosystem = ecosystem
  if (languages) stats.Languages = languages
  if (frameworks) stats.Frameworks = frameworks
  if (packageManager) stats['Package manager'] = packageManager
  if (sourceDir || testDir) {
    const parts: string[] = []
    if (sourceDir) parts.push(`${sourceDir}`)
    if (testDir) parts.push(`Tests: ${testDir}`)
    stats.Source = parts.join(' | ')
  }

  const statsBlock = mdStats(stats)

  // Commands section from repo-analysis
  const commands = repoAnalysis?.commands as Record<string, string> | undefined
  let commandsBlock: string | null = null
  if (commands && Object.keys(commands).length > 0) {
    const items = Object.entries(commands).map(
      ([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: \`${value}\``
    )
    commandsBlock = `### Commands\n${mdList(items)}`
  }

  const projectSection = statsBlock ? `### Project\n${statsBlock}` : null
  return [projectSection, commandsBlock].filter(Boolean).join('\n\n') || null
}

/** Build rules section from hardcoded rules + repo-analysis rules */
function buildRules(repoAnalysis: Record<string, unknown> | null): string {
  const rules: string[] = [
    'All commits must include footer: Generated with [p/](https://www.prjct.app/)',
    'Never commit directly to main/master',
  ]

  const repoRules = repoAnalysis?.rules
  if (Array.isArray(repoRules)) {
    for (const rule of repoRules) {
      if (typeof rule === 'string' && !rules.some((r) => r.toLowerCase() === rule.toLowerCase())) {
        rules.push(rule)
      }
    }
  }

  return mdRules(rules)
}

/** Build patterns & anti-patterns sections from sealed analysis */
function buildPatterns(analysis: AnalysisSchema | null): string | null {
  if (!analysis) return null

  const sections: string[] = []

  const patterns = analysis.patterns
  if (Array.isArray(patterns) && patterns.length > 0) {
    const items = patterns.map((p) => {
      const loc = p.location ? ` — \`${p.location}\`` : ''
      return `- **${p.name}**: ${p.description}${loc}`
    })
    sections.push(`### Patterns (follow these)\n${items.join('\n')}`)
  }

  const antiPatterns = analysis.antiPatterns
  if (Array.isArray(antiPatterns) && antiPatterns.length > 0) {
    const items = antiPatterns.map((a) => {
      return `- **${a.issue}** — \`${a.file}\` → ${a.suggestion}`
    })
    sections.push(`### Anti-patterns (avoid these)\n${items.join('\n')}`)
  }

  return sections.length > 0 ? sections.join('\n\n') : null
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
