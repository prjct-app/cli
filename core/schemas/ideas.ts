/**
 * Ideas Schema
 *
 * Defines the structure for ideas data — idea backlog.
 * Public surface: `IdeaPrioritySchema`, `IdeaItemSchema`, `IdeasJsonSchema`,
 * `IdeaPriority`, `IdeaSchema`, `IdeasJson`. Internals are private.
 */

import { z } from 'zod'

export const IdeaPrioritySchema = z.enum(['low', 'medium', 'high'])
const IdeaStatusSchema = z.enum(['pending', 'converted', 'completed', 'archived', 'dormant'])
const ImpactLevelSchema = z.enum(['high', 'medium', 'low'])

const ImpactEffortSchema = z.object({
  impact: ImpactLevelSchema,
  effort: ImpactLevelSchema,
})

const TechStackSchema = z.object({
  frontend: z.string().optional(), // "Next.js 14, HeroUI"
  backend: z.string().optional(), // "Supabase (Auth, DB, RLS, Realtime)"
  payments: z.string().optional(), // "Stripe Billing"
  ai: z.string().optional(), // "Vercel AI SDK"
  deploy: z.string().optional(), // "Vercel"
  other: z.array(z.string()).optional(),
})

const IdeaModuleSchema = z.object({
  name: z.string(), // "Multi-tenant"
  description: z.string(), // "Strict RLS for organizations"
})

const IdeaRoleSchema = z.object({
  name: z.string(), // "SUPER_ADMIN"
  description: z.string().optional(),
})

const IdeaItemSchema = z.object({
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

export type IdeaPriority = z.infer<typeof IdeaPrioritySchema>
