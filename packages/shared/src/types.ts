/**
 * Core Types for prjct
 */

// Session Types
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

export interface SessionMetrics {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
  commits: number
  snapshots: string[]
}

export interface TimelineEvent {
  type: 'start' | 'pause' | 'resume' | 'complete' | 'snapshot'
  at: string
  data?: Record<string, unknown>
}

// Snapshot Types
export interface Snapshot {
  hash: string
  shortHash: string
  message: string
  timestamp: string
  files: string[]
}

// Task Types
export interface Task {
  id: string
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'critical'
  createdAt: string
  completedAt?: string
  duration?: number
  tags?: string[]
}

// Idea Types
export interface Idea {
  id: string
  content: string
  capturedAt: string
  source?: string
  promoted?: boolean
  promotedTo?: string
}

// Feature Types
export interface Feature {
  id: string
  title: string
  description?: string
  status: 'planned' | 'in_progress' | 'shipped' | 'cancelled'
  priority: number
  createdAt: string
  shippedAt?: string
  tasks?: Task[]
  version?: string
}

// Project Types
export interface Project {
  id: string
  name: string
  path: string
  createdAt: string
  lastActiveAt: string
  config: ProjectConfig
}

export interface ProjectConfig {
  projectId: string
  name?: string
  plugins?: string[]
  [key: string]: unknown
}

// Metrics Types
export interface DailyMetrics {
  date: string
  sessions: number
  duration: number
  commits: number
  filesChanged: number
  linesAdded: number
  linesRemoved: number
}

export interface WeeklyMetrics {
  weekStart: string
  weekEnd: string
  totalSessions: number
  totalDuration: number
  averageDuration: number
  tasksCompleted: number
  featuresShipped: number
  productivityScore: number
  streak: number
  byDay: Record<string, DailyMetrics>
}

// WebSocket Message Types
export interface WSMessage {
  type: string
  payload?: unknown
  timestamp: string
}

export interface WSInputMessage extends WSMessage {
  type: 'input'
  payload: {
    data: string
  }
}

export interface WSOutputMessage extends WSMessage {
  type: 'output'
  payload: {
    data: string
  }
}

export interface WSResizeMessage extends WSMessage {
  type: 'resize'
  payload: {
    cols: number
    rows: number
  }
}

export interface WSStatusMessage extends WSMessage {
  type: 'status'
  payload: {
    status: 'connected' | 'disconnected' | 'error'
    message?: string
  }
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  timestamp: string
}

// Event Types (for event bus)
export type EventType =
  | 'session.started'
  | 'session.paused'
  | 'session.resumed'
  | 'session.completed'
  | 'task.created'
  | 'task.completed'
  | 'feature.added'
  | 'feature.shipped'
  | 'idea.captured'
  | 'snapshot.created'
  | 'snapshot.restored'
  | 'git.commit'
  | 'git.push'
  | 'project.init'
  | 'project.sync'

export interface EventPayload {
  type: EventType
  timestamp: string
  projectId: string
  data: Record<string, unknown>
}
