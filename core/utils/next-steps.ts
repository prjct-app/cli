/**
 * Next Steps - Show explicit guidance after each command
 *
 * Makes the workflow learnable by showing what commands are available
 * after each action.
 */

import chalk from 'chalk'

interface NextStep {
  cmd: string
  desc: string
}

/**
 * Next steps for each command
 */
const NEXT_STEPS: Record<string, NextStep[]> = {
  task: [
    { cmd: 'p. done', desc: 'Complete current subtask' },
    { cmd: 'p. pause', desc: 'Pause and switch context' },
  ],
  done: [
    { cmd: 'p. ship', desc: 'Ship this feature (create PR)' },
    { cmd: 'p. task', desc: 'Start new task' },
    { cmd: 'p. next', desc: 'View task queue' },
  ],
  'done-subtask': [
    { cmd: 'p. done', desc: 'Complete next subtask' },
    { cmd: 'p. ship', desc: 'Ship this feature' },
    { cmd: 'p. pause', desc: 'Pause and switch context' },
  ],
  pause: [
    { cmd: 'p. resume', desc: 'Continue this task' },
    { cmd: 'p. task', desc: 'Start different task' },
    { cmd: 'p. next', desc: 'View task queue' },
  ],
  resume: [
    { cmd: 'p. done', desc: 'Complete current subtask' },
    { cmd: 'p. pause', desc: 'Pause again' },
  ],
  ship: [
    { cmd: 'p. task', desc: 'Start new task' },
    { cmd: 'p. next', desc: 'View task queue' },
  ],
  next: [
    { cmd: 'p. task', desc: 'Start a task' },
    { cmd: 'p. resume', desc: 'Resume paused task' },
  ],
  sync: [
    { cmd: 'p. task', desc: 'Start a task' },
    { cmd: 'p. next', desc: 'View task queue' },
  ],
  init: [
    { cmd: 'p. sync', desc: 'Analyze project' },
    { cmd: 'p. task', desc: 'Start a task' },
  ],
  bug: [
    { cmd: 'p. done', desc: 'Complete bug fix' },
    { cmd: 'p. pause', desc: 'Pause and switch context' },
  ],
  idea: [
    { cmd: 'p. task', desc: 'Start working on idea' },
    { cmd: 'p. next', desc: 'View task queue' },
  ],
}

/**
 * Show next steps after a command
 */
export function showNextSteps(command: string, options: { quiet?: boolean } = {}): void {
  if (options.quiet) return

  const steps = NEXT_STEPS[command]
  if (!steps || steps.length === 0) return

  console.log(chalk.dim('\nNext:'))
  for (const step of steps) {
    const cmd = chalk.cyan(step.cmd.padEnd(12))
    console.log(chalk.dim(`  ${cmd} → ${step.desc}`))
  }
}

/**
 * Get next steps for a command (for programmatic use)
 */
export function getNextSteps(command: string): NextStep[] {
  return NEXT_STEPS[command] || []
}

export default { showNextSteps, getNextSteps }
