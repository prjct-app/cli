/**
 * Ideas Schema
 *
 * Defines the structure for ideas.json - idea backlog.
 * Matches json-loader.ts types exactly.
 */

export type IdeaPriority = 'low' | 'medium' | 'high'
export type IdeaStatus = 'pending' | 'converted' | 'completed' | 'archived'

export interface ImpactEffort {
  impact: 'high' | 'medium' | 'low'
  effort: 'high' | 'medium' | 'low'
}

// Tech stack definition for idea specs
export interface TechStack {
  frontend?: string             // "Next.js 14, HeroUI"
  backend?: string              // "Supabase (Auth, DB, RLS, Realtime)"
  payments?: string             // "Stripe Billing"
  ai?: string                   // "Vercel AI SDK"
  deploy?: string               // "Vercel"
  other?: string[]              // Additional stack items
}

// Module definition for complex ideas
export interface IdeaModule {
  name: string                  // "Multi-tenant"
  description: string           // "Empresas con RLS estricto"
}

// Role definition
export interface IdeaRole {
  name: string                  // "SUPER_ADMIN"
  description?: string          // "(global, impersonation)"
}

export interface IdeaSchema {
  id: string                    // idea_xxxxxxxx
  text: string                  // Title/summary
  details?: string              // Expanded description
  priority: IdeaPriority
  status: IdeaStatus
  tags: string[]
  addedAt: string               // ISO8601
  completedAt?: string          // ISO8601 if status=completed
  convertedTo?: string          // featureId if status=converted
  // Source documentation
  source?: string               // "docs/technical-spec-v1.md, docs/edr-v1.md"
  sourceFiles?: string[]        // Array of source files
  // Enriched fields from MD
  painPoints?: string[]         // from ### Pain Points section
  solutions?: string[]          // from ### Solutions section
  filesAffected?: string[]      // from **Files:** section
  impactEffort?: ImpactEffort
  implementationNotes?: string
  // Technical spec fields for ZERO DATA LOSS
  stack?: TechStack             // Tech stack definition
  modules?: IdeaModule[]        // V1 modules list
  roles?: IdeaRole[]            // User roles
  risks?: string[]              // Critical risks/pitfalls
  risksCount?: number           // "33 pitfalls documented"
}

export interface IdeasJson {
  ideas: IdeaSchema[]
  lastUpdated: string
}

// Legacy type for backwards compatibility
export type IdeasSchema = IdeaSchema[]

export const DEFAULT_IDEA: Omit<IdeaSchema, 'id' | 'text'> = {
  priority: 'medium',
  status: 'pending',
  tags: [],
  addedAt: new Date().toISOString()
}

export const DEFAULT_IDEAS: IdeasJson = {
  ideas: [],
  lastUpdated: ''
}
