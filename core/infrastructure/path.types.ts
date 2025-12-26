/**
 * Path Manager Types
 *
 * Type definitions for path management.
 */

/**
 * Session information for date-based paths
 */
export interface SessionInfo {
  year: string
  month: string
  day: string
  path: string
  date: Date
}

/**
 * Layer types for file organization
 */
export type LayerType =
  | 'core'
  | 'planning'
  | 'progress'
  | 'analysis'
  | 'memory'
  | 'agents'
  | 'sessions'
  | 'sync'
  | 'storage'
  | 'context'
