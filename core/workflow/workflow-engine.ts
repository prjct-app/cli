/**
 * Workflow Engine (Phase 2)
 *
 * Unified rule execution for hooks, gates, and steps.
 * Replaces runWorkflowHooks() as the single entry point.
 */

import chalk from 'chalk'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import { getErrorMessage } from '../types/fs'
import type { WorkflowExecutionResult } from '../types/workflow.js'
import { execAsync } from '../utils/exec'

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

  // 1. Get rules from the new workflow_rules table
  const allRules = workflowRuleStorage.getRulesForCommand(projectId, command)
  const rules = allRules.filter((r) => r.position === phase)

  // 2. Run gates first (before phase only) — ALL must pass
  const gates = rules.filter((r) => r.type === 'gate')
  for (const gate of gates) {
    const label = gate.description || gate.action
    console.log(`\n${chalk.dim(`[gate] ${phase}-${command}: ${gate.action}`)}`)

    try {
      const startTime = Date.now()
      await execAsync(gate.action, {
        timeout: gate.timeoutMs,
        cwd: options.projectPath || process.cwd(),
        env: { ...process.env },
      })
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`gate passed (${timeStr})`)}`)
    } catch (error) {
      console.log(`${chalk.red('✗')} gate failed: ${label}`)
      result.gatesFailed.push(label)
      result.success = false
      result.output += `Gate failed: ${label}\n${getErrorMessage(error)}\n`
      return result // gates are blocking — stop immediately
    }
  }

  // 3. Collect instructions (informational, non-blocking, no shell execution)
  const instructions = rules.filter((r) => r.type === 'instruction')
  for (const instr of instructions) {
    const label = instr.description || instr.action
    console.log(`\n${chalk.dim(`[instruction] ${phase}-${command}: ${label}`)}`)
    result.instructions.push(instr.action)
  }

  // 4. Run hooks (non-blocking)
  const hooks = rules.filter((r) => r.type === 'hook')
  for (const hook of hooks) {
    console.log(`\n${chalk.dim(`[hook] ${phase}-${command}: ${hook.action}`)}`)

    try {
      const startTime = Date.now()
      await execAsync(hook.action, {
        timeout: hook.timeoutMs,
        cwd: options.projectPath || process.cwd(),
        env: { ...process.env },
      })
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`(${timeStr})`)}`)
    } catch (error) {
      console.log(`${chalk.yellow('⚠')} hook failed (non-blocking): ${hook.action}`)
      result.hooksFailed.push(hook.description || hook.action)
      result.output += `Hook failed: ${hook.action}\n${getErrorMessage(error)}\n`
    }
  }

  // 5. Run steps (blocking, used for ship pipeline)
  const steps = rules.filter((r) => r.type === 'step')
  for (const step of steps) {
    console.log(`\n${chalk.dim(`[step] ${command}: ${step.action}`)}`)

    try {
      const startTime = Date.now()
      await execAsync(step.action, {
        timeout: step.timeoutMs,
        cwd: options.projectPath || process.cwd(),
        env: { ...process.env },
      })
      const elapsed = Date.now() - startTime
      const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
      console.log(`${chalk.green('✓')} ${chalk.dim(`step passed (${timeStr})`)}`)
      result.stepsRun.push(step.description || step.action)
    } catch (error) {
      console.log(`${chalk.red('✗')} step failed: ${step.action}`)
      result.gatesFailed.push(step.description || step.action)
      result.success = false
      result.output += `Step failed: ${step.action}\n${getErrorMessage(error)}\n`
      return result // steps block on failure
    }
  }

  return result
}
