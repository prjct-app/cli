/**
 * Subtask Progress Display
 *
 * Clean, minimal visual display of subtask progress.
 * No tables - just a clean list with animated status.
 *
 * @see PRJ-138
 * @module utils/subtask-table
 */

// ANSI codes
const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const WHITE = '\x1b[37m'
const GRAY = '\x1b[90m'

// Color palette for domains (cycle through these)
const DOMAIN_COLOR_PALETTE = [
  '\x1b[36m', // Cyan
  '\x1b[35m', // Magenta
  '\x1b[33m', // Yellow
  '\x1b[34m', // Blue
  '\x1b[32m', // Green
  '\x1b[91m', // Light Red
  '\x1b[95m', // Light Magenta
  '\x1b[96m', // Light Cyan
]

/**
 * Get consistent color for a domain name using hash
 * Same domain name always returns same color
 */
function getDomainColor(domain: string): string {
  let hash = 0
  for (const char of domain) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash = hash & hash
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTE.length
  return DOMAIN_COLOR_PALETTE[index]
}

// Hide/show cursor
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
  const num = `${DIM}${String(index + 1).padStart(2)}${RESET}`
  const domainColor = getDomainColor(subtask.domain)
  const domain = `${domainColor}${subtask.domain.padEnd(10)}${RESET}`
  const desc =
    subtask.description.length > 32
      ? `${subtask.description.slice(0, 29)}...`
      : subtask.description.padEnd(32)

  let status: string
  switch (subtask.status) {
    case 'completed':
      status = `${GREEN}✓ Complete${RESET}`
      break
    case 'in_progress':
      status = `${YELLOW}${spinnerFrame} Working...${RESET}`
      break
    case 'pending':
      status = `${GRAY}○ Pending${RESET}`
      break
    case 'failed':
      status = `\x1b[31m✗ Failed${RESET}`
      break
    case 'blocked':
      status = `${GRAY}⊘ Blocked${RESET}`
      break
    default:
      status = `${GRAY}○ ${subtask.status}${RESET}`
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
  lines.push(`  ${BOLD}${WHITE}SUBTASK PROGRESS${RESET}`)
  lines.push(`  ${DIM}${'─'.repeat(58)}${RESET}`)

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
    lines.push(`  ${BOLD}${WHITE}SUBTASK PROGRESS${RESET}`)
    lines.push(`  ${DIM}${'─'.repeat(58)}${RESET}`)

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
      finalLines.push(`  ${BOLD}${WHITE}SUBTASK PROGRESS${RESET}`)
      finalLines.push(`  ${DIM}${'─'.repeat(58)}${RESET}`)
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
  return `  ${DIM}Progress:${RESET} ${completed}/${total} subtasks complete`
}

// Legacy exports for backwards compatibility
export const renderSubtaskTable = renderSubtaskProgress
export const printSubtaskTable = printSubtaskProgress
