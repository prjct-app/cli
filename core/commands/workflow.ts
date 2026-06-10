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

import { collectActiveTasks } from '../services/task-overview'
import { startTask } from '../services/task-service'
import { customWorkflowStorage } from '../storage/custom-workflow-storage'
import type { MdOption } from '../types/cli'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
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
import { executeWorkflowRules } from '../workflow-engine/workflow-engine'
import { PrjctCommandsBase } from './base'
import { requireProject } from './guards'
import { detectIntent } from './workflow/intent'
import {
  workflowAdd,
  workflowDisable,
  workflowGate,
  workflowInstruction,
  workflowReset,
  workflowRm,
} from './workflow/rule-actions/rules'
import { workflowHelp, workflowShow } from './workflow/rule-actions/show'
import {
  workflowCreate,
  workflowDelete,
  workflowInit,
  workflowList,
} from './workflow/rule-actions/workflows'

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
    options: { skipHooks?: boolean; md?: boolean; spec?: string } = {}
  ): Promise<CommandResult> {
    try {
      const proj = await requireProject(projectPath)
      if (!proj.ok) return proj.result
      const projectId = proj.value

      // No task arg → show the active one (or none).
      if (!task) return this._showActiveTask(projectId, projectPath, options)

      // Side-effecting core lives in task-service so the MCP write-path
      // fires identical gates/state/memory without printing to stdout.
      const outcome = await startTask(projectId, projectPath, task, {
        skipHooks: options.skipHooks,
        spec: options.spec,
      })
      if (!outcome.ok) {
        return { success: false, error: outcome.blocked ?? 'Task start blocked' }
      }

      const taskDescription = outcome.description ?? task
      const taskId = outcome.taskId ?? ''
      const linearId = outcome.linearId
      const branch = outcome.branch ?? ''
      const beforeInstructions = outcome.instructions ?? []

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
                  beforeInstructions.length > 0
                    ? `Agent instructions: ${beforeInstructions.length}`
                    : null,
                ].filter((s): s is string => s !== null)
              )
            ),
            beforeInstructions.length > 0
              ? mdSection('Agent Instructions', mdList(beforeInstructions))
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
    projectPath: string,
    options: { md?: boolean }
  ): Promise<CommandResult> {
    const overview = await collectActiveTasks(projectId, projectPath)
    const active = overview.current
    const others = overview.all.filter((v) => !v.isCurrent)

    if (!active) {
      // Nothing in THIS worktree — but sibling worktrees may be busy.
      const base = 'no active task. `prjct task "<description>"` to start one.'
      const hint =
        others.length > 0
          ? `\n${others.length} active in other workspace(s):\n${others
              .map((v) => `  ${v.label}    ${v.description}`)
              .join('\n')}`
          : ''
      const msg = base + hint
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
                `Workspace: \`${active.label}\``,
                active.branch ? `Branch: \`${active.branch}\`` : null,
                active.linearId ? `Linear: \`${active.linearId}\`` : null,
                `Started: ${active.startedAt}`,
                others.length > 0 ? `Other active workspaces: ${others.length}` : null,
              ].filter((s): s is string => s !== null)
            )
          ),
          others.length > 0
            ? mdSection(
                'Other Active Workspaces',
                mdList(others.map((v) => `${v.label} — ${v.description}`))
              )
            : null
        )
      )
    } else {
      out.info(`Active: ${active.description}`)
      out.info(`Workspace: ${active.label}`)
      for (const v of others) out.info(`  other: ${v.label} — ${v.description}`)
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
