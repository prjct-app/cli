/**
 * Stats Domain Types
 *
 * Shared types for stats components.
 */

import type { TimelineEvent as TimelineEventType } from '@/lib/parse-prjct-files'

export type TimelineEvent = TimelineEventType
export type AccentColor = 'default' | 'success' | 'warning' | 'destructive'
export type BentoSize = '1x1' | '1x2' | '2x1' | '2x2' | 'full'
export type ProgressRingSize = 'sm' | 'md' | 'lg' | 'xl'
export type EventIconName = 'check' | 'target' | 'rocket' | 'refresh' | 'activity'

export interface CurrentTask {
  task: string
  startedAt?: string
  agent?: string
  agentConfidence?: number
  estimatedDuration?: string
  pausedAt?: string
  pauseReason?: string
  duration?: string
}

export interface QueueItem {
  task: string
  priority?: 'low' | 'medium' | 'high' | 'critical' | number
  suggestedAgent?: string
  estimatedDuration?: string
}

export interface Ship {
  name: string
  date: string
  version?: string
  duration?: string
}

export interface Idea {
  title: string
  impact?: string
}

export interface Agent {
  name: string
  description?: string
  successRate?: number
  tasksCompleted?: number
  improving?: boolean
  bestFor?: string[]
}

export interface RoadmapPhase {
  name: string
  progress: number
  features?: Array<{ name: string; status: string }>
}

export interface RoadmapData {
  phases: RoadmapPhase[]
  progress: number
}
