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
import { isValidPoint, pointsToMinutes, pointsToTimeRange } from '../domain/fibonacci'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { templateGenerator } from '../infrastructure/template-generator'
import { generateUUID } from '../schemas/schemas'
import context7Service from '../services/context7-service'
import estimateTaskForStart from '../services/task-estimation'
import { getGitBranch } from '../session/git-helpers'
import { sessionSnapshotManager } from '../session/session-snapshot'
import { contextFeedbackStorage } from '../storage/context-feedback-storage'
import { customWorkflowStorage } from '../storage/custom-workflow-storage'
import { stateStorage } from '../storage/state-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import { extractKeywords } from '../tools/context/files-tool'
import type { RpiContext } from '../types/agentic'
import type { CommandResult } from '../types/commands'
import type { FibonacciPoint } from '../types/domain.js'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { WorkflowRule } from '../types/storage.js'
import * as dateHelper from '../utils/date-helper'
import {
  mdActionRequired,
  mdCallout,
  mdCodeBlock,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdSection,
  mdSubtasks,
  mdTaskHeader,
} from '../utils/md-formatter'
import { showNextSteps, showStateInfo } from '../utils/next-steps'
import out from '../utils/output'
import { detectProjectCommands } from '../utils/project-commands'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import { PrjctCommandsBase } from './base'

// =============================================================================
// Intent Detection Types
// =============================================================================

type IntentType =
  | 'view'
  | 'add'
  | 'remove'
  | 'disable'
  | 'gate'
  | 'instruction'
  | 'help'
  | 'reset'
  | 'init'
  | 'create'
  | 'list'
  | 'delete'
  | 'run'

interface WorkflowIntent {
  type: IntentType
  /** The remaining args after the intent keyword was consumed */
  args: string
  /** Confidence: 'exact' for keyword matches, 'fuzzy' for NL patterns */
  confidence: 'exact' | 'fuzzy'
}

/**
 * Exact keyword dispatch — one English verb per intent.
 *
 * Alpha.10 removed the bilingual natural-language patterns (`añade`,
 * `muestra`, `bloquea`, etc.) that used to guess the user's intent.
 * That was harness: prjct was deciding what the user "meant" from
 * fuzzy phrasing instead of just taking instructions. If Claude or
 * the human wants to author a rule, they pass the exact keyword —
 * no guessing.
 */
