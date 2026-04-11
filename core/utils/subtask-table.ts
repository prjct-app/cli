/**
 * Subtask Progress Display
 *
 * @see PRJ-138
 * @module utils/subtask-table
 */

import chalk from 'chalk'
import type { SubtaskDisplay } from '../types/utils.js'

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

function getDomainColor(domain: string): (text: string) => string {
  let hash = 0
  for (const char of domain) {
    hash = (hash << 5) - hash + char.charCodeAt(0)
    hash = hash & hash
  }
  const index = Math.abs(hash) % DOMAIN_COLOR_PALETTE.length
  return DOMAIN_COLOR_PALETTE[index]
}

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

function renderSubtaskProgress(subtasks: SubtaskDisplay[]): string {
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

export function printSubtaskProgress(subtasks: SubtaskDisplay[]): void {
  console.log(renderSubtaskProgress(subtasks))
}
