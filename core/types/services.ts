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
  // Ecosystem compatibility fields
  sourceUrl?: string
  sourceType?: 'github' | 'local' | 'builtin' | 'registry'
  installedAt?: string
  sha?: string
}

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  source: 'project' | 'global' | 'builtin' | 'remote'
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
// AI Tools Registry Types
// =============================================================================

export interface AIToolConfig {
  id: string
  name: string
  outputFile: string
  outputPath: 'repo' | 'global'
  maxTokens: number
  format: 'detailed' | 'concise' | 'minimal' | 'json'
  description: string
}

// =============================================================================
// p. Command Resolver Types
// =============================================================================

export type PCommandTemplateSource = 'package-resolve' | 'npm-root-g' | 'local-dev' | 'bundle'
export type PCommandResolveErrorCode = 'UNKNOWN_COMMAND' | 'TEMPLATE_NOT_FOUND' | 'ROUTER_NOT_READY'

export interface ResolvedPTemplate {
  command: string
  templatePath: string
  source: PCommandTemplateSource
}

export interface PCommandResolveError {
  code: PCommandResolveErrorCode
  message: string
  fix?: string[]
}

export interface PCommandCatalog {
  commands: string[]
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
