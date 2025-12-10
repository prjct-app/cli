/**
 * Ideas Schema
 *
 * Defines the structure for ideas.json - idea backlog.
 */

export type IdeaPriority = 'low' | 'medium' | 'high'
export type IdeaStatus = 'pending' | 'archived' | 'converted'

export interface IdeaSchema {
  id: string
  content: string
  description?: string
  priority: IdeaPriority
  status: IdeaStatus
  tags: string[]
  createdAt: string // ISO8601
  archivedAt?: string // ISO8601
}

export type IdeasSchema = IdeaSchema[]

export const DEFAULT_IDEA: Omit<IdeaSchema, 'id' | 'content'> = {
  priority: 'medium',
  status: 'pending',
  tags: [],
  createdAt: new Date().toISOString()
}