const INTENT_PATTERNS: Array<{ type: IntentType; patterns: RegExp }> = [
  { type: 'help', patterns: /^help\b/i },
  { type: 'add', patterns: /^add\b/i },
  { type: 'gate', patterns: /^gate\b/i },
  { type: 'instruction', patterns: /^instruction\b/i },
  { type: 'remove', patterns: /^rm\b/i },
  { type: 'reset', patterns: /^reset\b/i },
  { type: 'init', patterns: /^init\b/i },
  { type: 'create', patterns: /^(?:create|new)\b/i },
  { type: 'list', patterns: /^list\b/i },
  { type: 'delete', patterns: /^delete\b/i },
  { type: 'run', patterns: /^run\b/i },
  { type: 'disable', patterns: /^disable\b/i },
  { type: 'view', patterns: /^(?:show|view)\b/i },
]

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
        const taskDescription = task
        const linearPattern = /^[A-Z]+-\d+$/
        if (linearPattern.test(task)) {
          // Keep local issue linking. Status transitions are MCP-only.
          linearId = task
        }

        if (options.md) {
          // Context7 is mandatory before coding tasks
          try {
            await context7Service.ensureReady()
          } catch (error) {
            mdActionRequired(
              'blocked',
              'context7_not_ready',
              [
                { label: 'Fix Context7 now', command: 'prjct start' },
                { label: 'Retry task after fix', command: `prjct task "${taskDescription}" --md` },
                { label: 'Cancel' },
              ],
              { error: getErrorMessage(error) }
            )
            return { success: false, error: getErrorMessage(error) }
          }

          const estimate = await estimateTaskForStart(projectId, taskDescription)

          // Parallel-by-default: if a task is already active, auto-create a worktree
          // for the new task instead of blocking. Each task runs in isolation.
          const existingTask = await stateStorage.getCurrentTask(projectId)
          const activeWorkspaceTasks = await stateStorage.getActiveTasks(projectId)
          const { worktreeService } = await import('../services/worktree-service')
          const currentWorktree = await worktreeService.detect(projectPath)

          // Block ONLY if THIS specific worktree already has a task
          if (currentWorktree) {
            const conflictInThisWorktree = activeWorkspaceTasks.find(
              (t) => t.worktreePath === currentWorktree.path
            )
            if (conflictInThisWorktree) {
              mdActionRequired(
                'blocked',
                'task_already_active',
                [
                  { label: 'Ship current task first', command: 'prjct ship --md' },
                  { label: 'Set current task to blocked', command: 'prjct status blocked' },
                ],
                {
                  current_task: conflictInThisWorktree.description,
                  requested_task: taskDescription,
                }
              )
              return {
                success: true,
                message: 'Task already active in this worktree',
                currentTask: conflictInThisWorktree,
              }
            }
          }

          // Auto-worktree: if main tree has an active task, create a new worktree
          let taskWorktreePath: string | undefined
          const needsWorktree = existingTask && !currentWorktree
          if (needsWorktree) {
            const slug = taskDescription
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')
              .slice(0, 40)
            try {
              const wt = await worktreeService.create(projectPath, slug)
              await worktreeService.setup(wt.path, projectPath)
              taskWorktreePath = wt.path
              mdCallout('info', `Parallel session created: \`${wt.branch}\` at \`${wt.path}\``)
            } catch {
              // Worktree creation failed — fall back to pause-and-start
              mdActionRequired(
                'blocked',
                'task_already_active',
                [
                  { label: 'Ship current task first', command: 'prjct ship --md' },
                  { label: 'Set current task to blocked', command: 'prjct status blocked' },
                ],
                { current_task: existingTask.description, requested_task: taskDescription }
              )
              return { success: true, message: 'Task already active', currentTask: existingTask }
            }
          }

          // Start task — as workspace task if in worktree, or as main task
          if (taskWorktreePath || currentWorktree) {
            const workspaceId = generateUUID()
            await stateStorage.startTaskInWorkspace(
              projectId,
              {
                id: generateUUID(),
                description: taskDescription,
                sessionId: generateUUID(),
                workspaceId,
                worktreePath: taskWorktreePath || currentWorktree!.path,
                linearId,
                type: estimate.taskType,
                estimatedPoints: estimate.estimatedPoints,
                estimatedMinutes: estimate.estimatedMinutes,
              },
              workspaceId
            )
          } else {
            await stateStorage.startTask(projectId, {
              id: generateUUID(),
              description: taskDescription,
              sessionId: generateUUID(),
              linearId,
              type: estimate.taskType,
              estimatedPoints: estimate.estimatedPoints,
              estimatedMinutes: estimate.estimatedMinutes,
            } as Parameters<typeof stateStorage.startTask>[1])
          }

          // Load project context in parallel (non-blocking, graceful)
          const _globalPath = pathManager.getGlobalProjectPath(projectId)
          const taskKeywords = extractKeywords(taskDescription)
          let historicalBoosts: Map<string, number> | undefined
          try {
            historicalBoosts = contextFeedbackStorage.getHistoricalBoosts(projectId, taskKeywords)
            if (historicalBoosts.size === 0) historicalBoosts = undefined
          } catch {
            // Cold start or DB not ready — no boosts
          }

          // v2: lazy context. Task start emits the bare minimum; Claude
          // fetches files/patterns/memory on demand via `prjct context <topic>`.
          // This keeps the conversation lean — heavy context lived above as
          // ~400-600 tokens of speculative data Claude often didn't need.
          const branch = await getGitBranch(projectPath)

          // Session snapshot is state, not speculation — keep it.
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

          const header = mdTaskHeader({
            description: taskDescription,
            branch,
            linearId,
            type: estimate.taskType,
          })
          const next = mdNextSteps([
            { label: 'Find relevant files', command: 'prjct context files "..."' },
            { label: 'Pull project memory', command: 'prjct context memory <topic>' },
            { label: 'Tag the task', command: 'prjct tag type:bug domain:auth' },
            { label: 'Capture learnings', command: 'prjct remember learning "..."' },
            { label: 'Ship when done', command: 'prjct ship --md' },
          ])

          console.log(mdOutput(continuityContext, header, next))

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
        const estimate = await estimateTaskForStart(projectId, taskDescription)

        await stateStorage.startTask(projectId, {
          id: generateUUID(),
          description: taskDescription,
          sessionId: generateUUID(),
          linearId,
          type: estimate.taskType,
          estimatedPoints: estimate.estimatedPoints,
          estimatedMinutes: estimate.estimatedMinutes,
        } as Parameters<typeof stateStorage.startTask>[1])

        out.done(`${task}`)
        showStateInfo('working')
        showNextSteps('task')

        await this.logToMemory(projectPath, 'task_started', {
          task,
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
            { label: 'Ship when done', command: 'prjct ship --md' },
            { label: 'Change status inline', command: 'prjct status <value>' },
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
              { label: 'Ship current task', command: 'prjct ship --md' },
              { label: 'Change status inline', command: 'prjct status <value>' },
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
   * /p:workflow - View and manage workflow rules
   *
   * Supports both structured subcommands and natural language (bilingual EN/ES):
   *   (none)         Show all rules
   *   <command>      Show rules for a specific command (task, done, ship, sync)
   *   add "action" before|after <command>   Add a hook
   *   gate <command> "action"               Add a gate (blocking)
   *   rm <id>        Remove a rule by ID
   *   disable <id|query>  Disable a rule without removing
   *   reset          Remove all rules
   *   help           Show examples and usage
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

      // Empty input → show all rules
      if (!trimmed) {
        return this._workflowShow(null, projectId, options)
      }

      // Detect intent from natural language
      const intent = this._detectIntent(trimmed)

      switch (intent.type) {
        case 'add':
          return this._workflowAdd(intent.args, projectId, options)
        case 'gate':
          return this._workflowGate(intent.args, projectId, options)
        case 'instruction':
          return this._workflowInstruction(intent.args, projectId, options)
        case 'remove':
          return this._workflowRm(intent.args, projectId, options)
        case 'disable':
          return this._workflowDisable(intent.args, projectId, options)
        case 'reset':
          return this._workflowReset(projectId, options)
        case 'init':
          return this._workflowInit(projectId, projectPath, options)
        case 'help':
          return this._workflowHelp(options)
        case 'create':
          return this._workflowCreate(intent.args, projectId, projectPath, options)
        case 'list':
          return this._workflowList(projectId, options)
        case 'delete':
          return this._workflowDelete(intent.args, projectId, options)
        case 'run':
          return this.run(intent.args, projectPath, options)
        case 'view':
          return this._workflowShow(intent.args || null, projectId, options)
        default:
          // Fallback: treat as a command filter for show
          return this._workflowShow(
            trimmed.split(/\s+/)[0]?.toLowerCase() || null,
            projectId,
            options
          )
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
   * Parse natural language input into a structured intent.
   * Supports bilingual patterns (English/Spanish).
   */
  _detectIntent(input: string): WorkflowIntent {
    const trimmed = input.trim()

    for (const { type, patterns } of INTENT_PATTERNS) {
      const match = trimmed.match(patterns)
      if (match) {
        const consumed = match[0]
        const args = trimmed.slice(consumed.length).trim()
        return { type, args, confidence: 'exact' }
      }
    }

    // No keyword matched — treat as view (lists current rules) rather
    // than silently misinterpreting. `prjct workflow help` is always
    // available for discovery.
    return { type: 'view', args: trimmed, confidence: 'exact' }
  }

  /**
   * Search rules by action or description text.
   * Returns rules whose action or description contains the query (case-insensitive).
   */
  _searchRules(rules: WorkflowRule[], query: string): WorkflowRule[] {
    const lower = query.toLowerCase()
    return rules.filter((r) => {
      return (
        r.action.toLowerCase().includes(lower) ||
        (r.description?.toLowerCase().includes(lower) ?? false) ||
        r.command.toLowerCase().includes(lower) ||
        String(r.id) === lower
      )
    })
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

    // Validate workflow exists and is enabled
    const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
    if (!command || !workflow || !workflow.enabled) {
      const workflows = customWorkflowStorage.getAllWorkflows(projectId)
      const workflowNames = workflows.map((w) => w.name).join(', ')
      const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
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

    // Validate workflow exists and is enabled
    const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
    if (!command || !workflow || !workflow.enabled) {
      const workflows = customWorkflowStorage.getAllWorkflows(projectId)
      const workflowNames = workflows.map((w) => w.name).join(', ')
      const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
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
   * Add an instruction rule: ship before "Post review comment in Linear"
   */
  private async _workflowInstruction(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: command before|after "instruction text"
    const parts = input.trim().split(/\s+/)
    const command = parts[0]?.toLowerCase()

    // Validate workflow exists and is enabled
    const workflow = customWorkflowStorage.getWorkflow(projectId, command || '')
    if (!command || !workflow || !workflow.enabled) {
      const workflows = customWorkflowStorage.getAllWorkflows(projectId)
      const workflowNames = workflows.map((w) => w.name).join(', ')
      const msg = `Workflow '${command}' not found. Available: ${workflowNames}`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const afterCommand = input.slice(input.indexOf(command) + command.length).trim()
    const positionMatch = afterCommand.match(/^(before|after)\s+/i)
    if (!positionMatch) {
      const msg = 'Usage: prjct workflow instruction <command> before|after "instruction text"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const position = positionMatch[1].toLowerCase()
    const actionInput = afterCommand.slice(positionMatch[0].length).trim()
    const [action] = this._parseAction(actionInput)

    if (!action) {
      const msg = 'Usage: prjct workflow instruction <command> before|after "instruction text"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const ruleId = workflowRuleStorage.addRule(projectId, {
      type: 'instruction',
      command,
      position,
      action,
      description: null,
      enabled: true,
      timeoutMs: 0,
      createdAt: new Date().toISOString(),
      sortOrder: 0,
    })

    if (options.md) {
      console.log(
        mdOutput(
          mdDone(
            'Instruction Added',
            `#${ruleId} [instruction] ${position} ${command} → \`${action}\``
          ),
          mdNextSteps([
            { label: 'View all rules', command: 'prjct workflow --md' },
            { label: 'Remove this rule', command: `prjct workflow rm ${ruleId} --md` },
          ])
        )
      )
    } else {
      out.done(`instruction #${ruleId} added: ${position} ${command} → ${action}`)
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
   * Disable a rule by ID or search query (without removing it).
   * Uses updateRule() from storage layer.
   */
  private async _workflowDisable(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const trimmed = input.trim()

    // Try numeric ID first
    const ruleId = parseInt(trimmed, 10)
    if (!Number.isNaN(ruleId)) {
      const rule = workflowRuleStorage.getRuleById(projectId, ruleId)
      if (!rule) {
        const msg = `Rule #${ruleId} not found`
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      if (!rule.enabled) {
        const msg = `Rule #${ruleId} is already disabled`
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: true, message: msg }
      }

      workflowRuleStorage.updateRule(projectId, ruleId, { enabled: false })

      if (options.md) {
        console.log(
          mdOutput(
            mdDone('Rule Disabled', `#${ruleId} [${rule.type}] ${rule.action}`),
            mdNextSteps([
              { label: 'Re-enable this rule', command: `prjct workflow enable ${ruleId} --md` },
              { label: 'View all rules', command: 'prjct workflow --md' },
            ])
          )
        )
      } else {
        out.done(`disabled rule #${ruleId}: ${rule.action}`)
      }

      return { success: true, ruleId }
    }

    // Not a numeric ID — search by query
    const allRules = workflowRuleStorage.getAllRules(projectId)
    const matches = this._searchRules(allRules, trimmed)

    if (matches.length === 0) {
      const msg = `No rules matching "${trimmed}"`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    if (matches.length === 1) {
      const rule = matches[0]
      workflowRuleStorage.updateRule(projectId, rule.id, { enabled: false })

      if (options.md) {
        console.log(mdOutput(mdDone('Rule Disabled', `#${rule.id} [${rule.type}] ${rule.action}`)))
      } else {
        out.done(`disabled rule #${rule.id}: ${rule.action}`)
      }
      return { success: true, ruleId: rule.id }
    }

    // Multiple matches — ask user to be more specific
    const capped = matches.slice(0, 5)
    if (options.md) {
      const items = capped.map(
        (r) => `#${r.id} [${r.type}] ${r.position} ${r.command} -> \`${r.action}\``
      )
      if (matches.length > 5) items.push(`...and ${matches.length - 5} more`)
      console.log(
        mdOutput(
          mdSection('Multiple matches', `${matches.length} rules match "${trimmed}"`),
          mdList(items),
          mdNextSteps(
            capped.map((r) => ({
              label: `Disable #${r.id}`,
              command: `prjct workflow disable ${r.id} --md`,
            }))
          )
        )
      )
    } else {
      out.warn(`${matches.length} rules match "${trimmed}" — specify an ID:`)
      for (const r of capped) {
        console.log(`  #${r.id} [${r.type}] ${r.position} ${r.command} -> ${r.action}`)
      }
      if (matches.length > 5) console.log(`  ...and ${matches.length - 5} more`)
    }

    return { success: true, matches: matches.map((r) => r.id) }
  }

  /**
   * Show workflow help: examples and usage in both languages
   */
  private async _workflowHelp(options: { md?: boolean }): Promise<CommandResult> {
    if (options.md) {
      console.log(
        mdOutput(
          mdSection('Workflow Help', 'Manage hooks, gates, and steps for your workflow'),
          mdSection(
            'Commands',
            mdList([
              '`prjct workflow` — View all rules',
              '`prjct workflow ship` — View rules for a command',
              '`prjct workflow add "npm test" before ship` — Add a hook',
              '`prjct workflow gate ship "npm test"` — Add a blocking gate',
              '`prjct workflow instruction ship after "Post review in Linear"` — Add an agent instruction',
              '`prjct workflow disable 3` — Disable rule #3',
              '`prjct workflow rm 3` — Remove rule #3',
              '`prjct workflow reset` — Remove all rules',
              '`prjct workflow init` — Seed defaults from project',
            ])
          ),
          mdSection(
            'Natural Language (EN/ES)',
            mdList([
              '`prjct workflow "show ship rules"` — muestra / show / list / ver',
              '`prjct workflow "add npm test before ship"` — añade / add / agrega / pon',
              '`prjct workflow "remove 3"` — quita / remove / elimina / borra',
              '`prjct workflow "disable lint"` — deshabilita / disable / apaga',
              '`prjct workflow "gate ship npm test"` — gate / bloquea',
            ])
          )
        )
      )
    } else {
      console.log('')
      console.log('WORKFLOW HELP')
      console.log('──────────────────────────────────')
      console.log('')
      console.log('  Commands:')
      console.log('    prjct workflow                           View all rules')
      console.log('    prjct workflow <command>                 View rules for command')
      console.log('    prjct workflow add "cmd" before ship     Add a hook')
      console.log('    prjct workflow gate ship "cmd"           Add a blocking gate')
      console.log('    prjct workflow instruction ship after "text"  Add an agent instruction')
      console.log('    prjct workflow disable <id|query>        Disable a rule')
      console.log('    prjct workflow rm <id>                   Remove a rule')
      console.log('    prjct workflow reset                     Remove all rules')
      console.log('    prjct workflow init                      Seed defaults')
      console.log('')
      console.log('  Natural language (EN/ES):')
      console.log('    show/muestra  add/añade  remove/quita  disable/deshabilita  gate/bloquea')
      console.log('')
    }

    return { success: true }
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

    if (rules.length === 0) {
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
      return { success: true, rules: [] }
    }

    if (options.md) {
      // Group rules by command for flow diagrams
      const commandsToShow = command ? [command] : validCommands
      const diagrams: string[] = []

      for (const cmd of commandsToShow) {
        const cmdRules = rules.filter((r) => r.command === cmd)
        if (cmdRules.length === 0) continue
        diagrams.push(buildFlowDiagram(cmd, cmdRules))
      }

      const title = command ? `Workflow: ${command}` : 'Workflow Rules'
      const count = `${rules.length} rule${rules.length !== 1 ? 's' : ''}`
      console.log(
        mdOutput(
          mdSection(title, count),
          diagrams.length > 0 ? mdCodeBlock(diagrams.join('\n\n'), '') : null,
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

      console.log('')
      console.log('Commands: add | gate | rm | reset')
    }

    return { success: true, rules }
  }

  /**
   * Initialize workflow rules for ship command.
   * Seeds sensible defaults based on detected project tools.
   * Useful for existing projects that were initialized before workflow rules were added.
   */
  private async _workflowInit(
    projectId: string,
    projectPath: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Check if ship rules already exist
    const existingRules = workflowRuleStorage
      .getRulesForCommand(projectId, 'ship')
      .filter((r) => r.position === 'before')

    if (existingRules.length > 0) {
      const msg = `Ship workflow already has ${existingRules.length} rule${existingRules.length !== 1 ? 's' : ''}. Use 'prjct workflow reset' first if you want to reinitialize.`
      if (options.md) {
        console.log(`> ${msg}`)
      } else {
        out.warn(msg)
      }
      return { success: false, error: msg }
    }

    // Seed default workflow rules
    const detected = await detectProjectCommands(projectPath)
    let sortOrder = 0
    const rulesAdded: string[] = []

    // Gate: Prevent shipping from main/master
    const gateId = workflowRuleStorage.addRule(projectId, {
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: 'git branch --show-current | grep -vE "^(main|master)$"',
      description: 'Prevent shipping from main branch',
      enabled: true,
      timeoutMs: 5000,
      sortOrder: sortOrder++,
      createdAt: new Date().toISOString(),
    })
    rulesAdded.push(`#${gateId} [gate] prevent main branch`)

    // Step: Lint (if detected, non-blocking with || true)
    if (detected.lint) {
      const lintId = workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.lint.command} || true`,
        description: 'Lint code',
        enabled: true,
        timeoutMs: 120000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
      rulesAdded.push(`#${lintId} [step] lint → ${detected.lint.command}`)
    }

    // Step: Test (if detected, non-blocking with || true)
    if (detected.test) {
      const testId = workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.test.command} || true`,
        description: 'Run tests',
        enabled: true,
        timeoutMs: 300000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
      rulesAdded.push(`#${testId} [step] test → ${detected.test.command}`)
    }

    if (options.md) {
      console.log(
        mdOutput(
          mdDone('Workflow Initialized', `Added ${rulesAdded.length} default ship rules`),
          mdList(rulesAdded),
          mdNextSteps([
            { label: 'View all rules', command: 'prjct workflow --md' },
            { label: 'Ship your work', command: 'prjct ship --md' },
          ])
        )
      )
    } else {
      out.done(`initialized ${rulesAdded.length} workflow rules for ship`)
      for (const rule of rulesAdded) {
        console.log(`  ${rule}`)
      }
    }

    return { success: true, rulesAdded: rulesAdded.length }
  }

  /**
   * Create a new custom workflow with agentic auto-configuration
   */
  private async _workflowCreate(
    input: string,
    projectId: string,
    _projectPath: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    // Parse: name "description"
    const match = input.match(/^(\S+)\s+"([^"]+)"/)
    if (!match) {
      const msg = 'Usage: prjct workflow create <name> "description"'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    const [, name, description] = match

    // Validate name format
    if (!customWorkflowStorage.isValidName(name)) {
      const msg =
        'Workflow name must be lowercase alphanumeric + hyphens (e.g., "qa", "deploy-prod")'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    // Check if name is reserved
    if (customWorkflowStorage.isReservedName(name)) {
      const msg = `Workflow name '${name}' is reserved`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    // Check if workflow already exists
    const existing = customWorkflowStorage.getWorkflow(projectId, name)
    if (existing) {
      const msg = `Workflow '${name}' already exists`
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    try {
      // Create workflow in DB
      const workflowId = customWorkflowStorage.createWorkflow(projectId, { name, description })

      // Generate template at ~/.claude/commands/p/{name}.md
      const templateResult = await templateGenerator.generateWorkflowTemplate(name, description)
      if (!templateResult.success) {
        // Rollback workflow creation if template generation fails
        customWorkflowStorage.deleteWorkflow(projectId, name)
        const msg = `Failed to generate template: ${templateResult.error}`
        if (options.md) console.log(`> Error: ${msg}`)
        else out.fail(msg)
        return { success: false, error: msg }
      }

      if (options.md) {
        console.log(
          mdOutput(
            mdDone('Workflow Created', `Created workflow: ${name}`),
            mdSection('Description', description),
            mdSection('Template', `Installed at ${templateResult.path}`),
            mdNextSteps([
              { label: 'Add rules', command: `prjct workflow add "action" before ${name} --md` },
              { label: 'View workflow', command: `prjct workflow ${name} --md` },
              { label: 'Run workflow', command: `p. ${name}` },
            ])
          )
        )
      } else {
        out.done(`created workflow: ${name}`)
        console.log(`  ${description}`)
        console.log(`  Template: ${templateResult.path}`)
        console.log(`\nRun with: p. ${name}`)
      }

      return { success: true, workflowId, name, templatePath: templateResult.path }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) console.log(`> Error: ${msg}`)
      else out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * List all workflows (built-in + custom)
   */
  private async _workflowList(
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const workflows = customWorkflowStorage.getAllWorkflows(projectId)

    if (workflows.length === 0) {
      const msg = 'No workflows found'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: true, workflows: [] }
    }

    const builtin = workflows.filter((w) => w.isBuiltin)
    const custom = workflows.filter((w) => !w.isBuiltin)

    if (options.md) {
      const sections: string[] = []

      if (builtin.length > 0) {
        const items = builtin.map((w) => `- **${w.name}** — ${w.description}`)
        sections.push(mdSection('Built-in Workflows', items.join('\n')))
      }

      if (custom.length > 0) {
        const items = custom.map((w) => `- **${w.name}** — ${w.description}`)
        sections.push(mdSection('Custom Workflows', items.join('\n')))
      }

      console.log(
        mdOutput(
          ...sections,
          mdNextSteps([
            {
              label: 'Create workflow',
              command: 'prjct workflow create <name> "description" --md',
            },
            { label: 'View workflow', command: 'prjct workflow <name> --md' },
          ])
        )
      )
    } else {
      out.done(`${workflows.length} workflow${workflows.length !== 1 ? 's' : ''}`)
      if (builtin.length > 0) {
        console.log('\nBuilt-in:')
        for (const w of builtin) {
          console.log(`  ${w.name} — ${w.description}`)
        }
      }
      if (custom.length > 0) {
        console.log('\nCustom:')
        for (const w of custom) {
          console.log(`  ${w.name} — ${w.description}`)
        }
      }
    }

    return { success: true, workflows }
  }

  /**
   * Delete a custom workflow
   */
  private async _workflowDelete(
    input: string,
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const name = input.trim()

    if (!name) {
      const msg = 'Usage: prjct workflow delete <name>'
      if (options.md) console.log(`> ${msg}`)
      else out.warn(msg)
      return { success: false, error: msg }
    }

    try {
      const deleted = customWorkflowStorage.deleteWorkflow(projectId, name)

      if (!deleted) {
        const msg = `Workflow '${name}' not found`
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      // Delete template file
      await templateGenerator.deleteWorkflowTemplate(name)

      if (options.md) {
        console.log(mdOutput(mdDone('Workflow Deleted', `Deleted workflow: ${name}`)))
      } else {
        out.done(`deleted workflow: ${name}`)
      }

      return { success: true }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) console.log(`> Error: ${msg}`)
      else out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * Execute a custom workflow (runs all before/after rules)
   */
  async run(
    workflowName: string,
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

      const name = workflowName.trim()
      if (!name) {
        const msg = 'Usage: prjct workflow run <name>'
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      // Validate workflow exists and is enabled
      const workflow = customWorkflowStorage.getWorkflow(projectId, name)
      if (!workflow || !workflow.enabled) {
        const msg = `Workflow '${name}' not found`
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

      // Execute before phase (gates + steps)
      const beforeResult = await executeWorkflowRules(projectId, name, 'before', { projectPath })

      if (!beforeResult.success) {
        if (options.md) {
          mdActionRequired('failed', 'workflow_gates_failed', [
            { label: 'View rules', command: `prjct workflow ${name} --md` },
          ])
        } else {
          out.fail('Workflow gates failed')
          if (beforeResult.gatesFailed) {
            for (const gate of beforeResult.gatesFailed) {
              console.log(`  ✗ ${gate}`)
            }
          }
        }
        return {
          success: false,
          error: 'Workflow gates failed',
          gatesFailed: beforeResult.gatesFailed,
        }
      }

      // Execute after phase (hooks)
      await executeWorkflowRules(projectId, name, 'after', { projectPath })

      // Format output
      if (options.md) {
        console.log(
          mdOutput(
            mdDone(`Workflow: ${name}`, workflow.description || ''),
            mdNextSteps([
              { label: 'View rules', command: `prjct workflow ${name} --md` },
              { label: 'Run again', command: `p. ${name}` },
            ])
          )
        )
      } else {
        out.done(`${name} completed successfully`)
      }

      return { success: true, workflow: name }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) {
        console.log(`> Error: ${msg}`)
      } else {
        out.fail(msg)
      }
      return { success: false, error: msg }
    }
  }
}

// =============================================================================
// Helpers
// =============================================================================

/** Format minutes to a human-readable duration string */
// =============================================================================
// Context Health & RPI Helpers (for --md output)
// =============================================================================

/**
 * Build efficiency directive section for --md output.
 * This is what Claude Code actually reads — must include sub-agent guidance.
 */
function _buildEfficiencySection(): string {
  const lines = [
    '### Efficiency',
    '- Be concise. No preamble, no filler.',
    '- **Use sub-agents (Agent tool) for exploration that produces >5 file reads.** Sub-agents isolate context and prevent the main conversation from bloating.',
    '- Prefer `file:line` references over dumping full file contents.',
    '- Capture learnings as you go: `prjct remember learning "..."`.',
  ]
  return lines.join('\n')
}

/**
 * Resolve RPI phase and build advisory section for --md output.
 * Returns null if RPI data is unavailable.
 */
function _buildRpiSection(projectId: string): string | null {
  try {
    const { prjctDb } = require('../storage/database')
    const researchDoc = prjctDb.getDoc(projectId, 'rpi:current:research')
    const planDoc = prjctDb.getDoc(projectId, 'rpi:current:plan')

    let rpi: RpiContext
    if (!researchDoc) {
      rpi = { phase: 'research' }
    } else if (!planDoc) {
      rpi = { phase: 'plan', researchDoc }
    } else {
      rpi = { phase: 'implement', researchDoc, planDoc }
    }

    const lines: string[] = ['### RPI Phase']

    switch (rpi.phase) {
      case 'research':
        lines.push(
          '**Phase: RESEARCH** — Explore the codebase first. Use the **Agent tool** (sub-agents) for broad exploration.',
          'Produce a truth snapshot: exact files + lines, function call chains, test locations.',
          'Capture key findings with `prjct remember fact|gotcha|decision "..."`.'
        )
        break
      case 'plan':
        lines.push(
          '**Phase: PLAN** — Create an implementation plan with real code snippets.',
          'Reference exact files and line numbers from research.',
          'Use sub-agents to verify assumptions if needed.'
        )
        if (rpi.researchDoc) {
          lines.push('', '<research-context>', rpi.researchDoc, '</research-context>')
        }
        break
      case 'implement':
        lines.push(
          '**Phase: IMPLEMENT** — Execute the plan. Minimal exploration.',
          'Work only with the scoped files. Avoid reading new files unless absolutely necessary.'
        )
        if (rpi.planDoc) {
          // Extract scoped files from plan
          const filePattern = /`([a-zA-Z0-9_\-./]+\.[a-zA-Z]{1,6})`/g
          const scopedFiles = new Set<string>()
          for (const match of rpi.planDoc.matchAll(filePattern)) {
            scopedFiles.add(match[1])
          }
          if (scopedFiles.size > 0) {
            lines.push(
              `**Scoped Files**: ${[...scopedFiles]
                .slice(0, 20)
                .map((f) => `\`${f}\``)
                .join(', ')}`
            )
          }
        }
        break
    }

    return lines.join('\n')
  } catch {
    return null
  }
}

function _formatMinutesToDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Load repo-analysis.json from global project path */
async function _loadRepoAnalysis(globalPath: string): Promise<Record<string, unknown> | null> {
  try {
    const analysisPath = path.join(globalPath, 'analysis', 'repo-analysis.json')
    const content = await fs.readFile(analysisPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if (isNotFoundError(error)) return null
    return null
  }
}

/**
 * Build an ASCII flow diagram for a single command's workflow rules.
 * Shows: gates (before) → hooks (before) → COMMAND → steps → hooks (after)
 */
function buildFlowDiagram(command: string, rules: WorkflowRule[]): string {
  const gates = rules.filter((r) => r.type === 'gate' && r.position === 'before')
  const instructionsBefore = rules.filter(
    (r) => r.type === 'instruction' && r.position === 'before'
  )
  const hooksBefore = rules.filter((r) => r.type === 'hook' && r.position === 'before')
  const stepsBefore = rules.filter((r) => r.type === 'step' && r.position === 'before')
  const instructionsAfter = rules.filter((r) => r.type === 'instruction' && r.position === 'after')
  const hooksAfter = rules.filter((r) => r.type === 'hook' && r.position === 'after')
  const stepsAfter = rules.filter((r) => r.type === 'step' && r.position === 'after')

  const lines: string[] = []

  // Helper to draw a box with a label and rule items
  const drawBox = (label: string, items: WorkflowRule[], icon: string) => {
    const content = items.map((r) => {
      const status = r.enabled ? icon : 'o'
      return `  ${status} #${r.id} ${r.action}`
    })
    const allLines = [label, ...content]
    const maxLen = Math.max(...allLines.map((l) => l.length))
    const width = maxLen + 2

    lines.push(`+${'-'.repeat(width)}+`)
    for (const line of allLines) {
      lines.push(`| ${line.padEnd(width - 1)}|`)
    }
    lines.push(`+${'-'.repeat(width)}+`)
  }

  const arrow = (lines: string[]) => {
    lines.push('        |')
    lines.push('        v')
  }

  if (gates.length > 0) {
    drawBox('GATES (must pass)', gates, '#')
    arrow(lines)
  }

  if (instructionsBefore.length > 0) {
    drawBox('INSTRUCTIONS (before)', instructionsBefore, '📋')
    arrow(lines)
  }

  if (hooksBefore.length > 0) {
    drawBox('HOOKS (before)', hooksBefore, '>')
    arrow(lines)
  }

  if (stepsBefore.length > 0) {
    drawBox('STEPS (before)', stepsBefore, '>')
    arrow(lines)
  }

  // Command node
  lines.push(`   [ ${command.toUpperCase()} ]`)

  if (instructionsAfter.length > 0) {
    arrow(lines)
    drawBox('INSTRUCTIONS (after)', instructionsAfter, '📋')
  }

  if (hooksAfter.length > 0) {
    arrow(lines)
    drawBox('HOOKS (after)', hooksAfter, '>')
  }

  if (stepsAfter.length > 0) {
    arrow(lines)
    drawBox('STEPS (after)', stepsAfter, '>')
  }

  return lines.join('\n')
}

/** Get files modified since task start using git */
async function _getFilesModifiedSinceTaskStart(
  projectPath: string,
  startedAt: string
): Promise<string[]> {
  const { execSync } = await import('node:child_process')
  const files = new Set<string>()
  const opts = { cwd: projectPath, encoding: 'utf-8' as const }

  try {
    const committed = execSync(
      `git log --since="${startedAt}" --name-only --pretty=format:""`,
      opts
    )
    for (const line of committed.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // git log may fail if no commits since start
  }

  try {
    const staged = execSync('git diff --cached --name-only', opts)
    for (const line of staged.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // ignore
  }

  try {
    const unstaged = execSync('git diff --name-only', opts)
    for (const line of unstaged.split('\n')) {
      const trimmed = line.trim()
      if (trimmed) files.add(trimmed)
    }
  } catch {
    // ignore
  }

  return [...files]
}

/** Format a variance in minutes to a string like "+30m" or "-15m" */
function _formatVariance(diffMinutes: number): string {
  const sign = diffMinutes >= 0 ? '+' : '-'
  const abs = Math.abs(diffMinutes)
  if (abs >= 60) {
    const hours = Math.floor(abs / 60)
    const mins = abs % 60
    return mins > 0 ? `${sign}${hours}h ${mins}m` : `${sign}${hours}h`
  }
  return `${sign}${abs}m`
}
