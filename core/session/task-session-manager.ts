/**
 * TaskSessionManager Class
 * Manages task lifecycle: create, pause, resume, complete
 * Tracks metrics, timeline, and archives completed sessions.
 *
 * Storage: SQLite sessions table (migration 7)
 */

import { emit } from '../events/pub-sub'
import configManager from '../infrastructure/config-manager'
import { prjctDb } from '../storage/database'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { Session, SessionMetrics } from '../types/session'
import { execAsync } from '../utils/exec'
import { calculateDuration, formatDuration, generateId } from './utils'

interface SessionRow {
  id: string
  project_id: string
  task: string
  status: string
  started_at: string
  paused_at: string | null
  completed_at: string | null
  duration: number
  metrics: string
  timeline: string
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    projectId: row.project_id,
    task: row.task,
    status: row.status as Session['status'],
    startedAt: row.started_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    duration: row.duration,
    metrics: JSON.parse(row.metrics),
    timeline: JSON.parse(row.timeline),
  }
}

export class TaskSessionManager {
  private projectPath: string
  private projectId: string | null
  private initialized: boolean

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.projectId = null
    this.initialized = false
  }

  /**
   * Initialize session manager for project
   */
  async initialize(): Promise<void> {
    this.projectId = await configManager.getProjectId(this.projectPath)
    if (!this.projectId) {
      throw new Error('No prjct project found. Run /p:init first.')
    }
    // Ensure DB is ready (triggers migrations)
    prjctDb.getDb(this.projectId)
    this.initialized = true
  }

  /**
   * Generate unique session ID
   */
  generateId(): string {
    return generateId()
  }

  /**
   * Get current active session
   */
  async getCurrent(): Promise<Session | null> {
    if (!this.initialized) await this.initialize()

    const row = prjctDb.get<SessionRow>(
      this.projectId!,
      "SELECT * FROM sessions WHERE project_id = ? AND status IN ('active', 'paused') ORDER BY started_at DESC LIMIT 1",
      this.projectId!
    )

    return row ? rowToSession(row) : null
  }

  /**
   * Create a new session
   */
  async create(task: string): Promise<Session> {
    if (!this.initialized) await this.initialize()

    // Check if there's already an active session
    const current = await this.getCurrent()
    if (current && current.status === 'active') {
      throw new Error(`Session already active: "${current.task}". Use /p:done or /p:pause first.`)
    }

    const now = new Date().toISOString()
    const session: Session = {
      id: this.generateId(),
      projectId: this.projectId!,
      task,
      status: 'active',
      startedAt: now,
      pausedAt: null,
      completedAt: null,
      duration: 0,
      metrics: {
        filesCreated: 0,
        filesChanged: 0,
        filesModified: 0,
        linesAdded: 0,
        linesRemoved: 0,
        commits: 0,
        snapshots: [],
      },
      timeline: [{ type: 'start', at: now }],
    }

    // Save to SQLite
    this.saveSession(session)

    // Log to event log
    await this.logEvent('session_started', { sessionId: session.id, task })

    // Emit event for plugins
    await emit.sessionStarted({
      sessionId: session.id,
      task,
      projectId: this.projectId,
    })

    return session
  }

  /**
   * Resume a paused session or continue active session
   */
  async resume(task: string | null = null): Promise<Session> {
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

    this.saveSession(current)
    await this.logEvent('session_resumed', { sessionId: current.id })

    // Emit event for plugins
    await emit.sessionResumed({
      sessionId: current.id,
      task: current.task,
      projectId: this.projectId,
    })

    return current
  }

  /**
   * Pause current session
   */
  async pause(): Promise<Session> {
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
    current.duration = calculateDuration(current)
    current.timeline.push({ type: 'pause', at: now })

    this.saveSession(current)
    await this.logEvent('session_paused', { sessionId: current.id, duration: current.duration })

    // Emit event for plugins
    await emit.sessionPaused({
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      projectId: this.projectId,
    })

    return current
  }

  /**
   * Complete current session
   */
  async complete(): Promise<Session> {
    if (!this.initialized) await this.initialize()

    const current = await this.getCurrent()
    if (!current) {
      throw new Error('No active session to complete.')
    }

    const now = new Date().toISOString()
    current.status = 'completed'
    current.completedAt = now
    current.duration = calculateDuration(current)
    current.metrics = await this.calculateMetrics(current)
    current.timeline.push({ type: 'complete', at: now })

    // Update in SQLite (no separate archive step needed)
    this.saveSession(current)

    // Log completion
    await this.logEvent('session_completed', {
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      metrics: current.metrics,
    })

    // Emit event for plugins
    await emit.sessionCompleted({
      sessionId: current.id,
      task: current.task,
      duration: current.duration,
      metrics: current.metrics,
      projectId: this.projectId,
    })

    return current
  }

  /**
   * Calculate total duration in seconds
   */
  calculateDuration(session: Session): number {
    return calculateDuration(session)
  }

  /**
   * Calculate metrics for session
   */
  async calculateMetrics(session: Session): Promise<SessionMetrics> {
    const metrics = { ...session.metrics }

    try {
      // Get git stats since session start
      const since = session.startedAt.split('T')[0]

      // Count commits
      const { stdout: commitCount } = await execAsync(
        `git rev-list --count --since="${since}" HEAD 2>/dev/null || echo "0"`,
        { cwd: this.projectPath }
      )
      metrics.commits = parseInt(commitCount.trim(), 10) || 0

      // Get diff stats
      const { stdout: diffStat } = await execAsync(
        `git diff --stat HEAD~${Math.max(metrics.commits, 1)} 2>/dev/null || echo ""`,
        { cwd: this.projectPath }
      )

      // Parse diff stats
      const lines = diffStat.split('\n')
      const summaryLine = lines[lines.length - 2] || ''
      const match = summaryLine.match(
        /(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/
      )

      if (match) {
        metrics.filesChanged = parseInt(match[1], 10) || 0
        metrics.linesAdded = parseInt(match[2], 10) || 0
        metrics.linesRemoved = parseInt(match[3], 10) || 0
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error(`Metrics calculation warning: ${getErrorMessage(error)}`)
      }
    }

    return metrics
  }

  /**
   * Save session to SQLite (insert or update)
   */
  private saveSession(session: Session): void {
    prjctDb.run(
      this.projectId!,
      `INSERT OR REPLACE INTO sessions (id, project_id, task, status, started_at, paused_at, completed_at, duration, metrics, timeline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.projectId,
      session.task,
      session.status,
      session.startedAt,
      session.pausedAt ?? null,
      session.completedAt ?? null,
      session.duration,
      JSON.stringify(session.metrics),
      JSON.stringify(session.timeline)
    )
  }

  /**
   * Get session history
   */
  async getHistory(limit = 10): Promise<Session[]> {
    if (!this.initialized) await this.initialize()

    const rows = prjctDb.query<SessionRow>(
      this.projectId!,
      "SELECT * FROM sessions WHERE project_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT ?",
      this.projectId!,
      limit
    )

    return rows.map(rowToSession)
  }

  /**
   * Log event to memory
   */
  async logEvent(action: string, data: Record<string, unknown>): Promise<void> {
    try {
      prjctDb.appendEvent(this.projectId!, `session.${action}`, data)
    } catch {
      // Database might not be initialized yet - that's ok
    }
  }

  /**
   * Format duration as human readable
   */
  static formatDuration(seconds: number): string {
    return formatDuration(seconds)
  }
}
