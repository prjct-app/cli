/**
 * Workflow Commands — `now` (task start) + `workflow` CRUD + `run`.
 *
 * Lean path: `prjct task "<desc>"` registers a task, runs the
 * before_task workflow rules, emits a minimal context block, and
 * runs after_task rules. All the agentic orchestration (command
 * executor, loop detector, plan mode, orchestrator-executor,
 * prompt-builder, context-builder) was dropped — it was harness.
 * Context arrives via hooks; Claude pulls on demand via the memory
 * verbs.
 *
 * Implementation lives in `./workflow/`:
 *   - intent.ts        — intent keyword detection + parseAction/searchRules
 *   - rule-actions.ts  — 12 standalone subcommand handlers
 *   - md-helpers.ts    — buildFlowDiagram for `--md` output
 */

import { generateUUID } from '../schemas/schemas'
import { getGitBranch } from '../session/git-helpers'
import { customWorkflowStorage } from '../storage/custom-workflow-storage'
import { stateStorage } from '../storage/state-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import * as dateHelper from '../utils/date-helper'
import { failFromError } from '../utils/md-aware'
import {
  mdActionRequired,
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdSection,
  mdTaskHeader,
} from '../utils/md-formatter'
import { showNextSteps, showStateInfo } from '../utils/next-steps'
import out from '../utils/output'
import { executeWorkflowRules } from '../workflow/workflow-engine'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'
import { detectIntent } from './workflow/intent'
import {
  workflowAdd,
  workflowCreate,
  workflowDelete,
  workflowDisable,
  workflowGate,
  workflowHelp,
  workflowInit,
  workflowInstruction,
  workflowList,
  workflowReset,
  workflowRm,
  workflowShow,
} from './workflow/rule-actions'

export class WorkflowCommands extends PrjctCommandsBase {
  /**
   * `prjct task "<desc>"` — register the task, run before/after rules,
   * emit a lean context block. Everything that used to go through the
   * agentic orchestration stack (commandExecutor → contextBuilder +
   * promptBuilder + orchestratorExecutor) was harness — dropped.
   * Context flows via hooks now; the memory verbs let Claude pull
   * more when it wants it.
   */
  async now(
    task: string | null = null,
    projectPath: string = process.cwd(),
    options: { skipHooks?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const proj = await requireProject(projectPath)
      if (!proj.ok) return proj.result
      const projectId = proj.value

      // No task arg → show the active one (or none).
      if (!task) return this._showActiveTask(projectId, options)

      // before_task workflow rules (gates may block, hooks may nudge).
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

      // Optional Linear issue linkage — matches e.g. `PRJ-42`. Pure tag,
      // no external status transitions (Linear MCP handles those).
      const linearId = /^[A-Z]+-\d+$/.test(task) ? task : undefined
      const taskDescription = task

      const taskId = generateUUID()
      await stateStorage.startTask(projectId, {
        id: taskId,
        description: taskDescription,
        sessionId: generateUUID(),
        linearId,
      } as Parameters<typeof stateStorage.startTask>[1])

      await this.logToMemory(projectPath, 'task_started', {
        task: taskDescription,
        taskId,
        timestamp: dateHelper.getTimestamp(),
      })

      await executeWorkflowRules(projectId, 'task', 'after', {
        projectPath,
        skipRules: options.skipHooks,
      })

      const branch = await getGitBranch(projectPath).catch(() => '')

      if (options.md) {
        console.log(
          mdOutput(
            mdTaskHeader({ description: taskDescription, status: 'active' }),
            mdSection(
              'State',
              mdList(
                [
                  `Task: \`${taskId}\``,
                  branch ? `Branch: \`${branch}\`` : null,
                  linearId ? `Linear: \`${linearId}\`` : null,
                  beforeResult.instructions.length > 0
                    ? `Agent instructions: ${beforeResult.instructions.length}`
                    : null,
                ].filter((s): s is string => s !== null)
              )
            ),
            beforeResult.instructions.length > 0
              ? mdSection('Agent Instructions', mdList(beforeResult.instructions))
              : null,
            mdNextSteps([
              { label: 'Pull project memory', command: 'prjct context memory <topic>' },
              { label: 'Tag the task', command: 'prjct tag type:bug domain:auth' },
              { label: 'Capture learnings', command: 'prjct remember learning "..."' },
              { label: 'Ship when done', command: 'prjct ship --md' },
            ])
          )
        )
      } else {
        out.done(`Task: ${taskDescription}`)
        showStateInfo('working')
        showNextSteps('task')
      }

      return { success: true, task: taskDescription, taskId }
    } catch (error) {
      const msg = getErrorMessage(error)
      if (options.md) console.log(`> ${msg}`)
      else out.fail(msg)
      return { success: false, error: msg }
    }
  }

