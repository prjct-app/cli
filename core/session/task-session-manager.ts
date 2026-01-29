/**
 * TaskSessionManager Class
 * Manages task lifecycle: create, pause, resume, complete
 * Tracks metrics, timeline, and archives completed sessions.
 */

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { emit } from '../bus'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import type { Session, SessionMetrics } from '../types'
import { isNotFoundError } from '../types/fs'
import { calculateDuration, formatDuration, generateId } from './utils'

const execAsync = promisify(exec)

export class TaskSessionManager {
  private projectPath: string
  private projectId: string | null
  private sessionDir: string | null
  private initialized: boolean

  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.projectId = null
    this.sessionDir = null
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

    const globalPath = pathManager.getGlobalProjectPath(this.projectId)
    this.sessionDir = path.join(globalPath, 'sessions')

    await fs.mkdir(this.sessionDir, { recursive: true })
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

    const currentPath = path.join(this.sessionDir!, 'current.json')
    try {
      const content = await fs.readFile(currentPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return null
      }
      throw error
    }
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

    // Save as current session
    await this.saveCurrent(session)

    // Log to session history
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

    await this.saveCurrent(current)
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

    await this.saveCurrent(current)
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

    // Archive session
    await this.archive(current)

    // Clear current
    await this.clearCurrent()

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
      // Keep existing metrics if git fails (not a repo, git not installed, etc.)
      // This is expected in non-git projects
      if (!isNotFoundError(error)) {
        // Log unexpected errors but don't fail
        console.error(`Metrics calculation warning: ${(error as Error).message}`)
      }
    }

    return metrics
  }

  /**
   * Save current session
   */
  async saveCurrent(session: Session): Promise<void> {
    const currentPath = path.join(this.sessionDir!, 'current.json')
    await fs.writeFile(currentPath, JSON.stringify(session, null, 2))
  }

  /**
   * Clear current session file
   */
  async clearCurrent(): Promise<void> {
    const currentPath = path.join(this.sessionDir!, 'current.json')
    try {
      await fs.unlink(currentPath)
    } catch (error) {
      // File might not exist - that's ok
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  /**
   * Archive completed session
   */
  async archive(session: Session): Promise<void> {
    const date = new Date(session.completedAt!)
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const archiveDir = path.join(this.sessionDir!, 'archive', yearMonth)

    await fs.mkdir(archiveDir, { recursive: true })

    const archivePath = path.join(archiveDir, `${session.id}.json`)
    await fs.writeFile(archivePath, JSON.stringify(session, null, 2))
  }

  /**
   * Get session history
   */
  async getHistory(limit: number = 10): Promise<Session[]> {
    if (!this.initialized) await this.initialize()

    const sessions: Session[] = []
    const archiveDir = path.join(this.sessionDir!, 'archive')

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
    } catch (error) {
      // Archive might not exist yet
      if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
        throw error
      }
    }

    return sessions
  }

  /**
   * Log event to memory
   */
  async logEvent(action: string, data: Record<string, unknown>): Promise<void> {
    const globalPath = pathManager.getGlobalProjectPath(this.projectId!)
    const memoryPath = path.join(globalPath, 'memory', 'context.jsonl')

    const entry = `${JSON.stringify({
      timestamp: new Date().toISOString(),
      action,
      ...data,
    })}\n`

    try {
      await fs.appendFile(memoryPath, entry)
    } catch (error) {
      // Memory file might not exist - that's ok
      if (!isNotFoundError(error)) {
        throw error
      }
    }
  }

  /**
   * Format duration as human readable
   */
  static formatDuration(seconds: number): string {
    return formatDuration(seconds)
  }
}
