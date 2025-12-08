/**
 * SessionMetrics - Metrics Calculation and Aggregation
 *
 * Calculates productivity metrics from session data.
 *
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const pathManager = require('../infrastructure/path-manager')

class SessionMetrics {
  constructor(projectId) {
    this.projectId = projectId
  }

  /**
   * Get aggregated metrics for a time period
   * @param {'day'|'week'|'month'|'all'} period
   * @returns {Promise<Object>}
   */
  async getMetrics(period = 'week') {
    const sessions = await this.getSessionsForPeriod(period)

    return {
      period,
      totalSessions: sessions.length,
      totalDuration: this.sumDurations(sessions),
      totalDurationFormatted: this.formatDuration(this.sumDurations(sessions)),
      averageDuration: this.averageDuration(sessions),
      averageDurationFormatted: this.formatDuration(this.averageDuration(sessions)),
      tasksCompleted: sessions.filter(s => s.status === 'completed').length,
      filesChanged: this.sumMetric(sessions, 'filesChanged'),
      linesAdded: this.sumMetric(sessions, 'linesAdded'),
      linesRemoved: this.sumMetric(sessions, 'linesRemoved'),
      commits: this.sumMetric(sessions, 'commits'),
      productivityScore: this.calculateProductivityScore(sessions),
      streak: await this.calculateStreak(),
      byDay: this.groupByDay(sessions)
    }
  }

  /**
   * Get sessions for a given period
   * @param {string} period
   * @returns {Promise<Array>}
   */
  async getSessionsForPeriod(period) {
    const globalPath = pathManager.getGlobalProjectPath(this.projectId)
    const archiveDir = path.join(globalPath, 'sessions', 'archive')

    const sessions = []
    const cutoffDate = this.getCutoffDate(period)

    try {
      const months = await fs.readdir(archiveDir)

      for (const month of months) {
        const monthDir = path.join(archiveDir, month)
        const files = await fs.readdir(monthDir)

        for (const file of files) {
          if (!file.endsWith('.json')) continue

          const content = await fs.readFile(path.join(monthDir, file), 'utf-8')
          const session = JSON.parse(content)

          if (new Date(session.completedAt) >= cutoffDate) {
            sessions.push(session)
          }
        }
      }
    } catch {
      // Archive might not exist
    }

    // Also check current session
    try {
      const currentPath = path.join(globalPath, 'sessions', 'current.json')
      const content = await fs.readFile(currentPath, 'utf-8')
      const current = JSON.parse(content)
      if (new Date(current.startedAt) >= cutoffDate) {
        sessions.push(current)
      }
    } catch {
      // No current session
    }

    return sessions
  }

  /**
   * Get cutoff date for period
   * @param {string} period
   * @returns {Date}
   */
  getCutoffDate(period) {
    const now = new Date()

    switch (period) {
      case 'day':
        return new Date(now.setHours(0, 0, 0, 0))
      case 'week':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        return weekAgo
      case 'month':
        const monthAgo = new Date(now)
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        return monthAgo
      case 'all':
      default:
        return new Date(0) // Beginning of time
    }
  }

  /**
   * Sum durations from sessions
   * @param {Array} sessions
   * @returns {number} Total seconds
   */
  sumDurations(sessions) {
    return sessions.reduce((sum, s) => sum + (s.duration || 0), 0)
  }

  /**
   * Calculate average duration
   * @param {Array} sessions
   * @returns {number} Average seconds
   */
  averageDuration(sessions) {
    if (sessions.length === 0) return 0
    return Math.round(this.sumDurations(sessions) / sessions.length)
  }

  /**
   * Sum a specific metric
   * @param {Array} sessions
   * @param {string} metric
   * @returns {number}
   */
  sumMetric(sessions, metric) {
    return sessions.reduce((sum, s) => {
      return sum + (s.metrics?.[metric] || 0)
    }, 0)
  }

  /**
   * Calculate productivity score (0-100)
   * Based on consistency, duration, and output
   * @param {Array} sessions
   * @returns {number}
   */
  calculateProductivityScore(sessions) {
    if (sessions.length === 0) return 0

    // Factors:
    // 1. Session count (more = better, up to a point)
    const sessionScore = Math.min(sessions.length / 10, 1) * 30

    // 2. Average duration (25-90 min is optimal)
    const avgMins = this.averageDuration(sessions) / 60
    let durationScore = 0
    if (avgMins >= 25 && avgMins <= 90) {
      durationScore = 30
    } else if (avgMins > 0) {
      durationScore = Math.max(0, 30 - Math.abs(avgMins - 57.5) / 2)
    }

    // 3. Completion rate
    const completedCount = sessions.filter(s => s.status === 'completed').length
    const completionScore = (completedCount / sessions.length) * 20

    // 4. Output (commits + files changed)
    const totalOutput = this.sumMetric(sessions, 'commits') + this.sumMetric(sessions, 'filesChanged')
    const outputScore = Math.min(totalOutput / 50, 1) * 20

    return Math.round(sessionScore + durationScore + completionScore + outputScore)
  }

  /**
   * Calculate current streak (consecutive days with sessions)
   * @returns {Promise<number>}
   */
  async calculateStreak() {
    const sessions = await this.getSessionsForPeriod('month')

    // Get unique dates with sessions
    const dates = new Set(
      sessions.map(s => {
        const d = new Date(s.completedAt || s.startedAt)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )

    // Count consecutive days from today
    let streak = 0
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today)
      checkDate.setDate(checkDate.getDate() - i)
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`

      if (dates.has(key)) {
        streak++
      } else if (i > 0) {
        break // Streak broken
      }
    }

    return streak
  }

  /**
   * Group sessions by day
   * @param {Array} sessions
   * @returns {Object}
   */
  groupByDay(sessions) {
    const byDay = {}

    for (const session of sessions) {
      const date = new Date(session.completedAt || session.startedAt)
      const key = date.toISOString().split('T')[0]

      if (!byDay[key]) {
        byDay[key] = {
          sessions: 0,
          duration: 0,
          commits: 0
        }
      }

      byDay[key].sessions++
      byDay[key].duration += session.duration || 0
      byDay[key].commits += session.metrics?.commits || 0
    }

    return byDay
  }

  /**
   * Format duration as human readable
   * @param {number} seconds
   * @returns {string}
   */
  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)

    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
  }

  /**
   * Generate metrics summary for display
   * @param {'day'|'week'|'month'} period
   * @returns {Promise<string>}
   */
  async generateSummary(period = 'week') {
    const m = await this.getMetrics(period)

    const periodLabel = {
      day: 'Today',
      week: 'This Week',
      month: 'This Month',
      all: 'All Time'
    }[period]

    return `
## ${periodLabel}

| Metric | Value |
|--------|-------|
| Sessions | ${m.totalSessions} |
| Total Time | ${m.totalDurationFormatted} |
| Avg Session | ${m.averageDurationFormatted} |
| Tasks Done | ${m.tasksCompleted} |
| Files Changed | ${m.filesChanged} |
| Lines +/- | +${m.linesAdded} / -${m.linesRemoved} |
| Commits | ${m.commits} |
| Streak | ${m.streak} days |
| Score | ${m.productivityScore}/100 |
`.trim()
  }
}

module.exports = SessionMetrics
