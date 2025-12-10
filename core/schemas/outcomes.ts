/**
 * Outcomes Schema
 *
 * Defines the structure for outcomes.json - task completion metrics.
 */

export type QualityScore = 1 | 2 | 3 | 4 | 5

export interface OutcomeSchema {
  id: string
  taskId: string
  description: string
  estimatedDuration?: string
  actualDuration: string
  completedAsPlanned: boolean
  qualityScore: QualityScore
  blockers: string[]
  agentUsed?: string
  completedAt: string // ISO8601
}

export type OutcomesSchema = OutcomeSchema[]
