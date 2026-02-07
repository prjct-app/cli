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

import type { LogFunction, Logger, LogLevel } from '../types/logger'

const LEVELS: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 }
const TRUTHY_VALUES = new Set(['1', 'true', '*'])

/**
 * Determine log level from environment variables
 * Returns -1 (disabled) or a level from LEVELS
 */
function getLogLevel(): { level: number; name: LogLevel | 'disabled' } {
  // PRJCT_DEBUG (primary) or DEBUG (fallback): Enable debug logging
  // Values: '1', 'true', a log level name, or 'prjct' to match
  const debugEnv = process.env.PRJCT_DEBUG || process.env.DEBUG || ''

  // Disabled if empty
  if (!debugEnv) return { level: -1, name: 'disabled' }

  // Enable all logs for common truthy values or prjct-related patterns
  if (TRUTHY_VALUES.has(debugEnv) || debugEnv.includes('prjct')) {
    return { level: LEVELS.debug, name: 'debug' }
  }

  // Check for specific level name (error, warn, info, debug)
  const levelValue = LEVELS[debugEnv as LogLevel] ?? -1
  const levelName = levelValue >= 0 ? (debugEnv as LogLevel) : 'disabled'
  return { level: levelValue, name: levelName }
}

const { level: currentLevel, name: currentLevelName } = getLogLevel()

// No-op function for disabled logs
const noop: LogFunction = () => {}

// Factory for creating log methods
function createLogMethod(
  levelThreshold: number,
  prefix: string,
  method: 'log' | 'warn' | 'error'
): LogFunction {
  return currentLevel >= levelThreshold
    ? (...args: unknown[]) => console[method](prefix, ...args)
    : noop
}

// Create logger methods
const logger: Logger = {
  error: createLogMethod(LEVELS.error, '[prjct:error]', 'error'),
  warn: createLogMethod(LEVELS.warn, '[prjct:warn]', 'warn'),
  info: createLogMethod(LEVELS.info, '[prjct:info]', 'log'),
  debug: createLogMethod(LEVELS.debug, '[prjct:debug]', 'log'),

  // Check if logging is enabled (useful for expensive log prep)
  isEnabled: () => currentLevel >= 0,

  // Get current level name (pre-computed, no runtime lookup)
  level: () => currentLevelName,
}

export default logger
