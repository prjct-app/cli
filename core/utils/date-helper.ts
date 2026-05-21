/**
 * Date Helper - Centralized date operations and formatting
 *
 * Eliminates duplicated date logic across:
 * - session-manager.ts (_getDateKey, _getTodayKey)
 * - path-manager.ts (getSessionPath date formatting)
 * - commands.ts (38+ inline date operations)
 */

import { formatDistanceToNowStrict } from 'date-fns'
import type { DateComponents } from '../types/utils'

/**
 * Format a date to YYYY-MM-DD format
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a date to YYYY-MM format
 */
export function formatMonth(date: Date): string {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Get date key for today (YYYY-MM-DD)
 */
export function getTodayKey(): string {
  return formatDate(new Date())
}

/**
 * Get date key for any date (YYYY-MM-DD)
 * Alias for formatDate for consistency with session-manager
 */
export function getDateKey(date: Date): string {
  return formatDate(date)
}

/**
 * Get year, month, day components from a date
 * Useful for path construction
 */
export function getYearMonthDay(date: Date): DateComponents {
  return {
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDate().toString().padStart(2, '0'),
  }
}

/**
 * Parse a date string to Date object
 * Supports: YYYY-MM-DD, YYYY-MM, ISO strings
 */
export function parseDate(dateString: string): Date {
  return new Date(dateString)
}

/**
 * Get current timestamp in ISO format
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Get date N days ago from today
 */
export function getDaysAgo(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/**
 * Get date N days from today
 */
export function getDaysFromNow(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

/**
 * Get date range between two dates
 */
export function getDateRange(fromDate: Date, toDate: Date): Date[] {
  const dates: Date[] = []
  let current = new Date(fromDate)

  while (current <= toDate) {
    dates.push(new Date(current))
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1)
  }

  return dates
}

/**
 * Check if a date is today
 */
export function isToday(date: Date): boolean {
  return formatDate(date) === getTodayKey()
}

/**
 * Check if a date is within the last N days
 */
export function isWithinLastDays(date: Date, days: number): boolean {
  const threshold = getDaysAgo(days)
  return date >= threshold
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m`
  }
  return `${seconds}s`
}

/**
 * Calculate duration between two dates
 */
export function calculateDuration(startDate: Date, endDate: Date = new Date()): string {
  const milliseconds = endDate.getTime() - startDate.getTime()
  return formatDuration(milliseconds)
}

/**
 * Get start of day (00:00:00.000)
 */
export function getStartOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of day (23:59:59.999)
 */
export function getEndOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

/**
 * Convert a date/timestamp to a relative string (e.g. "5 minutes ago").
 * Uses date-fns formatDistanceToNowStrict for accurate, token-friendly output.
 */
export function toRelative(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNowStrict(d, { addSuffix: true })
}

/**
 * Parse a duration string like "2h 30m" or "45s" to minutes.
 * Supports: "2h", "30m", "1h 30m", "2h30m", "90m", "45s" (rounds up to 1m)
 */
export function parseDurationMinutes(duration: string): number {
  let minutes = 0

  const hourMatch = duration.match(/(\d+)h/)
  if (hourMatch) {
    minutes += Number.parseInt(hourMatch[1], 10) * 60
  }

  const minMatch = duration.match(/(\d+)m/)
  if (minMatch) {
    minutes += Number.parseInt(minMatch[1], 10)
  }

  const secMatch = duration.match(/(\d+)s/)
  if (secMatch && minutes === 0) {
    // Only count seconds if no hours/minutes (round up to 1 min)
    minutes = 1
  }

  return minutes
}
