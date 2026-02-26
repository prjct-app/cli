/**
 * Session Utilities
 */

import { generateUUID } from '../schemas/schemas'
import type { Session } from '../types/session'
import { formatDuration as formatDurationMs } from '../utils/date-helper'

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
 * Format duration as human readable (accepts seconds)
 */
export function formatDuration(seconds: number): string {
  return formatDurationMs(seconds * 1000)
}
