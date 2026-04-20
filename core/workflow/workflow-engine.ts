/**
 * Workflow Engine (v2)
 *
 * Unified rule execution for hooks, gates, steps, and instructions. v2
 * adds:
 *   - conditional rules via `when_expr` (see when-evaluator.ts)
 *   - parallel hook execution (opt-out per rule)
 *   - gate result caching keyed on (files changed, tags, branch)
 *   - `status:<value>` steps routed to the state machine
 */

import chalk from 'chalk'
import { memoryService } from '../services/memory-service'
import { stateStorage } from '../storage/state-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import { getErrorMessage } from '../types/fs'
import type { WorkflowRule } from '../types/storage.js'
import type { WorkflowExecutionResult } from '../types/workflow.js'
import { execAsync } from '../utils/exec'
import { gateCache, hashContext } from './gate-cache'
import { evaluateWhen, type WhenContext } from './when-evaluator'

const STATUS_ACTION_PREFIX = 'status:'

async function runStatusTransition(
  projectId: string,
  projectPath: string,
  target: string
): Promise<void> {
  const active = await stateStorage.getCurrentTask(projectId)
  if (!active) {
    throw new Error(`Cannot transition to '${target}': no active task`)
  }
  await memoryService.log(projectPath, 'status.changed', {
    taskId: active.id,
    from: active.type ?? null,
    to: target,
    source: 'workflow',
  })
}

async function runShellAction(rule: WorkflowRule, projectPath: string): Promise<void> {
  await execAsync(rule.action, {
    timeout: rule.timeoutMs,
    cwd: projectPath,
    env: { ...process.env },
  })
}

async function runRuleAction(
  rule: WorkflowRule,
  projectId: string,
  projectPath: string
): Promise<void> {
  if (rule.action.startsWith(STATUS_ACTION_PREFIX)) {
    const target = rule.action.slice(STATUS_ACTION_PREFIX.length).trim()
    if (!target) throw new Error(`Empty status target in action '${rule.action}'`)
    await runStatusTransition(projectId, projectPath, target)
    return
  }
  await runShellAction(rule, projectPath)
}

async function buildWhenContext(projectId: string, projectPath: string): Promise<WhenContext> {
  let branch = ''
  try {
    const { getGitBranch } = await import('../session/git-helpers')
    branch = (await getGitBranch(projectPath)) || ''
  } catch {
    // Branch detection is best-effort
  }

  let filesChanged: string[] = []
  try {
    const { execSync } = await import('node:child_process')
    const opts = { cwd: projectPath, encoding: 'utf-8' as const }
    const staged = execSync('git diff --cached --name-only', opts)
    const unstaged = execSync('git diff --name-only', opts)
    filesChanged = [
      ...new Set(
        [...staged.split('\n'), ...unstaged.split('\n')].map((l) => l.trim()).filter(Boolean)
      ),
    ]
  } catch {
    // No git / no changes
  }

  let tags: Record<string, string> = {}
  try {
    const active = await stateStorage.getCurrentTask(projectId)
    if (active?.type) tags.type = active.type
    // `task.tagged` events hold the richer tag dictionary — use the most
    // recent one for the active task so `tags:domain=frontend` etc. work.
    const { default: prjctDb } = await import('../storage/database')
    type EvtRow = { data: string }
    const row = prjctDb.get<EvtRow>(
      projectId,
      "SELECT data FROM events WHERE type = 'memory.task.tagged' ORDER BY id DESC LIMIT 1"
    )
    if (row) {
      try {
        const parsed = JSON.parse(row.data) as { taskId?: string; tags?: Record<string, string> }
        if (active && parsed.taskId === active.id && parsed.tags) {
          tags = { ...tags, ...parsed.tags }
        }
      } catch {
        // ignore malformed row
      }
    }
  } catch {
    // Tag lookup is best-effort
  }

  return { branch, filesChanged, tags }
}

