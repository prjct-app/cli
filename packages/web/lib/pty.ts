/**
 * PTY Manager - Handle Claude Code CLI sessions via pseudo-terminal
 */

import * as pty from 'node-pty'
import type { IPty } from 'node-pty'

interface Session {
  pty: IPty
  projectDir: string
  createdAt: Date
}

const sessions = new Map<string, Session>()

export function createClaudeSession(sessionId: string, projectDir: string): IPty {
  // Kill existing session if any
  const existing = sessions.get(sessionId)
  if (existing) {
    try {
      existing.pty.kill()
    } catch {
      // Ignore
    }
    sessions.delete(sessionId)
  }

  // Spawn claude CLI
  const shell = process.platform === 'win32' ? 'cmd.exe' : 'bash'
  const args = process.platform === 'win32' ? [] : ['-l']

  const ptyProcess = pty.spawn(shell, args, {
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

  // Store session
  sessions.set(sessionId, {
    pty: ptyProcess,
    projectDir,
    createdAt: new Date()
  })

  // Auto-start Claude Code CLI
  setTimeout(() => {
    ptyProcess.write('claude\r')
  }, 500)

  return ptyProcess
}

export function getSession(sessionId: string): IPty | null {
  const session = sessions.get(sessionId)
  return session?.pty || null
}

export function killSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (session) {
    try {
      session.pty.kill()
    } catch {
      // Ignore
    }
    sessions.delete(sessionId)
    return true
  }
  return false
}

export function resizeSession(sessionId: string, cols: number, rows: number): boolean {
  const session = sessions.get(sessionId)
  if (session) {
    try {
      session.pty.resize(cols, rows)
      return true
    } catch {
      return false
    }
  }
  return false
}

export function listSessions(): { sessionId: string; projectDir: string; createdAt: Date }[] {
  const result: { sessionId: string; projectDir: string; createdAt: Date }[] = []
  sessions.forEach((session, sessionId) => {
    result.push({
      sessionId,
      projectDir: session.projectDir,
      createdAt: session.createdAt
    })
  })
  return result
}
