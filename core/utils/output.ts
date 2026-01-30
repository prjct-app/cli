/**
 * Unified Output System for prjct-cli
 * Spinner while working → Single line result
 * With prjct branding
 *
 * Supports --quiet mode for CI/CD and scripting
 *
 * @see PRJ-130
 */

import chalk from 'chalk'
import branding from './branding'
import type { ErrorCode, ErrorWithHint } from './error-messages'
import { getError } from './error-messages'

const _FRAMES = branding.spinner.frames
const SPEED = branding.spinner.speed

/**
 * Centralized icons for consistent output
 */
export const ICONS = {
  success: chalk.green('✓'),
  fail: chalk.red('✗'),
  warn: chalk.yellow('⚠'),
  info: chalk.blue('ℹ'),
  debug: chalk.dim('🔧'),
  bullet: chalk.dim('•'),
  arrow: chalk.dim('→'),
  check: chalk.green('✓'),
  cross: chalk.red('✗'),
  spinner: chalk.cyan('◐'),
} as const

let interval: ReturnType<typeof setInterval> | null = null
let frame = 0

// Quiet mode - suppress all stdout except errors
let quietMode = false

/**
 * Enable quiet mode (no stdout, only stderr for errors)
 */
export function setQuietMode(enabled: boolean): void {
  quietMode = enabled
}

/**
 * Check if quiet mode is enabled
 */
export function isQuietMode(): boolean {
  return quietMode
}

const truncate = (s: string | undefined | null, max = 50): string =>
  s && s.length > max ? `${s.slice(0, max - 1)}…` : s || ''

const clear = (): boolean => process.stdout.write(`\r${' '.repeat(80)}\r`)

/**
 * Metrics to display after command completion
 * Shows value provided by prjct (compression, agent count, etc.)
 */
interface OutputMetrics {
  agents?: number // Number of agents used
  reduction?: number // Context reduction percentage
  tokens?: number // Token count (in thousands)
}

interface Output {
  start(): Output
  end(): Output
  spin(msg: string): Output
  done(msg: string, metrics?: OutputMetrics): Output
  fail(msg: string): Output
  failWithHint(error: ErrorWithHint | ErrorCode): Output
  warn(msg: string): Output
  info(msg: string): Output
  debug(msg: string): Output
  success(msg: string, metrics?: OutputMetrics): Output
  list(items: string[], options?: { bullet?: string; indent?: number }): Output
  table(rows: Array<Record<string, string | number>>, options?: { header?: boolean }): Output
  box(title: string, content: string): Output
  stop(): Output
  step(current: number, total: number, msg: string): Output
  progress(current: number, total: number, msg?: string): Output
}

