/**
 * Service Types
 * Types for service layer modules.
 */

// =============================================================================
// Breakdown Service Types
// =============================================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low'

export interface ComplexityEstimate {
  level: 'low' | 'medium' | 'high'
  hours: number
  confidence?: number
  factors?: string[]
}

// =============================================================================
// Skill Service Types
// =============================================================================

export interface SkillMetadata {
  name: string
  description?: string
  agent?: string
  tags?: string[]
  version?: string
  category?: string
  author?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  source: 'project' | 'global' | 'builtin'
  filePath: string
  metadata: SkillMetadata
  path?: string
  isBuiltin?: boolean
}

export interface SkillSearchResult {
  skill: Skill
  relevance: number
  score?: number
  matchedTerms?: string[]
}

// =============================================================================
// Memory Service Types
// =============================================================================

export interface MemoryServiceEntry {
  id?: string
  type?: string
  content?: string
  timestamp: string
  action: string
  data: Record<string, unknown>
  author?: string
  metadata?: Record<string, unknown>
}
