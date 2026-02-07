/**
 * Output Types
 * Types for CLI output, tiers, and metrics.
 */

/** Error shape for failWithHint (matches ErrorWithHint from ./errors). */
export interface ErrorWithHintLike {
  message: string
  hint?: string
  file?: string
  docs?: string
  code?: string
}

export type OutputTier = 'silent' | 'minimal' | 'compact' | 'verbose'

export interface TierConfig {
  maxLines: number
  maxCharsPerLine: number
  showMetrics: boolean
}

export interface OutputMetrics {
  agents?: number
  reduction?: number
  tokens?: number
}

export interface Output {
  start(): Output
  end(): Output
  spin(msg: string): Output
  done(msg: string, metrics?: OutputMetrics): Output
  fail(msg: string): Output
  failWithHint(error: ErrorWithHintLike | string): Output
  warn(msg: string): Output
  info(msg: string): Output
  debug(msg: string): Output
  success(msg: string, metrics?: OutputMetrics): Output
  list(items: string[], options?: { bullet?: string; indent?: number }): Output
  table(rows: Array<Record<string, string | number>>, options?: { header?: boolean }): Output
  box(title: string, content: string): Output
  section(title: string): Output
  stop(): Output
  step(current: number, total: number, msg: string): Output
  progress(current: number, total: number, msg?: string): Output
}
