/**
 * Minimal Output System for prjct-cli
 * Spinner while working → Single line result
 */

const chalk = require('chalk')

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPEED = 80

let interval = null
let frame = 0

const truncate = (s, max = 50) => (s && s.length > max ? s.slice(0, max - 1) + '…' : s || '')
const clear = () => process.stdout.write('\r' + ' '.repeat(70) + '\r')

const out = {
  spin(msg) {
    this.stop()
    interval = setInterval(() => {
      process.stdout.write(`\r${chalk.cyan(FRAMES[frame++ % 10])} ${truncate(msg, 55)}`)
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
