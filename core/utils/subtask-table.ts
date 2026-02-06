/**
 * Subtask Progress Display
 *
 * Clean, minimal visual display of subtask progress.
 * No tables - just a clean list with animated status.
 *
 * @see PRJ-138
 * @module utils/subtask-table
 */

import chalk from 'chalk'

// Color palette for domains (cycle through these)
const DOMAIN_COLOR_PALETTE = [
  chalk.cyan,
  chalk.magenta,
  chalk.yellow,
  chalk.blue,
  chalk.green,
  chalk.redBright,
  chalk.magentaBright,
  chalk.cyanBright,
]

/**
 * Get consistent color for a domain name using hash
 * Same domain name always returns same color
 */
function getDomainColor(domain: string): (text: string) => string {
  let hash = 0
  for (const char of domain) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash = hash & hash
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTE.length
  return DOMAIN_COLOR_PALETTE[index]
}

// Terminal control sequences (not colors - chalk doesn't handle these)
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'

// Spinner frames (dots animation)
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export type SubtaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

export interface SubtaskDisplay {
  id: string
  domain: string
  description: string
  status: SubtaskStatus
}

/**
 * Format a single subtask line
 */
function formatSubtaskLine(
  index: number,
  subtask: SubtaskDisplay,
  spinnerFrame: string = '▶'
): string {
  const num = chalk.dim(String(index + 1).padStart(2))
  const domainColorFn = getDomainColor(subtask.domain)
  const domain = domainColorFn(subtask.domain.padEnd(10))
  const desc =
    subtask.description.length > 32
      ? `${subtask.description.slice(0, 29)}...`
      : subtask.description.padEnd(32)

  let status: string
  switch (subtask.status) {
    case 'completed':
      status = chalk.green('✓ Complete')
      break
    case 'in_progress':
      status = chalk.yellow(`${spinnerFrame} Working...`)
      break
    case 'pending':
      status = chalk.gray('○ Pending')
      break
    case 'failed':
      status = chalk.red('✗ Failed')
      break
    case 'blocked':
      status = chalk.gray('⊘ Blocked')
      break
    default:
      status = chalk.gray(`○ ${subtask.status}`)
  }

  return `  ${num}   ${domain} ${desc}  ${status}`
}

/**
 * Render static subtask progress (no animation)
 */
export function renderSubtaskProgress(subtasks: SubtaskDisplay[]): string {
  if (subtasks.length === 0) return ''

  const lines: string[] = []

  lines.push('')
  lines.push(`  ${chalk.bold.white('SUBTASK PROGRESS')}`)
  lines.push(`  ${chalk.dim('─'.repeat(58))}`)

  for (let i = 0; i < subtasks.length; i++) {
    lines.push(formatSubtaskLine(i, subtasks[i]))
  }

  lines.push('')

  return lines.join('\n')
}

/**
 * Print static subtask progress
 */
export function printSubtaskProgress(subtasks: SubtaskDisplay[]): void {
  console.log(renderSubtaskProgress(subtasks))
}

/**
 * Animated subtask progress with spinner
 * Returns a controller to update/stop the animation
 */
export function createSubtaskAnimation(subtasks: SubtaskDisplay[]) {
  let frameIndex = 0
  let intervalId: ReturnType<typeof setInterval> | null = null
  let lastOutput = ''

  const render = () => {
    const spinnerFrame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length]
    const lines: string[] = []

    lines.push('')
    lines.push(`  ${chalk.bold.white('SUBTASK PROGRESS')}`)
    lines.push(`  ${chalk.dim('─'.repeat(58))}`)

    for (let i = 0; i < subtasks.length; i++) {
      lines.push(formatSubtaskLine(i, subtasks[i], spinnerFrame))
    }

    lines.push('')

    return lines.join('\n')
  }

  const clear = () => {
    if (lastOutput) {
      const lineCount = lastOutput.split('\n').length
      // Move up and clear each line
      process.stdout.write(`\x1b[${lineCount}A`)
      for (let i = 0; i < lineCount; i++) {
        process.stdout.write('\x1b[2K\n')
      }
      process.stdout.write(`\x1b[${lineCount}A`)
    }
  }

  const draw = () => {
    clear()
    lastOutput = render()
    process.stdout.write(lastOutput)
    frameIndex++
  }

  return {
    /**
     * Start the animation
     */
    start: () => {
      process.stdout.write(HIDE_CURSOR)
      lastOutput = render()
      process.stdout.write(lastOutput)
      intervalId = setInterval(draw, 80)
    },

    /**
     * Update subtask status
     */
    update: (index: number, status: SubtaskStatus) => {
      if (index >= 0 && index < subtasks.length) {
        subtasks[index].status = status
      }
    },

    /**
     * Stop animation and show final state
     */
    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      clear()
      // Print final state with static icons
      const finalLines: string[] = []
      finalLines.push('')
      finalLines.push(`  ${chalk.bold.white('SUBTASK PROGRESS')}`)
      finalLines.push(`  ${chalk.dim('─'.repeat(58))}`)
      for (let i = 0; i < subtasks.length; i++) {
        finalLines.push(formatSubtaskLine(i, subtasks[i], '▶'))
      }
      finalLines.push('')
      process.stdout.write(finalLines.join('\n'))
      process.stdout.write(SHOW_CURSOR)
    },

    /**
     * Get current subtasks state
     */
    getSubtasks: () => [...subtasks],
  }
}

/**
 * Simple progress line
 * Output: "Progress: 2/4 subtasks complete"
 */
export function renderProgressLine(completed: number, total: number): string {
  return `  ${chalk.dim('Progress:')} ${completed}/${total} subtasks complete`
}

// Legacy exports for backwards compatibility
export const renderSubtaskTable = renderSubtaskProgress
export const printSubtaskTable = printSubtaskProgress
