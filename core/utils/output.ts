/**
 * Minimal Output System for prjct-cli
 * Spinner while working → Single line result
 * With prjct branding
 *
 * Supports --quiet mode for CI/CD and scripting
 */

import chalk from 'chalk'
import branding from './branding'

const _FRAMES = branding.spinner.frames
const SPEED = branding.spinner.speed

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
  warn(msg: string): Output
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
      console.log(`${chalk.green('✓')} ${truncate(msg, 50)}${suffix}`)
    }
    return this
  },

  // Errors go to stderr even in quiet mode
  fail(msg: string) {
    this.stop()
    console.error(`${chalk.red('✗')} ${truncate(msg, 65)}`)
    return this
  },

  warn(msg: string) {
    this.stop()
    if (!quietMode) console.log(`${chalk.yellow('⚠')} ${truncate(msg, 65)}`)
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
export default out
