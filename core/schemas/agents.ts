/**
 * Agents Schema
 *
 * Defines the structure for agents.json - specialized AI agents.
 */

export interface AgentSchema {
  name: string
  description: string
  skills: string[]
  patterns: string[]
  filesOwned: string[]
  successRate?: number
  tasksCompleted?: number
  bestFor: string[]
  avoidFor: string[]
}

export type AgentsSchema = AgentSchema[]

export const DEFAULT_AGENT: Omit<AgentSchema, 'name' | 'description'> = {
  skills: [],
  patterns: [],
  filesOwned: [],
  bestFor: [],
  avoidFor: []
}
