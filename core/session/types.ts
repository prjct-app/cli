/**
 * Session Types
 */

export interface SessionMetrics {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  commits: number
  snapshots: string[]
}

export interface TimelineEvent {
  type: 'start' | 'pause' | 'resume' | 'complete'
  at: string
}

export interface Session {
  id: string
  projectId: string
  task: string
  status: 'active' | 'paused' | 'completed'
  startedAt: string
  pausedAt: string | null
  completedAt: string | null
  duration: number
  metrics: SessionMetrics
  timeline: TimelineEvent[]
}