  /**
   * Render the active task when `prjct task` is called without args.
   * Null-path when nothing's active — clean exit, no pressure.
   */
  private async _showActiveTask(
    projectId: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const active = await stateStorage.getCurrentTask(projectId)
    if (!active) {
      const msg = 'no active task. `prjct task "<description>"` to start one.'
      if (options.md) console.log(`> ${msg}`)
      else out.info(msg)
      return { success: true, message: 'no active task' }
    }
    if (options.md) {
      console.log(
        mdOutput(
          mdTaskHeader({ description: active.description, status: 'active' }),
          mdSection(
            'State',
            mdList(
              [
                `Task: \`${active.id}\``,
                active.branch ? `Branch: \`${active.branch}\`` : null,
                active.linearId ? `Linear: \`${active.linearId}\`` : null,
                `Started: ${active.startedAt}`,
              ].filter((s): s is string => s !== null)
            )
          )
        )
      )
    } else {
      out.info(`Active: ${active.description}`)
    }
    return { success: true, currentTask: active }
  }

  /**
   * `prjct workflow [intent] [args]` — view and manage workflow rules.
   *
   * Detects the intent keyword, dispatches to the matching handler in
   * `./workflow/rule-actions.ts`. Empty input → show all rules.
   */
  async workflow(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const proj = await requireProject(projectPath, options)
      if (!proj.ok) return proj.result
      const projectId = proj.value

      const trimmed = input?.trim() ?? ''

      if (!trimmed) {
        return workflowShow(null, projectId, options)
      }

      const intent = detectIntent(trimmed)

      switch (intent.type) {
        case 'add':
          return workflowAdd(intent.args, projectId, options)
        case 'gate':
          return workflowGate(intent.args, projectId, options)
        case 'instruction':
          return workflowInstruction(intent.args, projectId, options)
        case 'remove':
          return workflowRm(intent.args, projectId, options)
        case 'disable':
          return workflowDisable(intent.args, projectId, options)
        case 'reset':
          return workflowReset(projectId, options)
        case 'init':
          return workflowInit(projectId, projectPath, options)
        case 'help':
          return workflowHelp(options)
        case 'create':
          return workflowCreate(intent.args, projectId, projectPath, options)
        case 'list':
          return workflowList(projectId, options)
        case 'delete':
          return workflowDelete(intent.args, projectId, options)
        case 'run':
          return this.run(intent.args, projectPath, options)
        case 'view':
          return workflowShow(intent.args || null, projectId, options)
        default:
          // Fallback: treat the first token as a command filter for show.
          return workflowShow(trimmed.split(/\s+/)[0]?.toLowerCase() || null, projectId, options)
      }
    } catch (error) {
      if (options.md) {
        console.log(`> Error: ${getErrorMessage(error)}`)
      } else {
        out.fail(getErrorMessage(error))
      }
      return failFromError(error)
    }
  }

  /**
   * Execute a custom workflow (runs all before/after rules).
   */
  async run(
    workflowName: string,
    projectPath: string = process.cwd(),
    options: MdOption = {}
  ): Promise<CommandResult> {
    try {
      const proj = await requireProject(projectPath, options)
      if (!proj.ok) return proj.result
      const projectId = proj.value

      const name = workflowName.trim()
      if (!name) {
        const msg = 'Usage: prjct workflow run <name>'
        if (options.md) console.log(`> ${msg}`)
        else out.warn(msg)
        return { success: false, error: msg }
      }

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
