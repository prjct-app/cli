/**
 * Next Steps - Show explicit guidance after each command
 *
 * Uses the workflow state machine to show valid commands
 * for the current state.
 */

import chalk from 'chalk'
import type { WorkflowState } from '../types/workflow'
import { workflowStateMachine } from '../workflow/state-machine'

interface NextStep {
  cmd: string
  desc: string
}

/**
 * Command descriptions for display
 */
const CMD_DESCRIPTIONS: Record<string, string> = {
  task: 'Start new task',
  done: 'Complete current task',
  pause: 'Pause and switch context',
  resume: 'Continue paused task',
  ship: 'Ship the feature',
  reopen: 'Reopen for rework',
  next: 'View task queue',
  sync: 'Analyze project',
  bug: 'Report a bug',
  idea: 'Capture an idea',
}

/**
 * Map command to resulting workflow state
 */
const COMMAND_TO_STATE: Record<string, WorkflowState> = {
  task: 'working',
  done: 'completed',
  'done-subtask': 'working', // Still working on subtasks
  pause: 'paused',
  resume: 'working',
  ship: 'shipped',
  reopen: 'working',
  next: 'idle',
  sync: 'idle',
  init: 'idle',
  bug: 'working',
  idea: 'idle',
}

/**
 * Show next steps after a command
 */
export function showNextSteps(command: string, options: { quiet?: boolean } = {}): void {
  if (options.quiet) return

  // Get the state after this command
  const resultingState = COMMAND_TO_STATE[command] || 'idle'

  // Get valid commands for that state
  const validCommands = workflowStateMachine.getValidCommands(resultingState)

  if (validCommands.length === 0) return

  const steps: NextStep[] = validCommands.map((cmd) => ({
    cmd: `p. ${cmd}`,
    desc: CMD_DESCRIPTIONS[cmd] || cmd,
  }))

  console.log(chalk.dim('\nNext:'))
  for (const step of steps) {
    const cmd = chalk.cyan(step.cmd.padEnd(12))
    console.log(chalk.dim(`  ${cmd} → ${step.desc}`))
  }
}

/**
 * Get next steps for a command (for programmatic use)
 */
export function getNextSteps(command: string, md = false): NextStep[] {
  const resultingState = COMMAND_TO_STATE[command] || 'idle'
  const validCommands = workflowStateMachine.getValidCommands(resultingState)

  return validCommands.map((cmd) => ({
    cmd: md ? `prjct ${cmd} --md` : `p. ${cmd}`,
    desc: CMD_DESCRIPTIONS[cmd] || cmd,
  }))
}

/**
 * Show current state info
 */
export function showStateInfo(state: WorkflowState): void {
  const info = workflowStateMachine.getStateInfo(state)
  console.log(chalk.dim(`📍 State: ${chalk.white(state.toUpperCase())} - ${info.description}`))
}
