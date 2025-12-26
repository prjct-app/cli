/**
 * History - Tier 3
 * Append-only JSONL audit log with temporal fragmentation.
 */

import path from 'path'
import pathManager from '../../infrastructure/path-manager'
import { getTimestamp, getTodayKey } from '../../utils/date-helper'
import { appendJsonLine, getLastJsonLines } from '../../utils/jsonl-helper'
import { ensureDir } from '../../utils/file-helper'
import type { HistoryEntry, HistoryEventType } from './types'

export class HistoryStore {
  private _getSessionPath(projectId: string): string {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const day = getTodayKey()

    return path.join(pathManager.getGlobalProjectPath(projectId), 'memory', 'sessions', yearMonth, `${day}.jsonl`)
  }

  async appendHistory(projectId: string, entry: Record<string, unknown> & { type: HistoryEventType }): Promise<void> {
    const sessionPath = this._getSessionPath(projectId)
    await ensureDir(path.dirname(sessionPath))

    const logEntry: HistoryEntry = {
      ts: getTimestamp(),
      ...entry,
      type: entry.type,
    }

    await appendJsonLine(sessionPath, logEntry)
  }

  async getRecentHistory(projectId: string, limit: number = 20): Promise<HistoryEntry[]> {
    const sessionPath = this._getSessionPath(projectId)
    return getLastJsonLines<HistoryEntry>(sessionPath, limit)
  }
}
