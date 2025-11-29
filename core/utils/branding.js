/**
 * Branding Configuration for prjct-cli
 * Single source of truth for all branding across CLI and Claude Code
 */

const chalk = require('chalk')

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const SPINNER_SPEED = 80

const branding = {
  // Core identity
  name: 'prjct',
  icon: '⚡',
  signature: '⚡ prjct',

  // Spinner config
  spinner: {
    frames: SPINNER_FRAMES,
    speed: SPINNER_SPEED
  },

  // CLI output (with chalk colors)
  cli: {
    header: () => chalk.cyan.bold('⚡') + ' ' + chalk.cyan('prjct'),
    footer: () => chalk.dim('⚡ prjct'),
    spin: (frame, msg) => chalk.cyan('⚡') + ' ' + chalk.cyan('prjct') + ' ' + chalk.cyan(SPINNER_FRAMES[frame % 10]) + ' ' + chalk.dim(msg || '')
  },

  // Template/Claude (plain text)
  template: {
    header: '⚡ prjct',
    footer: '⚡ prjct'
  },

  // Git commit footer
  commitFooter: `🤖 Generated with [p/](https://www.prjct.app/)
Designed for [Claude](https://www.anthropic.com/claude)`,

  // URLs
  urls: {
    website: 'https://prjct.app',
    docs: 'https://prjct.app/docs'
  }
}

module.exports = branding