export async function executeWorkflowRules(
  projectId: string,
  command: string,
  phase: 'before' | 'after',
  options: { projectPath?: string; skipRules?: boolean } = {}
): Promise<WorkflowExecutionResult> {
  const result: WorkflowExecutionResult = {
    success: true,
    gatesFailed: [],
    hooksFailed: [],
    stepsRun: [],
    instructions: [],
    output: '',
  }

  if (options.skipRules) return result

  const allRules = workflowRuleStorage.getRulesForCommand(projectId, command)
  const phased = allRules.filter((r) => r.position === phase)
  const projectPath = options.projectPath || process.cwd()

  // Build the context once — individual conditional checks reuse it.
  const whenCtx = await buildWhenContext(projectId, projectPath)
  const contextHash = hashContext(whenCtx)

  const rules = phased.filter((r) => evaluateWhen(r.whenExpr, whenCtx))

  // 1. Gates — blocking, with cache. Cache applies only to fresh greens.
  const gates = rules.filter((r) => r.type === 'gate')
  for (const gate of gates) {
    const label = gate.description || gate.action

    if (gateCache.isFresh(projectId, gate.id, contextHash)) {
      console.log(`\n${chalk.dim(`[gate] ${phase}-${command}: ${gate.action}`)}`)
      console.log(`${chalk.green('✓')} ${chalk.dim('gate skipped (cached)')}`)
      continue
    }

    console.log(`\n${chalk.dim(`[gate] ${phase}-${command}: ${gate.action}`)}`)
    try {
      const startTime = Date.now()
      await runRuleAction(gate, projectId, projectPath)
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`gate passed (${timeStr})`)}`)
      gateCache.record(projectId, gate.id, contextHash)
    } catch (error) {
      console.log(`${chalk.red('✗')} gate failed: ${label}`)
      result.gatesFailed.push(label)
      result.success = false
      result.output += `Gate failed: ${label}\n${getErrorMessage(error)}\n`
      return result
    }
  }

  // 2. Instructions — non-blocking, no shell.
  const instructions = rules.filter((r) => r.type === 'instruction')
  for (const instr of instructions) {
    const label = instr.description || instr.action
    console.log(`\n${chalk.dim(`[instruction] ${phase}-${command}: ${label}`)}`)
    result.instructions.push(instr.action)
  }

  // 3. Hooks — non-blocking. Parallel by default (via Promise.all); hooks
  //    with `parallel: false` run sequentially ahead of the batch so
  //    order-dependent cleanups still work.
  const hooks = rules.filter((r) => r.type === 'hook')
  const serialHooks = hooks.filter((h) => h.parallel === false)
  const parallelHooks = hooks.filter((h) => h.parallel !== false)

  const runHook = async (hook: WorkflowRule): Promise<void> => {
    console.log(`\n${chalk.dim(`[hook] ${phase}-${command}: ${hook.action}`)}`)
    try {
      const startTime = Date.now()
      await runRuleAction(hook, projectId, projectPath)
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`(${timeStr})`)}`)
    } catch (error) {
      console.log(`${chalk.yellow('⚠')} hook failed (non-blocking): ${hook.action}`)
      result.hooksFailed.push(hook.description || hook.action)
      result.output += `Hook failed: ${hook.action}\n${getErrorMessage(error)}\n`
    }
  }

  for (const hook of serialHooks) {
    await runHook(hook)
  }
  if (parallelHooks.length > 0) {
    await Promise.all(parallelHooks.map(runHook))
  }

  // 4. Steps — blocking, sequential. `status:<value>` steps drive the
  //    state machine instead of shelling out.
  const steps = rules.filter((r) => r.type === 'step')
  for (const step of steps) {
    console.log(`\n${chalk.dim(`[step] ${command}: ${step.action}`)}`)
    try {
      const startTime = Date.now()
      await runRuleAction(step, projectId, projectPath)
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`step passed (${timeStr})`)}`)
      result.stepsRun.push(step.description || step.action)
    } catch (error) {
      console.log(`${chalk.red('✗')} step failed: ${step.action}`)
      result.gatesFailed.push(step.description || step.action)
      result.success = false
      result.output += `Step failed: ${step.action}\n${getErrorMessage(error)}\n`
      return result
    }
  }

  return result
}
