/**
 * Shared Utilities
 */

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = 'sess_'
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

/**
 * Generate a unique ID with prefix
 */
export function generateId(prefix: string = 'id'): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = `${prefix}_`
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

/**
 * Format duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)

  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

/**
 * Parse duration string to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?/)
  if (!match) return 0

  const hours = parseInt(match[1] || '0', 10)
  const minutes = parseInt(match[2] || '0', 10)
  const secs = parseInt(match[3] || '0', 10)

  return hours * 3600 + minutes * 60 + secs
}

/**
 * Get relative time string
 */
export function getRelativeTime(date: Date | string): string {
  const now = new Date()
  const then = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - then.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return then.toLocaleDateString()
}

/**
 * Get ISO timestamp
 */
export function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Get date in YYYY-MM-DD format
 */
export function getDate(): string {
  return new Date().toISOString().split('T')[0]
}

/**
 * Get year-month in YYYY-MM format
 */
export function getYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Safely parse JSON
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch (_error) {
    return fallback
  }
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

/**
 * Slugify string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Check if running in Node.js
 */
export function isNode(): boolean {
  return typeof process !== 'undefined' && process.versions?.node != null
}

/**
 * Check if running in browser
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}
