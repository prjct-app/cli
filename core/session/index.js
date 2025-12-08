/**
 * SessionManager - Structured Session Tracking
 *
 * Tracks work sessions with metrics, timeline, and duration.
 * Inspired by OpenCode's session system but simplified.
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/sessions/
 *
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const pathManager = require('../infrastructure/path-manager')
const configManager = require('../infrastructure/config-manager')
const { eventBus, emit } = require('../bus')

/**
 * Session Schema
 * @typedef {Object} Session
 * @property {string} id - Unique session ID (sess_xxxx)
 * @property {string} projectId - Project identifier
 * @property {string} task - Task description
 * @property {'active'|'paused'|'completed'} status - Current status
 * @property {string} startedAt - ISO timestamp when started
 * @property {string} [pausedAt] - ISO timestamp when paused
 * @property {string} [completedAt] - ISO timestamp when completed
 * @property {number} duration - Total duration in seconds
 * @property {Object} metrics - Automatic metrics
 * @property {Array} timeline - Event history
 */

class SessionManager {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.projectId = null
    this.sessionDir = null
    this.initialized = false
  }

  /**
   * Initialize session manager for project
   */
  async initialize() {
    this.projectId = await configManager.getProjectId(this.projectPath)
    if (!this.projectId) {
      throw new Error('No prjct project found. Run /p:init first.')
    }

    const globalPath = pathManager.getGlobalProjectPath(this.projectId)
    this.sessionDir = path.join(globalPath, 'sessions')

    await fs.mkdir(this.sessionDir, { recursive: true })
    this.initialized = true
  }

  /**
   * Generate unique session ID
   */
  generateId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = 'sess_'
    for (let i = 0; i < 8; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return id
  }

  /**
   * Get current active session
   * @returns {Promise<Session|null>}
   */
  async getCurrent() {
    if (!this.initialized) await this.initialize()

    const currentPath = path.join(this.sessionDir, 'current.json')
    try {
      const content = await fs.readFile(currentPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Create a new session
   * @param {string} task - Task description
   * @returns {Promise<Session>}
   */
  async create(task) {
    if (!this.initialized) await this.initialize()

    // Check if there's already an active session
    const current = await this.getCurrent()
    if (current && current.status === 'active') {
      throw new Error(`Session already active: "${current.task}". Use /p:done or /p:pause first.`)
    }

    const now = new Date().toISOString()
    const session = {
      id: this.generateId(),
      projectId: this.projectId,
      task,
      status: 'active',
      startedAt: now,
      pausedAt: null,
      completedAt: null,
      duration: 0,
      metrics: {
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
        commits: 0,
        snapshots: []
      },
      timeline: [
        { type: 'start', at: now }
      ]
    }

    // Save as current session
    await this.saveCurrent(session)

    // Log to session history
    await this.logEvent('session_started', { sessionId: session.id, task })

    // Emit event for plugins
    await emit.sessionStarted({
      sessionId: session.id,
      task,
      projectId: this.projectId
    })

    return session
  }

  /**
   * Resume a paused session or continue active session
   * @param {string} [task] - Optional new task (creates new session if provided)
   * @returns {Promise<Session>}
   */
  async resume(task = null) {
    if (!this.initialized) await this.initialize()

    const current = await this.getCurrent()

    // If task provided and different from current, create new session
    if (task && (!current || current.task !== task)) {
      return this.create(task)
    }

    // If no current session, need a task
    if (!current) {
      if (!task) {
        throw new Error('No active session. Provide a task to start one.')
      }
      return this.create(task)
    }

    // If already active, just return it
    if (current.status === 'active') {
      return current
    }

    // Resume paused session
    const now = new Date().toISOString()
    current.status = 'active'
    current.timeline.push({ type: 'resume', at: now })

    await this.saveCurrent(current)
    await this.logEvent('session_resumed', { sessionId: current.id })

    // Emit event for plugins
    await emit.sessionResumed({
      sessionId: current.id,
      task: current.task,
      projectId: this.projectId
    })

    return current
  }

  /**
   * Pause current session
   * @returns {Promise<Session>}
   */
  async pause() {
    if (!this.initialized) await this.initialize()

    const current = await this.getCurrent()
    if (!current) {
      throw new Error('No active session to pause.')
    }

    if (current.status === 'paused') {
      return current // Already paused
    }

    const now = new Date().toISOString()
    current.status = 'paused'
    current.pausedAt = now
    current.duration = this.calculateDuration(current)
    current.timeline.push({ type: 'pause', at: now })

    await this.saveCurrent(current)
    await this.logEvent('session_paused', { sessionId: current.id, duration: current.duration })

    // Emit event for plugins
    await emit.sessionPaused({
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      projectId: this.projectId
    })

    return current
  }

  /**
   * Complete current session
   * @returns {Promise<Session>}
   */
  async complete() {
    if (!this.initialized) await this.initialize()

    const current = await this.getCurrent()
    if (!current) {
      throw new Error('No active session to complete.')
    }

    const now = new Date().toISOString()
    current.status = 'completed'
    current.completedAt = now
    current.duration = this.calculateDuration(current)
    current.metrics = await this.calculateMetrics(current)
    current.timeline.push({ type: 'complete', at: now })

    // Archive session
    await this.archive(current)

    // Clear current
    await this.clearCurrent()

    // Log completion
    await this.logEvent('session_completed', {
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      metrics: current.metrics
    })

    // Emit event for plugins
    await emit.sessionCompleted({
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      metrics: current.metrics,
      projectId: this.projectId
    })

    return current
  }

  /**
   * Calculate total duration in seconds
   * @param {Session} session
   * @returns {number}
   */
  calculateDuration(session) {
    let totalMs = 0
    let lastStart = null

    for (const event of session.timeline) {
      if (event.type === 'start' || event.type === 'resume') {
        lastStart = new Date(event.at)
      } else if (event.type === 'pause' || event.type === 'complete') {
        if (lastStart) {
          totalMs += new Date(event.at) - lastStart
          lastStart = null
        }
      }
    }

    // If still active, count from last start to now
    if (lastStart && session.status === 'active') {
      totalMs += Date.now() - lastStart
    }

    return Math.round(totalMs / 1000)
  }

  /**
   * Calculate metrics for session
   * @param {Session} session
   * @returns {Promise<Object>}
   */
  async calculateMetrics(session) {
    const metrics = { ...session.metrics }

    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)

      // Get git stats since session start
      const since = session.startedAt.split('T')[0]

      // Count commits
      const { stdout: commitCount } = await execAsync(
        `git rev-list --count --since="${since}" HEAD 2>/dev/null || echo "0"`,
        { cwd: this.projectPath }
      )
      metrics.commits = parseInt(commitCount.trim()) || 0

      // Get diff stats
      const { stdout: diffStat } = await execAsync(
        `git diff --stat HEAD~${Math.max(metrics.commits, 1)} 2>/dev/null || echo ""`,
        { cwd: this.projectPath }
      )

      // Parse diff stats
      const lines = diffStat.split('\n')
      const summaryLine = lines[lines.length - 2] || ''
      const match = summaryLine.match(/(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/)

      if (match) {
        metrics.filesChanged = parseInt(match[1]) || 0
        metrics.linesAdded = parseInt(match[2]) || 0
        metrics.linesRemoved = parseInt(match[3]) || 0
      }
    } catch {
      // Keep existing metrics if git fails
    }

    return metrics
  }

  /**
   * Save current session
   * @param {Session} session
   */
  async saveCurrent(session) {
    const currentPath = path.join(this.sessionDir, 'current.json')
    await fs.writeFile(currentPath, JSON.stringify(session, null, 2))
  }

  /**
   * Clear current session file
   */
  async clearCurrent() {
    const currentPath = path.join(this.sessionDir, 'current.json')
    try {
      await fs.unlink(currentPath)
    } catch {
      // File might not exist
    }
  }

  /**
   * Archive completed session
   * @param {Session} session
   */
  async archive(session) {
    const date = new Date(session.completedAt)
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const archiveDir = path.join(this.sessionDir, 'archive', yearMonth)

    await fs.mkdir(archiveDir, { recursive: true })

    const archivePath = path.join(archiveDir, `${session.id}.json`)
    await fs.writeFile(archivePath, JSON.stringify(session, null, 2))
  }

  /**
   * Get session history
   * @param {number} limit - Max sessions to return
   * @returns {Promise<Session[]>}
   */
  async getHistory(limit = 10) {
    if (!this.initialized) await this.initialize()

    const sessions = []
    const archiveDir = path.join(this.sessionDir, 'archive')

    try {
      const months = await fs.readdir(archiveDir)
      const sortedMonths = months.sort().reverse()

      for (const month of sortedMonths) {
        if (sessions.length >= limit) break

        const monthDir = path.join(archiveDir, month)
        const files = await fs.readdir(monthDir)

        for (const file of files.sort().reverse()) {
          if (sessions.length >= limit) break
          if (!file.endsWith('.json')) continue

          const content = await fs.readFile(path.join(monthDir, file), 'utf-8')
          sessions.push(JSON.parse(content))
        }
      }
    } catch {
      // Archive might not exist yet
    }

    return sessions
  }

  /**
   * Log event to memory
   * @param {string} action
   * @param {Object} data
   */
  async logEvent(action, data) {
    const globalPath = pathManager.getGlobalProjectPath(this.projectId)
    const memoryPath = path.join(globalPath, 'memory', 'context.jsonl')

    const entry = JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      ...data
    }) + '\n'

    try {
      await fs.appendFile(memoryPath, entry)
    } catch {
      // Memory file might not exist
    }
  }

  /**
   * Format duration as human readable
   * @param {number} seconds
   * @returns {string}
   */
  static formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.round((seconds % 3600) / 60)

    if (minutes === 0) return `${hours}h`
    return `${hours}h ${minutes}m`
  }
}

module.exports = SessionManager