const out: Output = {
  // Branding: Show header at start
  start() {
    if (!quietMode) console.log(branding.cli.header())
    return this
  },

  // Branding: Show footer at end
  end() {
    if (!quietMode) console.log(branding.cli.footer())
    return this
  },

  // Branded spinner: prjct message...
  spin(msg: string) {
    if (quietMode) return this
    this.stop()
    interval = setInterval(() => {
      process.stdout.write(`\r${branding.cli.spin(frame++, truncate(msg, 45))}`)
    }, SPEED)
    return this
  },

  done(msg: string, metrics?: OutputMetrics) {
    this.stop()
    if (!quietMode) {
      // Build metrics suffix if provided: [2a | 97% | 45K]
      let suffix = ''
      if (metrics) {
        const parts: string[] = []
        if (metrics.agents !== undefined) parts.push(`${metrics.agents}a`)
        if (metrics.reduction !== undefined) parts.push(`${metrics.reduction}%`)
        if (metrics.tokens !== undefined) parts.push(`${Math.round(metrics.tokens)}K`)
        if (parts.length > 0) {
          suffix = chalk.dim(` [${parts.join(' | ')}]`)
        }
      }
      console.log(`${ICONS.success} ${truncate(msg, 50)}${suffix}`)
    }
    return this
  },

  // Errors go to stderr even in quiet mode
  fail(msg: string) {
    this.stop()
    console.error(`${ICONS.fail} ${truncate(msg, 65)}`)
    return this
  },

  // Rich error with context and recovery hint
  failWithHint(error: ErrorWithHint | ErrorCode) {
    this.stop()
    const err = typeof error === 'string' ? getError(error) : error
    console.error()
    console.error(`${ICONS.fail} ${err.message}`)
    if (err.file) {
      console.error(chalk.dim(`  File: ${err.file}`))
    }
    if (err.hint) {
      console.error(chalk.yellow(`  💡 ${err.hint}`))
    }
    if (err.docs) {
      console.error(chalk.dim(`  Docs: ${err.docs}`))
    }
    console.error()
    return this
  },

  warn(msg: string) {
    this.stop()
    if (!quietMode) console.log(`${ICONS.warn} ${truncate(msg, 65)}`)
    return this
  },

  // Informational message
  info(msg: string) {
    this.stop()
    if (!quietMode) console.log(`${ICONS.info} ${msg}`)
    return this
  },

  // Debug message (only if DEBUG=1 or DEBUG=true)
  debug(msg: string) {
    this.stop()
    const debugEnabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true'
    if (!quietMode && debugEnabled) {
      console.log(`${ICONS.debug} ${chalk.dim(msg)}`)
    }
    return this
  },

  // Alias for done - explicit success indicator
  success(msg: string, metrics?: OutputMetrics) {
    return this.done(msg, metrics)
  },

  // Bulleted list
  list(items: string[], options: { bullet?: string; indent?: number } = {}) {
    this.stop()
    if (quietMode) return this
    const bullet = options.bullet || ICONS.bullet
    const indent = ' '.repeat(options.indent || 0)
    for (const item of items) {
      console.log(`${indent}${bullet} ${item}`)
    }
    return this
  },

  // Simple table output
  table(rows: Array<Record<string, string | number>>, options: { header?: boolean } = {}) {
    this.stop()
    if (quietMode || rows.length === 0) return this

    const keys = Object.keys(rows[0])
    const colWidths: Record<string, number> = {}

    // Calculate column widths
    for (const key of keys) {
      colWidths[key] = key.length
      for (const row of rows) {
        const val = String(row[key] ?? '')
        if (val.length > colWidths[key]) colWidths[key] = val.length
      }
    }

    // Print header if requested
    if (options.header !== false) {
      const headerLine = keys.map((k) => k.padEnd(colWidths[k])).join('  ')
      console.log(chalk.dim(headerLine))
      console.log(chalk.dim('─'.repeat(headerLine.length)))
    }

    // Print rows
    for (const row of rows) {
      const line = keys.map((k) => String(row[k] ?? '').padEnd(colWidths[k])).join('  ')
      console.log(line)
    }
    return this
  },

  // Boxed content
  box(title: string, content: string) {
    this.stop()
    if (quietMode) return this
    const lines = content.split('\n')
    const maxLen = Math.max(title.length, ...lines.map((l) => l.length))
    const border = '─'.repeat(maxLen + 2)

    console.log(chalk.dim(`┌${border}┐`))
    console.log(`${chalk.dim('│')} ${chalk.bold(title.padEnd(maxLen))} ${chalk.dim('│')}`)
    console.log(chalk.dim(`├${border}┤`))
    for (const line of lines) {
      console.log(`${chalk.dim('│')} ${line.padEnd(maxLen)} ${chalk.dim('│')}`)
    }
    console.log(chalk.dim(`└${border}┘`))
    return this
  },

  stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
      clear()
    }
    return this
  },

  // Step counter: [3/7] Running tests...
  step(current: number, total: number, msg: string) {
    if (quietMode) return this
    this.stop()
    const counter = chalk.dim(`[${current}/${total}]`)
    interval = setInterval(() => {
      process.stdout.write(`\r${branding.cli.spin(frame++, `${counter} ${truncate(msg, 35)}`)}`)
    }, SPEED)
    return this
  },

  // Progress bar: [████░░░░] 50% Analyzing...
  progress(current: number, total: number, msg?: string) {
    if (quietMode) return this
    this.stop()
    const percent = Math.round((current / total) * 100)
    const filled = Math.round(percent / 10)
    const empty = 10 - filled
    const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(empty))
    const text = msg ? ` ${truncate(msg, 25)}` : ''
    interval = setInterval(() => {
      process.stdout.write(`\r${branding.cli.spin(frame++, `[${bar}] ${percent}%${text}`)}`)
    }, SPEED)
    return this
  },
}

export type { OutputMetrics }
export type { ErrorCode, ErrorWithHint } from './error-messages'
export { createError, ERRORS, getError } from './error-messages'
export default out
