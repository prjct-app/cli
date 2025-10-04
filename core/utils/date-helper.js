/**
 * Date Helper - Centralized date operations and formatting
 *
 * Eliminates duplicated date logic across:
 * - session-manager.js (_getDateKey, _getTodayKey)
 * - path-manager.js (getSessionPath date formatting)
 * - commands.js (38+ inline date operations)
 *
 * @module date-helper
 */

/**
 * Format a date to YYYY-MM-DD format
 *
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string (e.g., "2025-10-04")
 */
function formatDate(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a date to YYYY-MM format
 *
 * @param {Date} date - Date to format
 * @returns {string} - Formatted month string (e.g., "2025-10")
 */
function formatMonth(date) {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Get date key for today (YYYY-MM-DD)
 *
 * @returns {string} - Today's date key
 */
function getTodayKey() {
  return formatDate(new Date())
}

/**
 * Get date key for any date (YYYY-MM-DD)
 * Alias for formatDate for consistency with session-manager
 *
 * @param {Date} date - Date to format
 * @returns {string} - Date key (e.g., "2025-10-04")
 */
function getDateKey(date) {
  return formatDate(date)
}

/**
 * Get year, month, day components from a date
 * Useful for path construction
 *
 * @param {Date} date - Date to parse
 * @returns {{year: string, month: string, day: string}} - Date components
 */
function getYearMonthDay(date) {
  return {
    year: date.getFullYear().toString(),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    day: date.getDate().toString().padStart(2, '0'),
  }
}

/**
 * Parse a date string to Date object
 * Supports: YYYY-MM-DD, YYYY-MM, ISO strings
 *
 * @param {string} dateString - Date string to parse
 * @returns {Date} - Parsed date
 */
function parseDate(dateString) {
  return new Date(dateString)
}

/**
 * Get current timestamp in ISO format
 *
 * @returns {string} - ISO timestamp (e.g., "2025-10-04T14:30:00.000Z")
 */
function getTimestamp() {
  return new Date().toISOString()
}

/**
 * Get date N days ago from today
 *
 * @param {number} days - Number of days to subtract
 * @returns {Date} - Date in the past
 */
function getDaysAgo(days) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

/**
 * Get date N days from today
 *
 * @param {number} days - Number of days to add
 * @returns {Date} - Date in the future
 */
function getDaysFromNow(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

/**
 * Get date range between two dates
 *
 * @param {Date} fromDate - Start date
 * @param {Date} toDate - End date
 * @returns {Array<Date>} - Array of dates in range
 */
function getDateRange(fromDate, toDate) {
  const dates = []
  let current = new Date(fromDate)

  while (current <= toDate) {
    dates.push(new Date(current))
    current = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    )
  }

  return dates
}

/**
 * Check if a date is today
 *
 * @param {Date} date - Date to check
 * @returns {boolean} - True if date is today
 */
function isToday(date) {
  return formatDate(date) === getTodayKey()
}

/**
 * Check if a date is within the last N days
 *
 * @param {Date} date - Date to check
 * @param {number} days - Number of days
 * @returns {boolean} - True if within range
 */
function isWithinLastDays(date, days) {
  const threshold = getDaysAgo(days)
  return date >= threshold
}

/**
 * Format duration in human-readable format
 *
 * @param {number} milliseconds - Duration in ms
 * @returns {string} - Formatted duration (e.g., "2h 15m")
 */
function formatDuration(milliseconds) {
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
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date (defaults to now)
 * @returns {string} - Formatted duration
 */
function calculateDuration(startDate, endDate = new Date()) {
  const milliseconds = endDate - startDate
  return formatDuration(milliseconds)
}

/**
 * Get start of day (00:00:00.000)
 *
 * @param {Date} date - Date to process
 * @returns {Date} - Start of day
 */
function getStartOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/**
 * Get end of day (23:59:59.999)
 *
 * @param {Date} date - Date to process
 * @returns {Date} - End of day
 */
function getEndOfDay(date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

module.exports = {
  formatDate,
  formatMonth,
  getTodayKey,
  getDateKey,
  getYearMonthDay,
  parseDate,
  getTimestamp,
  getDaysAgo,
  getDaysFromNow,
  getDateRange,
  isToday,
  isWithinLastDays,
  formatDuration,
  calculateDuration,
  getStartOfDay,
  getEndOfDay,
}
