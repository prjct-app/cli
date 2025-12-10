/**
 * History - Tier 3
 * Append-only JSONL audit log.
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../../infrastructure/path-manager'
import type { HistoryEntry } from './types'

export class HistoryStore {
  private _getSessionPath(projectId: string): string {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = now.toISOString().split('T')[0]

    return path.join(pathManager.getGlobalProjectPath(projectId), 'memory', 'sessions', yearMonth, `${day}.jsonl`)
  }

  async appendHistory(projectId: string, entry: Record<string, unknown>): Promise<void> {
    const sessionPath = this._getSessionPath(projectId)
    await fs.mkdir(path.dirname(sessionPath), { recursive: true })

    const logEntry: HistoryEntry = {
      ts: new Date().toISOString(),
      type: entry.type as string,
      ...entry,
    }

    await fs.appendFile(sessionPath, JSON.stringify(logEntry) + '\n', 'utf-8')
  }

  async getRecentHistory(projectId: string, limit: number = 20): Promise<HistoryEntry[]> {
    try {
      const sessionPath = this._getSessionPath(projectId)
      const content = await fs.readFile(sessionPath, 'utf-8')
      const lines = content.trim().split('\n').filter(Boolean)

      return lines
        .slice(-limit)
        .map((line) => {
          try {
            return JSON.parse(line)
          } catch {
            return null
          }
        })
        .filter((entry): entry is HistoryEntry => entry !== null)
    } catch {
      return []
    }
  }
}
