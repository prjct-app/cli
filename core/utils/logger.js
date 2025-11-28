/**
 * Logger - Centralized logging with levels
 *
 * Silent by default. Enable with:
 *   PRJCT_DEBUG=1       (all logs)
 *   PRJCT_DEBUG=error   (errors only)
 *   PRJCT_DEBUG=warn    (errors + warnings)
 *   PRJCT_DEBUG=info    (errors + warnings + info)
 *   PRJCT_DEBUG=debug   (everything)
 *
 * Usage:
 *   const log = require('./utils/logger')
 *   log.debug('Processing files...')
 *   log.info('Task started')
 *   log.warn('Cache miss')
 *   log.error('Failed to load', error.message)
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

const debugEnv = process.env.PRJCT_DEBUG || process.env.DEBUG || ''
const isEnabled = debugEnv === '1' || debugEnv === 'true' || debugEnv.includes('prjct')

// Determine log level
let currentLevel = -1 // disabled by default
if (isEnabled) {
  if (debugEnv === '1' || debugEnv === 'true' || debugEnv === 'prjct') {
    currentLevel = LEVELS.debug // all logs
  } else if (LEVELS[debugEnv] !== undefined) {
    currentLevel = LEVELS[debugEnv]
  } else {
    currentLevel = LEVELS.debug
  }
}

// No-op function for disabled logs
const noop = () => {}

// Create logger methods
const logger = {
  error: currentLevel >= LEVELS.error
    ? (...args) => console.error('[prjct:error]', ...args)
    : noop,

  warn: currentLevel >= LEVELS.warn
    ? (...args) => console.warn('[prjct:warn]', ...args)
    : noop,

  info: currentLevel >= LEVELS.info
    ? (...args) => console.log('[prjct:info]', ...args)
    : noop,

  debug: currentLevel >= LEVELS.debug
    ? (...args) => console.log('[prjct:debug]', ...args)
    : noop,

  // Check if logging is enabled (useful for expensive log prep)
  isEnabled: () => currentLevel >= 0,

  // Get current level name
  level: () => Object.keys(LEVELS).find(k => LEVELS[k] === currentLevel) || 'disabled'
}

module.exports = logger
