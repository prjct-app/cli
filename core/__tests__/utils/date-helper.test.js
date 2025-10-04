import { describe, it, expect } from 'vitest'
import * as dateHelper from '../../utils/date-helper.js'

describe('Date Helper', () => {
  describe('formatDate()', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2025, 9, 4, 12, 0, 0) // October 4, 2025
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should pad single digit month', () => {
      const date = new Date(2025, 2, 15) // March 15, 2025
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toContain('-03-')
    })

    it('should pad single digit day', () => {
      const date = new Date(2025, 9, 5) // October 5, 2025
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toContain('-05')
    })

    it('should handle edge case dates', () => {
      const date = new Date(2025, 0, 1) // January 1, 2025
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toBe('2025-01-01')
    })

    it('should handle end of year', () => {
      const date = new Date(2025, 11, 31) // December 31, 2025
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toBe('2025-12-31')
    })
  })

  describe('formatMonth()', () => {
    it('should format date to YYYY-MM', () => {
      const date = new Date('2025-10-04')
      const formatted = dateHelper.formatMonth(date)

      expect(formatted).toMatch(/^\d{4}-\d{2}$/)
      expect(formatted).toBe('2025-10')
    })

    it('should pad single digit month', () => {
      const date = new Date('2025-03-15')
      const formatted = dateHelper.formatMonth(date)

      expect(formatted).toBe('2025-03')
    })

    it('should handle January', () => {
      const date = new Date('2025-01-15')
      const formatted = dateHelper.formatMonth(date)

      expect(formatted).toBe('2025-01')
    })

    it('should handle December', () => {
      const date = new Date('2025-12-25')
      const formatted = dateHelper.formatMonth(date)

      expect(formatted).toBe('2025-12')
    })
  })

  describe('getTodayKey()', () => {
    it('should return today in YYYY-MM-DD format', () => {
      const today = dateHelper.getTodayKey()

      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should match formatDate for current date', () => {
      const today = dateHelper.getTodayKey()
      const now = dateHelper.formatDate(new Date())

      expect(today).toBe(now)
    })
  })

  describe('getDateKey()', () => {
    it('should return date key in YYYY-MM-DD format', () => {
      const date = new Date(2025, 9, 4) // October 4, 2025
      const key = dateHelper.getDateKey(date)

      expect(key).toBe('2025-10-04')
    })

    it('should be alias for formatDate', () => {
      const date = new Date(2025, 9, 4) // October 4, 2025

      expect(dateHelper.getDateKey(date)).toBe(dateHelper.formatDate(date))
    })
  })

  describe('getTimestamp()', () => {
    it('should return ISO timestamp', () => {
      const timestamp = dateHelper.getTimestamp()

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should be valid date string', () => {
      const timestamp = dateHelper.getTimestamp()
      const date = new Date(timestamp)

      expect(date.toString()).not.toBe('Invalid Date')
    })
  })

  describe('calculateDuration()', () => {
    it('should calculate duration in minutes', () => {
      const start = new Date('2025-10-04T10:00:00Z')
      const end = new Date('2025-10-04T10:30:00Z')
      const duration = dateHelper.calculateDuration(start, end)

      expect(duration).toContain('30m')
    })

    it('should calculate duration in hours and minutes', () => {
      const start = new Date('2025-10-04T10:00:00Z')
      const end = new Date('2025-10-04T12:30:00Z')
      const duration = dateHelper.calculateDuration(start, end)

      expect(duration).toContain('2h')
      expect(duration).toContain('30m')
    })

    it('should handle exact hours', () => {
      const start = new Date('2025-10-04T10:00:00Z')
      const end = new Date('2025-10-04T13:00:00Z')
      const duration = dateHelper.calculateDuration(start, end)

      expect(duration).toContain('3h')
    })

    it('should handle less than 1 minute', () => {
      const start = new Date('2025-10-04T10:00:00Z')
      const end = new Date('2025-10-04T10:00:30Z')
      const duration = dateHelper.calculateDuration(start, end)

      expect(duration).toContain('30s')
    })
  })

  describe('Edge Cases', () => {
    it('should handle leap year', () => {
      const date = new Date(2024, 1, 29) // February 29, 2024
      const formatted = dateHelper.formatDate(date)

      expect(formatted).toBe('2024-02-29')
    })

    it('should handle different years', () => {
      const date2024 = new Date(2024, 9, 4) // October 4, 2024
      const date2025 = new Date(2025, 9, 4) // October 4, 2025

      expect(dateHelper.formatDate(date2024)).toBe('2024-10-04')
      expect(dateHelper.formatDate(date2025)).toBe('2025-10-04')
    })
  })
})
