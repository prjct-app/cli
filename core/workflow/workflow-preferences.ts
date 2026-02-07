/**
 * Workflow Preferences - Natural Language Driven Hooks
 *
 * Users configure workflow hooks via natural language.
 * The LLM interprets preferences and stores them in memory.
 *
 * Scopes:
 * - permanent: persisted via memorySystem.recordDecision()
 * - session: in-memory Map, cleared on process exit
 * - once: consumed after first use
 *
 * @see PRJ-137
 * @module workflow/workflow-preferences
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import chalk from 'chalk'
import memorySystem from '../agentic/memory-system'
import { WORKFLOW_HELP } from '../constants'
import type {
  HookCommand,
  HookPhase,
  HookResult,
  PreferenceScope,
  WorkflowPreference,
} from '../types'
import { getErrorMessage } from '../types/fs'

const execAsync = promisify(exec)

export type {
  HookCommand,
  HookPhase,
  HookResult,
  PreferenceScope,
  WorkflowPreference,
} from '../types'

// Session and once preferences (in-memory)
const sessionPreferences: Map<string, WorkflowPreference> = new Map()
const oncePreferences: Map<string, WorkflowPreference> = new Map()

/**
 * Generate a key for a preference
 */
function prefKey(hook: HookPhase, command: HookCommand): string {
  return `workflow:${hook}_${command}`
}

/**
 * Set a workflow preference
 */
export async function setWorkflowPreference(
  projectId: string,
  pref: WorkflowPreference
): Promise<void> {
  const key = prefKey(pref.hook, pref.command)

  switch (pref.scope) {
    case 'permanent':
      // Use memory system for persistent storage
      await memorySystem.recordDecision(projectId, key, pref.action, 'workflow')
      break
    case 'session':
      sessionPreferences.set(key, pref)
      break
    case 'once':
      oncePreferences.set(key, pref)
      break
  }
}

/**
 * Get workflow preferences for a command
 * Combines permanent + session + once preferences
 */
export async function getWorkflowPreferences(
  projectId: string,
  command: HookCommand
): Promise<{
  before?: string
  after?: string
  skip?: boolean
}> {
  const result: {
    before?: string
    after?: string
    skip?: boolean
  } = {}

  // Check each phase
  for (const phase of ['before', 'after', 'skip'] as const) {
    const key = prefKey(phase, command)

    // Check once first (highest priority)
    const once = oncePreferences.get(key)
    if (once) {
      if (phase === 'skip') {
        result.skip = once.action === 'true'
      } else {
        result[phase] = once.action
      }
      continue
    }

    // Check session
    const session = sessionPreferences.get(key)
    if (session) {
      if (phase === 'skip') {
        result.skip = session.action === 'true'
      } else {
        result[phase] = session.action
      }
      continue
    }

    // Check permanent (via memory system)
    const permanent = await memorySystem.getSmartDecision(projectId, key)
    if (permanent) {
      if (phase === 'skip') {
        result.skip = permanent === 'true'
      } else {
        result[phase] = permanent
      }
    }
  }

  return result
}

/**
 * Run workflow hooks for a command
 * Consumes 'once' preferences after use
 */
export async function runWorkflowHooks(
  projectId: string,
  phase: 'before' | 'after',
  command: HookCommand,
  options: { projectPath?: string; skipHooks?: boolean } = {}
): Promise<HookResult> {
  if (options.skipHooks) {
    return { success: true }
  }

  const prefs = await getWorkflowPreferences(projectId, command)

  // Check if this step should be skipped
  if (prefs.skip) {
    return { success: true, skipped: [command] }
  }

  const action = prefs[phase]
  if (!action) {
    return { success: true }
  }

  // Consume 'once' preference if it exists
  const key = prefKey(phase, command)
  if (oncePreferences.has(key)) {
    oncePreferences.delete(key)
  }

  console.log(`\n${chalk.dim(`Running ${phase}-${command}: ${action}`)}`)

  try {
    const startTime = Date.now()
    await execAsync(action, {
      timeout: 60000,
      cwd: options.projectPath || process.cwd(),
      env: { ...process.env },
    })
    const elapsed = Date.now() - startTime
    const timeStr = elapsed > 1000 ? `${(elapsed / 1000).toFixed(1)}s` : `${elapsed}ms`
    console.log(`${chalk.green('✓')} ${chalk.dim(`(${timeStr})`)}`)
    return { success: true }
  } catch (error) {
    console.log(chalk.red('✗ failed'))
    const errorMessage = getErrorMessage(error) || 'Unknown error'
    console.log(chalk.dim(errorMessage.split('\n')[0]))
    return { success: false, failed: action, output: errorMessage }
  }
}

/**
 * List all workflow preferences for a project
 */
export async function listWorkflowPreferences(projectId: string): Promise<
  Array<{
    key: string
    action: string
    scope: PreferenceScope
  }>
> {
  const results: Array<{
    key: string
    action: string
    scope: PreferenceScope
  }> = []

  const commands: HookCommand[] = ['task', 'done', 'ship', 'sync']
  const phases: HookPhase[] = ['before', 'after', 'skip']

  for (const command of commands) {
    for (const phase of phases) {
      const key = prefKey(phase, command)

      // Check once
      const once = oncePreferences.get(key)
      if (once) {
        results.push({ key: `${phase} ${command}`, action: once.action, scope: 'once' })
        continue
      }

      // Check session
      const session = sessionPreferences.get(key)
      if (session) {
        results.push({ key: `${phase} ${command}`, action: session.action, scope: 'session' })
        continue
      }

      // Check permanent
      const permanent = await memorySystem.getSmartDecision(projectId, key)
      if (permanent) {
        results.push({ key: `${phase} ${command}`, action: permanent, scope: 'permanent' })
      }
    }
  }

  return results
}

/**
 * Remove a workflow preference
 */
export async function removeWorkflowPreference(
  projectId: string,
  hook: HookPhase,
  command: HookCommand
): Promise<boolean> {
  const key = prefKey(hook, command)

  // Remove from all scopes
  oncePreferences.delete(key)
  sessionPreferences.delete(key)

  // For permanent, we record an empty value
  // (the memory system will treat low-confidence empty values as non-existent)
  await memorySystem.recordDecision(projectId, key, '', 'workflow:remove')

  return true
}

/**
 * Format workflow preferences for display
 */
export function formatWorkflowPreferences(
  preferences: Array<{
    key: string
    action: string
    scope: PreferenceScope
  }>
): string {
  if (preferences.length === 0) {
    return `${chalk.dim(WORKFLOW_HELP.NO_PREFERENCES)}\n\nSet one: "${WORKFLOW_HELP.SET_EXAMPLE}"`
  }

  const lines: string[] = ['', 'WORKFLOW PREFERENCES', '────────────────────────────']

  for (const pref of preferences) {
    const scopeBadge =
      pref.scope === 'permanent'
        ? chalk.green('permanent')
        : pref.scope === 'session'
          ? chalk.yellow('session')
          : chalk.dim('once')

    lines.push(`  [${scopeBadge}] ${pref.key.padEnd(15)} → ${pref.action}`)
  }

  lines.push('')
  lines.push(chalk.dim(`Modify: "${WORKFLOW_HELP.MODIFY_EXAMPLE}"`))
  lines.push(chalk.dim(`Remove: "${WORKFLOW_HELP.REMOVE_EXAMPLE}"`))

  return lines.join('\n')
}

/**
 * Clear all session preferences (for testing)
 */
export function clearSessionPreferences(): void {
  sessionPreferences.clear()
  oncePreferences.clear()
}
