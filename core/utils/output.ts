/**
 * Minimal Output System for prjct-cli
 * Spinner while working → Single line result
 * With prjct branding
 */

import chalk from 'chalk'
import branding from './branding'

const FRAMES = branding.spinner.frames
const SPEED = branding.spinner.speed

let interval: ReturnType<typeof setInterval> | null = null
let frame = 0

const truncate = (s: string | undefined | null, max = 50): string =>
  s && s.length > max ? s.slice(0, max - 1) + '…' : s || ''

const clear = (): boolean => process.stdout.write('\r' + ' '.repeat(80) + '\r')

interface Output {
  start(): Output
  end(): Output
  spin(msg: string): Output
  done(msg: string): Output
  fail(msg: string): Output
  warn(msg: string): Output
  stop(): Output
}

const out: Output = {
  // Branding: Show header at start
  start() {
    console.log(branding.cli.header())
    return this
  },

  // Branding: Show footer at end
  end() {
    console.log(branding.cli.footer())
    return this
  },

  // Branded spinner: prjct message...
  spin(msg: string) {
    this.stop()
    interval = setInterval(() => {
      process.stdout.write(`\r${branding.cli.spin(frame++, truncate(msg, 45))}`)
    }, SPEED)
    return this
  },

  done(msg: string) {
    this.stop()
    console.log(`${chalk.green('✓')} ${truncate(msg, 65)}`)
    return this
  },

  fail(msg: string) {
    this.stop()
    console.log(`${chalk.red('✗')} ${truncate(msg, 65)}`)
    return this
  },

  warn(msg: string) {
    this.stop()
    console.log(`${chalk.yellow('⚠')} ${truncate(msg, 65)}`)
    return this
  },

  stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
      clear()
    }
    return this
  }
}

export default out
