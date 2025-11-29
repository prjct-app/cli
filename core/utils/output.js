/**
 * Minimal Output System for prjct-cli
 * Spinner while working → Single line result
 * With ⚡ prjct branding
 */

const chalk = require('chalk')
const branding = require('./branding')

const FRAMES = branding.spinner.frames
const SPEED = branding.spinner.speed

let interval = null
let frame = 0

const truncate = (s, max = 50) => (s && s.length > max ? s.slice(0, max - 1) + '…' : s || '')
const clear = () => process.stdout.write('\r' + ' '.repeat(80) + '\r')

const out = {
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

  // Branded spinner: ⚡ prjct ⠋ message...
  spin(msg) {
    this.stop()
    interval = setInterval(() => {
      process.stdout.write(`\r${branding.cli.spin(frame++, truncate(msg, 45))}`)
    }, SPEED)
    return this
  },

  done(msg) {
    this.stop()
    console.log(`${chalk.green('✓')} ${truncate(msg, 65)}`)
    return this
  },

  fail(msg) {
    this.stop()
    console.log(`${chalk.red('✗')} ${truncate(msg, 65)}`)
    return this
  },

  warn(msg) {
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

module.exports = out
