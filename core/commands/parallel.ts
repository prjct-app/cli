/**
 * Parallel Commands - Multi-agent session management
 *
 * Manages parallel agent sessions across git worktrees.
 * Works with or without issue trackers (Linear/Jira).
 *
 * Dispatch sources:
 * - Queue: take tasks from prjct backlog (no tracker needed)
 * - Manual: batch-spawn from inline task descriptions
 * - Linear/Jira: fetch from issue tracker via MCP
 *
 * Commands:
 * - status: show all active sessions/worktrees
 * - spawn <task>: create one worktree + start task
 * - plan [--from-queue|--from-linear|--from-jira] [--max N]: create dispatch plan
 * - dispatch: execute the plan — create worktrees for each task
 * - join: converge completed branches
 * - cleanup: remove completed worktrees
 */

import configManager from '../infrastructure/config-manager'
import { generateUUID } from '../schemas/schemas'
import type { DispatchPlan } from '../services/ticket-dispatcher'
import taskDispatcher from '../services/ticket-dispatcher'
import worktreeService from '../services/worktree-service'
import { stateStorage } from '../storage/state-storage'
import type { CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import { PrjctCommandsBase } from './base'

/** In-memory plan storage (lives for the session) */
let currentPlan: DispatchPlan | null = null

export class ParallelCommands extends PrjctCommandsBase {
  /**
   * Main entry point for parallel commands
   */
  async parallel(
    subcommand: string | null = null,
    projectPath: string = process.cwd(),
    options: {
      md?: boolean
      max?: number
      fromQueue?: boolean
      fromLinear?: boolean
      fromJira?: boolean
      includeBacklog?: boolean
      strategy?: string
    } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)

      switch (subcommand) {
        case 'status':
          return this.status(projectId, projectPath)
        case 'plan':
          return this.plan(projectId, projectPath, options)
        case 'dispatch':
          return this.dispatch(projectId, projectPath)
        case 'spawn':
          return { success: false, error: 'Usage: prjct parallel spawn <task-description>' }
        case 'join':
          return this.join(projectId, projectPath)
        case 'cleanup':
          return this.cleanup(projectPath)
        default:
          return this.status(projectId, projectPath)
      }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Spawn a single task in a new worktree
   */
  async spawn(
    taskDescription: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean; branch?: string } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      const slug = this.slugify(taskDescription)
      const worktree = await worktreeService.create(projectPath, slug, {
        branch: options.branch,
      })
      await worktreeService.setup(worktree.path, projectPath)

      const workspaceId = generateUUID()
      await stateStorage.startTaskInWorkspace(
        projectId,
        {
          id: generateUUID(),
          description: taskDescription,
          sessionId: generateUUID(),
          workspaceId,
          worktreePath: worktree.path,
        },
        workspaceId
      )

      out.success(`Worktree: ${worktree.path}`)
      out.info(`Branch: ${worktree.branch}`)
      out.info(`Task: ${taskDescription}`)

      return { success: true, message: `Worktree created at ${worktree.path}` }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Batch spawn multiple tasks at once (no tracker needed).
   * Each description becomes a worktree + agent session.
   */
  async batchSpawn(
    descriptions: string[],
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      const results: string[] = []

      for (const desc of descriptions) {
        const slug = this.slugify(desc)
        try {
          const worktree = await worktreeService.create(projectPath, slug)
          await worktreeService.setup(worktree.path, projectPath)

          const workspaceId = generateUUID()
          await stateStorage.startTaskInWorkspace(
            projectId,
            {
              id: generateUUID(),
              description: desc,
              sessionId: generateUUID(),
              workspaceId,
              worktreePath: worktree.path,
            },
            workspaceId
          )
          results.push(`  ${worktree.branch} → ${desc}`)
        } catch (error) {
          results.push(`  FAILED: ${desc} — ${getErrorMessage(error)}`)
        }
      }

      out.success(`Spawned ${results.length} agent sessions:`)
      for (const r of results) out.info(r)

      return { success: true, message: `Spawned ${results.length} sessions` }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  // ===========================================================================
  // Plan: Build dispatch plan from any source
  // ===========================================================================

  private async plan(
    projectId: string,
    _projectPath: string,
    options: {
      max?: number
      fromQueue?: boolean
      fromLinear?: boolean
      fromJira?: boolean
      includeBacklog?: boolean
      strategy?: string
    }
  ): Promise<CommandResult> {
    const maxAgents = options.max || 10
    const strategy = (options.strategy as DispatchPlan['strategy']) || 'priority-first'

    // Determine source
    if (options.fromLinear) {
      const instructions = taskDispatcher.generateFetchInstructions('linear', {
        maxResults: maxAgents,
      })
      out.info('Linear MCP instructions for orchestrating agent:')
      out.info('')
      out.info(instructions)
      out.info('')
      out.info('After fetching, pass the results to `prjct parallel dispatch`.')
      return { success: true, message: instructions }
    }

    if (options.fromJira) {
      const instructions = taskDispatcher.generateFetchInstructions('jira', {
        sprint: true,
        maxResults: maxAgents,
      })
      out.info('Jira MCP instructions for orchestrating agent:')
      out.info('')
      out.info(instructions)
      return { success: true, message: instructions }
    }

    // Default: from queue (no tracker needed)
    const plan = await taskDispatcher.planFromQueue(projectId, {
      maxAgents,
      strategy,
      includeBacklog: options.includeBacklog,
    })

    if (plan.items.length === 0) {
      out.warn('No tasks in queue. Add tasks with `prjct bug` or `prjct idea`, then retry.')
      out.info('Or use `prjct parallel spawn <task>` to create individual sessions.')
      out.info('Or use `prjct parallel batch "task1" "task2" "task3"` for inline dispatch.')
      return { success: true, message: 'Empty queue' }
    }

    currentPlan = plan
    out.success(`Dispatch plan created (${plan.items.length} tasks from queue):`)
    out.info('')
    out.info(taskDispatcher.formatPlan(plan))

    return { success: true, message: `Plan: ${plan.items.length} tasks` }
  }

  // ===========================================================================
  // Dispatch: Execute plan — create worktrees + assign tasks
  // ===========================================================================

  private async dispatch(projectId: string, projectPath: string): Promise<CommandResult> {
    if (!currentPlan || currentPlan.items.length === 0) {
      out.warn('No dispatch plan. Run `prjct parallel plan` first, or use `prjct parallel spawn`.')
      return { success: false, error: 'No plan' }
    }

    const results: string[] = []
    let created = 0

    for (const item of currentPlan.items) {
      const slug = taskDispatcher.slugify(item)
      try {
        const worktree = await worktreeService.create(projectPath, slug)
        await worktreeService.setup(worktree.path, projectPath)

        const workspaceId = generateUUID()
        await stateStorage.startTaskInWorkspace(
          projectId,
          {
            id: generateUUID(),
            description: item.title,
            sessionId: generateUUID(),
            workspaceId,
            worktreePath: worktree.path,
            linearId: item.linearId,
            jiraId: item.jiraId,
            dispatchedFrom: currentPlan.source,
          },
          workspaceId
        )

        results.push(`  ${worktree.branch} → ${item.title.slice(0, 60)}`)
        created++
      } catch (error) {
        results.push(`  FAILED: ${item.title.slice(0, 40)} — ${getErrorMessage(error)}`)
      }
    }

    currentPlan = null // consumed

    out.success(`Dispatched ${created}/${results.length} agent sessions:`)
    for (const r of results) out.info(r)
    out.info('')
    out.info('Start Claude Code / AI agent sessions in each worktree to begin work.')
    out.info('Use `prjct parallel status` to monitor progress.')

    return { success: true, message: `Dispatched ${created} sessions` }
  }

  // ===========================================================================
  // Status: Show all active parallel sessions
  // ===========================================================================

  private async status(projectId: string, projectPath: string): Promise<CommandResult> {
    const [activeTasks, worktrees] = await Promise.all([
      stateStorage.getActiveTasks(projectId),
      worktreeService.list(projectPath),
    ])
    const currentTask = await stateStorage.getCurrentTask(projectId)

    if (currentTask) {
      out.info(`Main worktree: ${currentTask.description}`)
    }

    if (activeTasks.length > 0) {
      out.info(`\nParallel sessions (${activeTasks.length}):`)
      for (const task of activeTasks) {
        const wt = worktrees.find((w) => w.path === task.worktreePath)
        const branch = wt?.branch || '?'
        const ticket = task.linearId || task.jiraId || ''
        const ticketTag = ticket ? ` [${ticket}]` : ''
        out.info(`  ${task.workspaceId.slice(0, 8)} | ${branch} | ${task.description}${ticketTag}`)
      }
    } else if (!currentTask) {
      out.info('No active sessions.')
      out.info('')
      out.info('Start parallel agents:')
      out.info('  prjct parallel spawn <task>          — single worktree')
      out.info('  prjct parallel plan [--max 10]       — plan from queue')
      out.info('  prjct parallel plan --from-linear    — plan from Linear')
      out.info('  prjct parallel dispatch              — execute plan')
    }

    const nonMain = worktrees.filter((w) => !w.isMain).length
    if (nonMain > 0) {
      out.info(`\nWorktrees: ${worktrees.length} total (${nonMain} agent)`)
    }

    return { success: true }
  }

  // ===========================================================================
  // Join: Converge completed branches
  // ===========================================================================

  private async join(projectId: string, projectPath: string): Promise<CommandResult> {
    const activeTasks = await stateStorage.getActiveTasks(projectId)
    const worktrees = await worktreeService.list(projectPath)

    // Find worktrees that no longer have active tasks (completed)
    const activeWorktreePaths = new Set(activeTasks.map((t) => t.worktreePath).filter(Boolean))
    const completedWorktrees = worktrees.filter(
      (w) => !w.isMain && !activeWorktreePaths.has(w.path)
    )

    if (completedWorktrees.length === 0) {
      out.info(`All ${activeTasks.length} sessions still active. Nothing to join yet.`)
      return { success: true }
    }

    out.success(`${completedWorktrees.length} completed worktree(s) ready to join:`)
    for (const wt of completedWorktrees) {
      out.info(`  ${wt.branch} (${wt.slug})`)
    }
    out.info('')
    out.info('Create PRs for each branch, then `prjct parallel cleanup` to remove worktrees.')

    return { success: true }
  }

  // ===========================================================================
  // Cleanup: Remove completed worktrees
  // ===========================================================================

  private async cleanup(projectPath: string): Promise<CommandResult> {
    const removed = await worktreeService.clean(projectPath)
    out.success(`Cleaned up ${removed.length} stale worktree reference(s).`)
    return { success: true }
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40)
  }
}

export const parallelCommands = new ParallelCommands()
