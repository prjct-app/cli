/**
 * Session Manager Types
 */

export interface SessionEntry {
  timestamp?: string
  data?: {
    timestamp?: string
  }
  _sessionDate?: Date
  [key: string]: unknown
}

export interface SessionMetadata {
  created?: string
  lastActivity?: string
  entryCount?: number
  shipCount?: number
  version?: string
  migrated?: boolean
  migratedAt?: string
}

export interface SessionStats {
  totalSessions: number
  activeDays: number
  totalEntries: number
  totalShips: number
  averageEntriesPerDay: number
}

export interface MigrationResult {
  success: boolean
  message: string
  entriesMigrated: number
  sessionsCreated?: number
}

export interface SessionInfo {
  path: string
  date: Date
  year: string
  month: string
  day: string
}
