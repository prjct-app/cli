/**
 * Session Utilities
 */

import { generateUUID } from '../schemas/schemas'
import type { Session } from '../types'

/**
 * Generate unique session ID (re-export from schemas)
 */
export const generateId = generateUUID

/**
 * Calculate total duration in seconds
 */
export function calculateDuration(session: Session): number {
  let totalMs = 0
  let lastStart: Date | null = null

  for (const event of session.timeline) {
    if (event.type === 'start' || event.type === 'resume') {
      lastStart = new Date(event.at)
    } else if (event.type === 'pause' || event.type === 'complete') {
      if (lastStart) {
        totalMs += new Date(event.at).getTime() - lastStart.getTime()
        lastStart = null
      }
    }
  }

  // If still active, count from last start to now
  if (lastStart && session.status === 'active') {
    totalMs += Date.now() - lastStart.getTime()
  }

  return Math.round(totalMs / 1000)
}

/**
 * Format duration as human readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
