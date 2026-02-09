/**
 * Ideas Schema
 *
 * Defines the structure for ideas.json - idea backlog.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * @version 2.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const IdeaPrioritySchema = z.enum(['low', 'medium', 'high'])
export const IdeaStatusSchema = z.enum(['pending', 'converted', 'completed', 'archived', 'dormant'])
export const ImpactLevelSchema = z.enum(['high', 'medium', 'low'])

export const ImpactEffortSchema = z.object({
  impact: ImpactLevelSchema,
  effort: ImpactLevelSchema,
})

export const TechStackSchema = z.object({
  frontend: z.string().optional(), // "Next.js 14, HeroUI"
  backend: z.string().optional(), // "Supabase (Auth, DB, RLS, Realtime)"
  payments: z.string().optional(), // "Stripe Billing"
  ai: z.string().optional(), // "Vercel AI SDK"
  deploy: z.string().optional(), // "Vercel"
  other: z.array(z.string()).optional(),
})

export const IdeaModuleSchema = z.object({
  name: z.string(), // "Multi-tenant"
  description: z.string(), // "Strict RLS for organizations"
})

export const IdeaRoleSchema = z.object({
  name: z.string(), // "SUPER_ADMIN"
  description: z.string().optional(),
})

export const IdeaItemSchema = z.object({
  id: z.string(), // idea_xxxxxxxx
  text: z.string(), // Title/summary
  details: z.string().optional(),
  priority: IdeaPrioritySchema,
  status: IdeaStatusSchema,
  tags: z.array(z.string()),
  addedAt: z.string(), // ISO8601
  completedAt: z.string().optional(),
  convertedTo: z.string().optional(),
  // Source documentation
  source: z.string().optional(),
  sourceFiles: z.array(z.string()).optional(),
  // Enriched fields from MD
  painPoints: z.array(z.string()).optional(),
  solutions: z.array(z.string()).optional(),
  filesAffected: z.array(z.string()).optional(),
  impactEffort: ImpactEffortSchema.optional(),
  implementationNotes: z.string().optional(),
  // Technical spec fields for ZERO DATA LOSS
  stack: TechStackSchema.optional(),
  modules: z.array(IdeaModuleSchema).optional(),
  roles: z.array(IdeaRoleSchema).optional(),
  risks: z.array(z.string()).optional(),
  risksCount: z.number().optional(),
})

export const IdeasJsonSchema = z.object({
  ideas: z.array(IdeaItemSchema),
  lastUpdated: z.string(),
})

// =============================================================================
// Inferred Types - Backward Compatible
// =============================================================================

export type IdeaPriority = z.infer<typeof IdeaPrioritySchema>
export type IdeaStatus = z.infer<typeof IdeaStatusSchema>
export type ImpactEffort = z.infer<typeof ImpactEffortSchema>
export type TechStack = z.infer<typeof TechStackSchema>
export type IdeaModule = z.infer<typeof IdeaModuleSchema>
export type IdeaRole = z.infer<typeof IdeaRoleSchema>
export type IdeaSchema = z.infer<typeof IdeaItemSchema>
export type IdeasJson = z.infer<typeof IdeasJsonSchema>

// Legacy type for backwards compatibility
export type IdeasSchema = IdeaSchema[]

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate ideas.json content */
export const parseIdeas = (data: unknown): IdeasJson => IdeasJsonSchema.parse(data)
export const safeParseIdeas = (data: unknown) => IdeasJsonSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_IDEA: Omit<IdeaSchema, 'id' | 'text'> = {
  priority: 'medium',
  status: 'pending',
  tags: [],
  addedAt: new Date().toISOString(),
}

export const DEFAULT_IDEAS: IdeasJson = {
  ideas: [],
  lastUpdated: '',
}
