/**
 * SessionTracker - Lightweight session state tracking for multi-command workflows
 *
 * Tracks command sequences across CLI invocations. Sessions auto-create on
 * first command and expire after 30 min idle.
 *
 * Schema v2: typed tables (`cli_sessions` + `cli_session_commands`) replace
 * the `kv_store['session-tracker']` blob, which was read-modify-written up to
 * 3× per CLI command with the whole command history inside. Typed writes are
 * append-only INSERTs + a one-column touch — strictly cheaper AND queryable.
 *
 * File tracking (`trackFile`) was removed: zero callers (dead API); the
 * SessionInfo fields it fed report 0.
 *
 * @see PRJ-109
 */

import { SESSION_IDLE_TIMEOUT_MS } from '../constants/timings'
import { prjctDb } from '../storage/database'
import type { SessionData, SessionInfo } from '../types/services.js'
import { isExpired as isTTLExpired } from '../utils/cache'
import { formatDuration, getTimestamp } from '../utils/date-helper'

const MAX_COMMAND_HISTORY = 50

interface SessionRow {
  id: string
  status: string
  created_at: string
  last_activity: string
}

// SESSION TRACKER

class SessionTracker {
  /** The current (most recent, active-status) session row, if any. */
  private currentRow(projectId: string): SessionRow | null {
    try {
      return (
        prjctDb.get<SessionRow>(
          projectId,
          "SELECT * FROM cli_sessions WHERE status = 'active' ORDER BY last_activity DESC LIMIT 1"
        ) ?? null
      )
    } catch {
      return null
    }
  }

  private isExpired(lastActivity: string): boolean {
    return isTTLExpired(lastActivity, SESSION_IDLE_TIMEOUT_MS)
  }

  private toSessionData(projectId: string, row: SessionRow): SessionData {
    return {
      id: row.id,
      projectId,
      status: row.status as SessionData['status'],
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      commands: [],
      files: [],
    }
  }

  /**
   * Touch session — create new or resume existing.
   * Called at the start of every CLI command.
   * Returns the active session.
   */
  async touch(projectId: string): Promise<SessionData> {
    const now = getTimestamp()
    const current = this.currentRow(projectId)
    if (current && !this.isExpired(current.last_activity)) {
      prjctDb.run(
        projectId,
        'UPDATE cli_sessions SET last_activity = ? WHERE id = ?',
        now,
        current.id
      )
      return this.toSessionData(projectId, { ...current, last_activity: now })
    }

    if (current) {
      // Stale — close it before opening a fresh one.
      prjctDb.run(projectId, "UPDATE cli_sessions SET status = 'expired' WHERE id = ?", current.id)
    }
    const id = crypto.randomUUID()
    prjctDb.run(
      projectId,
      "INSERT INTO cli_sessions (id, status, created_at, last_activity) VALUES (?, 'active', ?, ?)",
      id,
      now,
      now
    )
    return this.toSessionData(projectId, {
      id,
      status: 'active',
      created_at: now,
      last_activity: now,
    })
  }

  /**
   * Record a command execution in the current session — one append-only
   * INSERT (the blob used to rewrite its whole command history here).
   */
  async trackCommand(projectId: string, command: string, durationMs: number): Promise<void> {
    const current = this.currentRow(projectId)
    if (!current) return
    const now = getTimestamp()
    try {
      prjctDb.run(
        projectId,
        'INSERT INTO cli_session_commands (session_id, command, timestamp, duration_ms) VALUES (?, ?, ?, ?)',
        current.id,
        command,
        now,
        Math.round(durationMs)
      )
      prjctDb.run(
        projectId,
        'UPDATE cli_sessions SET last_activity = ? WHERE id = ?',
        now,
        current.id
      )
    } catch {
      /* session telemetry only */
    }
  }

  /**
   * Get session info for display (used by `prjct status`)
   */
  async getInfo(projectId: string): Promise<SessionInfo> {
    const current = this.currentRow(projectId)
    if (!current || this.isExpired(current.last_activity)) {
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

    const now = Date.now()
    const createdAt = new Date(current.created_at).getTime()
    const lastActivity = new Date(current.last_activity).getTime()
    const idleMs = now - lastActivity
    const expiresInMs = Math.max(0, SESSION_IDLE_TIMEOUT_MS - idleMs)

    const commandRows = prjctDb.query<{ command: string }>(
      projectId,
      'SELECT command FROM cli_session_commands WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?',
      current.id,
      MAX_COMMAND_HISTORY
    )

    return {
      active: true,
      id: current.id,
      duration: formatDuration(now - createdAt),
      idleSince: current.last_activity,
      idleMs,
      expiresIn: formatDuration(expiresInMs),
      commandCount: commandRows.length,
      commands: commandRows.map((c) => c.command).reverse(),
      // File tracking was a dead API (zero writers) — honest zeros.
      filesRead: 0,
      filesWritten: 0,
    }
  }

  /**
   * Expire the current session (cleanup)
   */
  async expire(projectId: string): Promise<void> {
    try {
      prjctDb.run(projectId, "UPDATE cli_sessions SET status = 'expired' WHERE status = 'active'")
    } catch {
      /* best-effort */
    }
  }

  /**
   * Check and expire stale session if needed.
   * Called on startup to clean up leftover sessions.
   * Returns true if a session was expired.
   */
  async expireIfStale(projectId: string): Promise<boolean> {
    const current = this.currentRow(projectId)
    if (current && this.isExpired(current.last_activity)) {
      prjctDb.run(projectId, "UPDATE cli_sessions SET status = 'expired' WHERE id = ?", current.id)
      return true
    }
    return false
  }
}

// EXPORTS

export const sessionTracker = new SessionTracker()
