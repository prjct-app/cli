/**
 * Zod Schemas for validation
 */

import { z } from 'zod'

// Session Schemas
export const SessionMetricsSchema = z.object({
  filesChanged: z.number().default(0),
  linesAdded: z.number().default(0),
  linesRemoved: z.number().default(0),
  commits: z.number().default(0),
  snapshots: z.array(z.string()).default([])
})

export const TimelineEventSchema = z.object({
  type: z.enum(['start', 'pause', 'resume', 'complete', 'snapshot']),
  at: z.string().datetime(),
  data: z.record(z.unknown()).optional()
})

export const SessionSchema = z.object({
  id: z.string().regex(/^sess_[a-z0-9]{8}$/),
  projectId: z.string(),
  task: z.string().min(1),
  status: z.enum(['active', 'paused', 'completed']),
  startedAt: z.string().datetime(),
  pausedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  duration: z.number().min(0),
  metrics: SessionMetricsSchema,
  timeline: z.array(TimelineEventSchema)
})

// Task Schemas
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'blocked']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  duration: z.number().optional(),
  tags: z.array(z.string()).optional()
})

// Idea Schemas
export const IdeaSchema = z.object({
  id: z.string(),
  content: z.string().min(1),
  capturedAt: z.string().datetime(),
  source: z.string().optional(),
  promoted: z.boolean().optional(),
  promotedTo: z.string().optional()
})

// Feature Schemas
export const FeatureSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['planned', 'in_progress', 'shipped', 'cancelled']),
  priority: z.number().min(1),
  createdAt: z.string().datetime(),
  shippedAt: z.string().datetime().optional(),
  tasks: z.array(TaskSchema).optional(),
  version: z.string().optional()
})

// Project Config Schema
export const ProjectConfigSchema = z.object({
  projectId: z.string(),
  name: z.string().optional(),
  plugins: z.array(z.string()).optional()
}).passthrough()

// WebSocket Message Schemas
export const WSInputMessageSchema = z.object({
  type: z.literal('input'),
  payload: z.object({
    data: z.string()
  }),
  timestamp: z.string().datetime()
})

export const WSResizeMessageSchema = z.object({
  type: z.literal('resize'),
  payload: z.object({
    cols: z.number().min(1),
    rows: z.number().min(1)
  }),
  timestamp: z.string().datetime()
})

export const WSMessageSchema = z.discriminatedUnion('type', [
  WSInputMessageSchema,
  WSResizeMessageSchema
])

// API Request Schemas
export const CreateSessionRequestSchema = z.object({
  task: z.string().min(1).max(200),
  projectId: z.string()
})

export const CreateTaskRequestSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
})

export const CaptureIdeaRequestSchema = z.object({
  content: z.string().min(1).max(500),
  source: z.string().optional()
})

// Inferred Types
export type SessionInput = z.infer<typeof SessionSchema>
export type TaskInput = z.infer<typeof TaskSchema>
export type IdeaInput = z.infer<typeof IdeaSchema>
export type FeatureInput = z.infer<typeof FeatureSchema>
export type ProjectConfigInput = z.infer<typeof ProjectConfigSchema>
export type WSMessageInput = z.infer<typeof WSMessageSchema>
