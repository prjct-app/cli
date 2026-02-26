/**
 * SessionTracker - Lightweight session state tracking for multi-command workflows
 *
 * Tracks command sequences and file access across CLI invocations.
 * Sessions auto-create on first command and expire after 30 min idle.
 *
 * Storage: ~/.prjct-cli/projects/{projectId}/storage/session.json
 *
 * @see PRJ-109
 */

import { SESSION_IDLE_TIMEOUT_MS } from '../constants/timings'
import { prjctDb } from '../storage/database'
import type { SessionData, SessionFile, SessionInfo } from '../types/services.js'
import { isExpired as isTTLExpired } from '../utils/cache'
import { formatDuration, getTimestamp } from '../utils/date-helper'

const MAX_COMMAND_HISTORY = 50
const MAX_FILE_HISTORY = 200

// =============================================================================
// SESSION TRACKER
// =============================================================================

class SessionTracker {
  /**
   * Read session data from SQLite
   */
  private async read(projectId: string): Promise<SessionFile> {
    try {
      const doc = prjctDb.getDoc<SessionFile>(projectId, 'session-tracker')
      return doc ?? this.getDefault()
    } catch {
      return this.getDefault()
    }
  }

  /**
   * Write session data to SQLite
   */
  private async write(projectId: string, data: SessionFile): Promise<void> {
    prjctDb.setDoc(projectId, 'session-tracker', data)
  }

  private getDefault(): SessionFile {
    return {
      current: null,
      config: {
        idleTimeoutMs: SESSION_IDLE_TIMEOUT_MS,
      },
    }
  }

  /**
   * Check if a session has expired based on idle timeout
   */
  private isExpired(session: SessionData, timeoutMs: number): boolean {
    return isTTLExpired(session.lastActivity, timeoutMs)
  }

  /**
   * Touch session — create new or resume existing.
   * Called at the start of every CLI command.
   * Returns the active session.
   */
  async touch(projectId: string): Promise<SessionData> {
    const file = await this.read(projectId)
    const now = getTimestamp()

    // If active session exists and not expired, resume it
    if (file.current && !this.isExpired(file.current, file.config.idleTimeoutMs)) {
      file.current.lastActivity = now
      await this.write(projectId, file)
      return file.current
    }

    // Create new session (old one expired or doesn't exist)
    const session: SessionData = {
      id: crypto.randomUUID(),
      projectId,
      status: 'active',
      createdAt: now,
      lastActivity: now,
      commands: [],
      files: [],
    }

    file.current = session
    await this.write(projectId, file)
    return session
  }

  /**
   * Record a command execution in the current session
   */
  async trackCommand(projectId: string, command: string, durationMs: number): Promise<void> {
    const file = await this.read(projectId)
    if (!file.current) return

    const now = getTimestamp()
    file.current.lastActivity = now
    file.current.commands.push({
      command,
      timestamp: now,
      durationMs,
    })

    // Trim old commands if over limit
    if (file.current.commands.length > MAX_COMMAND_HISTORY) {
      file.current.commands = file.current.commands.slice(-MAX_COMMAND_HISTORY)
    }

    await this.write(projectId, file)
  }

  /**
   * Record a file access in the current session
   */
  async trackFile(projectId: string, filePath: string, operation: 'read' | 'write'): Promise<void> {
    const file = await this.read(projectId)
    if (!file.current) return

    const now = getTimestamp()
    file.current.lastActivity = now
    file.current.files.push({
      path: filePath,
      operation,
      timestamp: now,
    })

    // Trim old file records if over limit
    if (file.current.files.length > MAX_FILE_HISTORY) {
      file.current.files = file.current.files.slice(-MAX_FILE_HISTORY)
    }

    await this.write(projectId, file)
  }

  /**
   * Get session info for display (used by `prjct status`)
   */
  async getInfo(projectId: string): Promise<SessionInfo> {
    const file = await this.read(projectId)

    if (!file.current || this.isExpired(file.current, file.config.idleTimeoutMs)) {
      return {
        active: false,
        id: null,
        duration: null,
        idleSince: null,
        idleMs: 0,
        expiresIn: null,
        commandCount: 0,
        commands: [],
        filesRead: 0,
        filesWritten: 0,
      }
    }

    const session = file.current
    const now = Date.now()
    const createdAt = new Date(session.createdAt).getTime()
    const lastActivity = new Date(session.lastActivity).getTime()
    const idleMs = now - lastActivity
    const timeoutMs = file.config.idleTimeoutMs
    const expiresInMs = Math.max(0, timeoutMs - idleMs)

    const uniqueCommands = session.commands.map((c) => c.command)
    const filesRead = new Set(
      session.files.filter((f) => f.operation === 'read').map((f) => f.path)
    ).size
    const filesWritten = new Set(
      session.files.filter((f) => f.operation === 'write').map((f) => f.path)
    ).size

    return {
      active: true,
      id: session.id,
      duration: formatDuration(now - createdAt),
      idleSince: session.lastActivity,
      idleMs,
      expiresIn: formatDuration(expiresInMs),
      commandCount: session.commands.length,
      commands: uniqueCommands,
      filesRead,
      filesWritten,
    }
  }

  /**
   * Expire the current session (cleanup)
   */
  async expire(projectId: string): Promise<void> {
    const file = await this.read(projectId)
    if (file.current) {
      file.current.status = 'expired'
      file.current = null
      await this.write(projectId, file)
    }
  }

  /**
   * Check and expire stale session if needed.
   * Called on startup to clean up leftover sessions.
   * Returns true if a session was expired.
   */
  async expireIfStale(projectId: string): Promise<boolean> {
    const file = await this.read(projectId)
    if (file.current && this.isExpired(file.current, file.config.idleTimeoutMs)) {
      file.current = null
      await this.write(projectId, file)
      return true
    }
    return false
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const sessionTracker = new SessionTracker()
export default sessionTracker
