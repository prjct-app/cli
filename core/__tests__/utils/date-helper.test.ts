/**
 * Date Helper Tests
 * Tests for centralized date operations and formatting
 */

import { describe, it, expect, beforeEach, afterEach, setSystemTime } from 'bun:test'
import {
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
} from '../../utils/date-helper'

describe('DateHelper', () => {
  describe('formatDate', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2025, 9, 4) // Oct 4, 2025
      expect(formatDate(date)).toBe('2025-10-04')
    })

    it('should pad single digit months', () => {
      const date = new Date(2025, 0, 15) // Jan 15, 2025
      expect(formatDate(date)).toBe('2025-01-15')
    })

    it('should pad single digit days', () => {
      const date = new Date(2025, 11, 5) // Dec 5, 2025
      expect(formatDate(date)).toBe('2025-12-05')
    })

    it('should handle year boundaries', () => {
      const date = new Date(2024, 11, 31) // Dec 31, 2024
      expect(formatDate(date)).toBe('2024-12-31')
    })
  })

  describe('formatMonth', () => {
    it('should format date to YYYY-MM', () => {
      const date = new Date(2025, 9, 15) // Oct 15, 2025
      expect(formatMonth(date)).toBe('2025-10')
    })

    it('should pad single digit months', () => {
      const date = new Date(2025, 2, 1) // Mar 1, 2025
      expect(formatMonth(date)).toBe('2025-03')
    })

    it('should handle December', () => {
      const date = new Date(2025, 11, 25) // Dec 25, 2025
      expect(formatMonth(date)).toBe('2025-12')
    })
  })

  describe('getTodayKey', () => {
    it('should return today in YYYY-MM-DD format', () => {
      setSystemTime(new Date(2025, 5, 15)) // June 15, 2025
      expect(getTodayKey()).toBe('2025-06-15')
      setSystemTime()
    })
  })

  describe('getDateKey', () => {
    it('should return date in YYYY-MM-DD format (alias for formatDate)', () => {
      const date = new Date(2025, 7, 20) // Aug 20, 2025
      expect(getDateKey(date)).toBe('2025-08-20')
    })
  })

  describe('getYearMonthDay', () => {
    it('should return separate year, month, day strings', () => {
      const date = new Date(2025, 9, 4) // Oct 4, 2025
      const result = getYearMonthDay(date)

      expect(result.year).toBe('2025')
      expect(result.month).toBe('10')
      expect(result.day).toBe('04')
    })

    it('should pad month values', () => {
      const date = new Date(2025, 0, 15) // Jan 15, 2025
      const result = getYearMonthDay(date)
      expect(result.month).toBe('01')
    })

    it('should pad day values', () => {
      const date = new Date(2025, 5, 7) // June 7, 2025
      const result = getYearMonthDay(date)
      expect(result.day).toBe('07')
    })
  })

  describe('parseDate', () => {
    it('should parse YYYY-MM-DD format', () => {
      const result = parseDate('2025-10-04')
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(9) // 0-indexed
      expect(result.getDate()).toBe(4)
    })

    it('should parse ISO strings', () => {
      const result = parseDate('2025-10-04T14:30:00.000Z')
      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(9)
    })
  })

  describe('getTimestamp', () => {
    it('should return ISO timestamp', () => {
      setSystemTime(new Date('2025-10-04T14:30:00.000Z'))
      expect(getTimestamp()).toBe('2025-10-04T14:30:00.000Z')
      setSystemTime()
    })

    it('should include milliseconds', () => {
      const timestamp = getTimestamp()
      expect(timestamp).toMatch(/\.\d{3}Z$/)
    })
  })

  describe('getDaysAgo', () => {
    beforeEach(() => {
      setSystemTime(new Date(2025, 9, 15)) // Oct 15, 2025
    })

    afterEach(() => {
      setSystemTime()
    })

    it('should calculate past dates correctly', () => {
      const result = getDaysAgo(5)
      expect(formatDate(result)).toBe('2025-10-10')
    })

    it('should handle month boundaries', () => {
      const result = getDaysAgo(20)
      expect(formatDate(result)).toBe('2025-09-25')
    })

    it('should return today for 0 days ago', () => {
      const result = getDaysAgo(0)
      expect(formatDate(result)).toBe('2025-10-15')
    })
  })

  describe('getDaysFromNow', () => {
    beforeEach(() => {
      setSystemTime(new Date(2025, 9, 15)) // Oct 15, 2025
    })

    afterEach(() => {
      setSystemTime()
    })

    it('should calculate future dates correctly', () => {
      const result = getDaysFromNow(5)
      expect(formatDate(result)).toBe('2025-10-20')
    })

    it('should handle month boundaries', () => {
      const result = getDaysFromNow(20)
      expect(formatDate(result)).toBe('2025-11-04')
    })

    it('should return today for 0 days from now', () => {
      const result = getDaysFromNow(0)
      expect(formatDate(result)).toBe('2025-10-15')
    })
  })

  describe('getDateRange', () => {
    it('should return array of dates in range', () => {
      const from = new Date(2025, 9, 1) // Oct 1
      const to = new Date(2025, 9, 5) // Oct 5

      const result = getDateRange(from, to)

      expect(result.length).toBe(5)
      expect(formatDate(result[0])).toBe('2025-10-01')
      expect(formatDate(result[4])).toBe('2025-10-05')
    })

    it('should include start and end dates', () => {
      const from = new Date(2025, 9, 10)
      const to = new Date(2025, 9, 12)

      const result = getDateRange(from, to)

      expect(formatDate(result[0])).toBe('2025-10-10')
      expect(formatDate(result[result.length - 1])).toBe('2025-10-12')
    })

    it('should return single date if from equals to', () => {
      const date = new Date(2025, 9, 15)
      const result = getDateRange(date, date)

      expect(result.length).toBe(1)
      expect(formatDate(result[0])).toBe('2025-10-15')
    })

    it('should handle month boundaries', () => {
      const from = new Date(2025, 9, 30) // Oct 30
      const to = new Date(2025, 10, 2) // Nov 2

      const result = getDateRange(from, to)

      expect(result.length).toBe(4)
      expect(formatDate(result[0])).toBe('2025-10-30')
      expect(formatDate(result[3])).toBe('2025-11-02')
    })

    it('should return empty array if from is after to', () => {
      const from = new Date(2025, 9, 15)
      const to = new Date(2025, 9, 10)

      const result = getDateRange(from, to)

      expect(result.length).toBe(0)
    })
  })

  describe('isToday', () => {
    beforeEach(() => {
      setSystemTime(new Date(2025, 9, 15)) // Oct 15, 2025
    })

    afterEach(() => {
      setSystemTime()
    })

    it('should return true for today', () => {
      const today = new Date(2025, 9, 15)
      expect(isToday(today)).toBe(true)
    })

    it('should return false for yesterday', () => {
      const yesterday = new Date(2025, 9, 14)
      expect(isToday(yesterday)).toBe(false)
    })

    it('should return false for tomorrow', () => {
      const tomorrow = new Date(2025, 9, 16)
      expect(isToday(tomorrow)).toBe(false)
    })

    it('should ignore time component', () => {
      const todayLate = new Date(2025, 9, 15, 23, 59, 59)
      expect(isToday(todayLate)).toBe(true)
    })
  })

  describe('isWithinLastDays', () => {
    beforeEach(() => {
      setSystemTime(new Date(2025, 9, 15, 12, 0, 0)) // Oct 15, 2025 at noon
    })

    afterEach(() => {
      setSystemTime()
    })

    it('should return true for dates within range', () => {
      const recent = new Date(2025, 9, 12) // 3 days ago
      expect(isWithinLastDays(recent, 7)).toBe(true)
    })

    it('should return false for dates outside range', () => {
      const old = new Date(2025, 9, 1) // 14 days ago
      expect(isWithinLastDays(old, 7)).toBe(false)
    })

    it('should include today', () => {
      const today = new Date(2025, 9, 15)
      expect(isWithinLastDays(today, 7)).toBe(true)
    })

    it('should include boundary date', () => {
      // Oct 8 at noon is exactly 7 days before Oct 15 at noon
      const boundary = new Date(2025, 9, 8, 12, 0, 0)
      expect(isWithinLastDays(boundary, 7)).toBe(true)
    })
  })

  describe('formatDuration', () => {
    it('should format seconds', () => {
      expect(formatDuration(5000)).toBe('5s')
      expect(formatDuration(45000)).toBe('45s')
    })

    it('should format minutes', () => {
      expect(formatDuration(60000)).toBe('1m')
      expect(formatDuration(120000)).toBe('2m')
      expect(formatDuration(90000)).toBe('1m') // 1.5 min rounds down
    })

    it('should format hours and minutes', () => {
      expect(formatDuration(3600000)).toBe('1h 0m')
      expect(formatDuration(5400000)).toBe('1h 30m')
      expect(formatDuration(7200000)).toBe('2h 0m')
    })

    it('should format days and hours', () => {
      expect(formatDuration(86400000)).toBe('1d 0h')
      expect(formatDuration(90000000)).toBe('1d 1h')
      expect(formatDuration(172800000)).toBe('2d 0h')
    })

    it('should handle zero', () => {
      expect(formatDuration(0)).toBe('0s')
    })
  })

  describe('calculateDuration', () => {
    it('should calculate duration between two dates', () => {
      const start = new Date('2025-10-15T10:00:00.000Z')
      const end = new Date('2025-10-15T12:30:00.000Z')

      expect(calculateDuration(start, end)).toBe('2h 30m')
    })

    it('should default to now if no end date', () => {
      setSystemTime(new Date('2025-10-15T12:00:00.000Z'))

      const start = new Date('2025-10-15T10:00:00.000Z')
      expect(calculateDuration(start)).toBe('2h 0m')

      setSystemTime()
    })

    it('should handle short durations', () => {
      const start = new Date('2025-10-15T10:00:00.000Z')
      const end = new Date('2025-10-15T10:00:30.000Z')

      expect(calculateDuration(start, end)).toBe('30s')
    })
  })

  describe('getStartOfDay', () => {
    it('should set time to 00:00:00.000', () => {
      const date = new Date(2025, 9, 15, 14, 30, 45, 500)
      const result = getStartOfDay(date)

      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
    })

    it('should preserve the date', () => {
      const date = new Date(2025, 9, 15, 23, 59, 59)
      const result = getStartOfDay(date)

      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(9)
      expect(result.getDate()).toBe(15)
    })

    it('should not mutate original date', () => {
      const original = new Date(2025, 9, 15, 14, 30)
      getStartOfDay(original)

      expect(original.getHours()).toBe(14)
      expect(original.getMinutes()).toBe(30)
    })
  })

  describe('getEndOfDay', () => {
    it('should set time to 23:59:59.999', () => {
      const date = new Date(2025, 9, 15, 10, 0, 0, 0)
      const result = getEndOfDay(date)

      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
    })

    it('should preserve the date', () => {
      const date = new Date(2025, 9, 15, 0, 0, 0)
      const result = getEndOfDay(date)

      expect(result.getFullYear()).toBe(2025)
      expect(result.getMonth()).toBe(9)
      expect(result.getDate()).toBe(15)
    })

    it('should not mutate original date', () => {
      const original = new Date(2025, 9, 15, 10, 30)
      getEndOfDay(original)

      expect(original.getHours()).toBe(10)
      expect(original.getMinutes()).toBe(30)
    })
  })
})
