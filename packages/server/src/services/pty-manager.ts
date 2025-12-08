/**
 * PTY Manager - Pseudo-Terminal for Claude Code CLI
 *
 * CRITICAL: This spawns Claude Code CLI using your existing subscription.
 * NO API costs - uses your Claude Max subscription via the CLI.
 */

import * as pty from 'node-pty'
import { EventEmitter } from 'events'

export interface PTYSession {
  id: string
  projectDir: string
  pty: pty.IPty
  createdAt: Date
  lastActivity: Date
}

class PTYManager extends EventEmitter {
  private sessions: Map<string, PTYSession> = new Map()

  /**
   * Create a new Claude Code PTY session
   */
  createSession(sessionId: string, projectDir: string): PTYSession {
    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!
    }

    // Spawn Claude Code CLI in a pseudo-terminal
    const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: projectDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      }
    })

    const session: PTYSession = {
      id: sessionId,
      projectDir,
      pty: ptyProcess,
      createdAt: new Date(),
      lastActivity: new Date()
    }

    // Start Claude Code CLI
    ptyProcess.write('claude\r')

    // Handle PTY output
    ptyProcess.onData((data) => {
      session.lastActivity = new Date()
      this.emit('output', { sessionId, data })
    })

    // Handle PTY exit
    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', { sessionId, exitCode, signal })
      this.sessions.delete(sessionId)
    })

    this.sessions.set(sessionId, session)
    this.emit('created', { sessionId, projectDir })

    return session
  }

  /**
   * Get an existing session
   */
  getSession(sessionId: string): PTYSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Write input to a PTY session
   */
  write(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.pty.write(data)
    session.lastActivity = new Date()
    return true
  }

  /**
   * Resize PTY terminal
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.pty.resize(cols, rows)
    return true
  }

  /**
   * Kill a PTY session
   */
  kill(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    session.pty.kill()
    this.sessions.delete(sessionId)
    this.emit('killed', { sessionId })
    return true
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): PTYSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * Cleanup inactive sessions (older than timeout)
   */
  cleanupInactive(timeoutMs: number = 30 * 60 * 1000): number {
    const now = Date.now()
    let cleaned = 0

    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity.getTime() > timeoutMs) {
        this.kill(sessionId)
        cleaned++
      }
    }

    return cleaned
  }
}

// Singleton instance
export const ptyManager = new PTYManager()

// Cleanup inactive sessions every 5 minutes
setInterval(() => {
  const cleaned = ptyManager.cleanupInactive()
  if (cleaned > 0) {
    console.log(`[PTY] Cleaned up ${cleaned} inactive sessions`)
  }
}, 5 * 60 * 1000)
