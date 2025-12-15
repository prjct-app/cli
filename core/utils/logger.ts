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
 *   import log from './utils/logger'
 *   log.debug('Processing files...')
 *   log.info('Task started')
 *   log.warn('Cache miss')
 *   log.error('Failed to load', error.message)
 */

type LogLevel = 'error' | 'warn' | 'info' | 'debug'
type LogFunction = (...args: unknown[]) => void

interface Logger {
  error: LogFunction
  warn: LogFunction
  info: LogFunction
  debug: LogFunction
  isEnabled: () => boolean
  level: () => LogLevel | 'disabled'
}

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }

/**
 * Determine log level from environment variables
 * Returns -1 (disabled) or a level from LEVELS
 */
function getLogLevel(): number {
  const debugEnv = process.env.PRJCT_DEBUG || process.env.DEBUG || ''

  // Disabled if empty
  if (!debugEnv) return -1

  // Enable all logs for common truthy values
  if (debugEnv === '1' || debugEnv === 'true' || debugEnv === 'prjct' || debugEnv.includes('prjct')) {
    return LEVELS.debug
  }

  // Check for specific level name (error, warn, info, debug)
  const level = LEVELS[debugEnv as LogLevel]
  return level !== undefined ? level : -1
}

const currentLevel = getLogLevel()

// No-op function for disabled logs
const noop: LogFunction = () => {}

// Create logger methods
const logger: Logger = {
  error: currentLevel >= LEVELS.error
    ? (...args: unknown[]) => console.error('[prjct:error]', ...args)
    : noop,

  warn: currentLevel >= LEVELS.warn
    ? (...args: unknown[]) => console.warn('[prjct:warn]', ...args)
    : noop,

  info: currentLevel >= LEVELS.info
    ? (...args: unknown[]) => console.log('[prjct:info]', ...args)
    : noop,

  debug: currentLevel >= LEVELS.debug
    ? (...args: unknown[]) => console.log('[prjct:debug]', ...args)
    : noop,

  // Check if logging is enabled (useful for expensive log prep)
  isEnabled: () => currentLevel >= 0,

  // Get current level name
  level: () => (Object.keys(LEVELS) as LogLevel[]).find(k => LEVELS[k] === currentLevel) || 'disabled'
}

export default logger
