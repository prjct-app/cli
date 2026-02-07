/**
 * Logger Types
 * Types for centralized logging.
 */

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export type LogFunction = (...args: unknown[]) => void

export interface Logger {
  error: LogFunction
  warn: LogFunction
  info: LogFunction
  debug: LogFunction
  isEnabled: () => boolean
  level: () => LogLevel | 'disabled'
}
