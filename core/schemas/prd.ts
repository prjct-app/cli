/**
 * PRD Schema
 *
 * Defines the structure for prds.json - Product Requirement Documents.
 * Uses Zod for runtime validation and TypeScript type inference.
 *
 * PRDs are created by the Chief Architect agent following an 8-phase methodology.
 * They serve as the foundation for roadmap planning and Linear/Jira/Monday integration.
 *
 * @version 1.0.0
 */

import { z } from 'zod'

// =============================================================================
// Zod Schemas - Source of Truth
// =============================================================================

export const PRDStatusSchema = z.enum([
  'draft',
  'approved',
  'in_progress',
  'completed',
  'cancelled',
])
export const PRDSizeSchema = z.enum(['XS', 'S', 'M', 'L', 'XL'])
export const ImpactLevelSchema = z.enum(['critical', 'high', 'medium', 'low'])
export const ConfidenceLevelSchema = z.enum(['low', 'medium', 'high'])
export const FrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'rarely'])
export const RiskTypeSchema = z.enum(['technical', 'business', 'timeline'])
export const APIStyleSchema = z.enum(['REST', 'GraphQL', 'tRPC', 'gRPC', 'none'])
export const SchemaChangeTypeSchema = z.enum(['create', 'alter', 'drop'])

// -----------------------------------------------------------------------------
// Phase 1: Problem Definition
// -----------------------------------------------------------------------------

export const ProblemSchema = z.object({
  statement: z.string(),
  targetUser: z.string(),
  currentState: z.string().optional(),
  painPoints: z.array(z.string()),
  frequency: FrequencySchema.optional(),
  impact: ImpactLevelSchema,
})

// -----------------------------------------------------------------------------
// Phase 2: User Flows
// -----------------------------------------------------------------------------

export const UserFlowsSchema = z.object({
  entryPoint: z.string(),
  happyPath: z.array(z.string()),
  successState: z.string(),
  errorStates: z.array(z.string()),
  edgeCases: z.array(z.string()),
  jobsToBeDone: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Phase 3: Domain Modeling
// -----------------------------------------------------------------------------

export const EntityAttributeSchema = z.object({
  name: z.string(),
  type: z.string(),
  constraints: z.string().optional(),
})

export const DomainEntitySchema = z.object({
  name: z.string(),
  description: z.string(),
  attributes: z.array(EntityAttributeSchema),
  relationships: z.array(z.string()),
  rules: z.array(z.string()),
  states: z.array(z.string()),
})

export const DomainModelSchema = z.object({
  newEntities: z.array(DomainEntitySchema),
  modifiedEntities: z.array(z.string()),
  boundedContext: z.string().optional(),
})

// -----------------------------------------------------------------------------
// Phase 4: API Contracts
// -----------------------------------------------------------------------------

export const APIEndpointSchema = z.object({
  operation: z.string(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional(),
  path: z.string().optional(),
  auth: z.enum(['required', 'optional', 'none']),
  input: z.record(z.string()).optional(),
  output: z.record(z.string()).optional(),
  errors: z
    .array(
      z.object({
        code: z.number(),
        description: z.string(),
      })
    )
    .optional(),
})

export const APIContractsSchema = z.object({
  style: APIStyleSchema,
  endpoints: z.array(APIEndpointSchema),
})

// -----------------------------------------------------------------------------
// Phase 5: System Architecture
// -----------------------------------------------------------------------------

export const ArchitectureComponentSchema = z.object({
  name: z.string(),
  responsibility: z.string(),
  dependencies: z.array(z.string()),
})

export const ArchitectureSchema = z.object({
  pattern: z.string(),
  affectedComponents: z.array(z.string()),
  newComponents: z.array(ArchitectureComponentSchema),
  externalDependencies: z.array(z.string()),
})

// -----------------------------------------------------------------------------
// Phase 6: Data Architecture
// -----------------------------------------------------------------------------

export const SchemaColumnSchema = z.object({
  name: z.string(),
  type: z.string(),
})

export const SchemaChangeSchema = z.object({
  type: SchemaChangeTypeSchema,
  table: z.string(),
  columns: z.array(SchemaColumnSchema).optional(),
  indexes: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
})

export const MigrationSchema = z.object({
  description: z.string(),
  reversible: z.boolean(),
})

export const DataArchitectureSchema = z.object({
  database: z.string(),
  schemaChanges: z.array(SchemaChangeSchema),
  migrations: z.array(MigrationSchema),
})

// -----------------------------------------------------------------------------
// Phase 7: Tech Stack
// -----------------------------------------------------------------------------

export const TechStackDependenciesSchema = z.object({
  frontend: z.array(z.string()).optional(),
  backend: z.array(z.string()).optional(),
  devDeps: z.array(z.string()).optional(),
  infrastructure: z.array(z.string()).optional(),
})

export const TechStackDecisionSchema = z.object({
  newDependencies: TechStackDependenciesSchema,
  justification: z.string().optional(),
  security: z.array(z.string()),
  performance: z.array(z.string()),
})

// -----------------------------------------------------------------------------
// Phase 8: Implementation Roadmap
// -----------------------------------------------------------------------------

export const RiskSchema = z.object({
  type: RiskTypeSchema,
  description: z.string(),
  mitigation: z.string(),
  probability: ImpactLevelSchema,
  impact: ImpactLevelSchema,
})

export const ImplementationPhaseSchema = z.object({
  name: z.string(),
  deliverable: z.string(),
  tasks: z.array(z.string()),
})

export const MVPScopeSchema = z.object({
  p0: z.array(z.string()), // Must-have
  p1: z.array(z.string()), // Should-have
  p2: z.array(z.string()), // Nice-to-have
  p3: z.array(z.string()), // Future
})

export const ImplementationRoadmapSchema = z.object({
  mvp: MVPScopeSchema,
  phases: z.array(ImplementationPhaseSchema),
  risks: z.array(RiskSchema),
  dependencies: z.array(z.string()),
  assumptions: z.array(z.string()),
})

// -----------------------------------------------------------------------------
// Estimation
// -----------------------------------------------------------------------------

export const EstimationBreakdownSchema = z.object({
  area: z.string(),
  hours: z.number(),
})

export const EstimationSchema = z.object({
  tShirtSize: PRDSizeSchema,
  estimatedHours: z.number(),
  confidence: ConfidenceLevelSchema,
  breakdown: z.array(EstimationBreakdownSchema),
  assumptions: z.array(z.string()).optional(),
})

// -----------------------------------------------------------------------------
// Success Criteria
// -----------------------------------------------------------------------------

export const SuccessMetricSchema = z.object({
  name: z.string(),
  baseline: z.number().nullable(),
  target: z.number(),
  unit: z.string(),
  measurementMethod: z.string().optional(),
})

export const SuccessCriteriaSchema = z.object({
  metrics: z.array(SuccessMetricSchema),
  acceptanceCriteria: z.array(z.string()),
  qualitative: z.array(z.string()).optional(),
})

// -----------------------------------------------------------------------------
// Value Assessment (for Linear/Jira/Monday mapping)
// -----------------------------------------------------------------------------

export const ValueAssessmentSchema = z.object({
  businessImpact: ImpactLevelSchema,
  userImpact: ImpactLevelSchema,
  strategicAlignment: z.number().min(1).max(5),
  competitiveAdvantage: z.boolean().optional(),
})

// -----------------------------------------------------------------------------
// Outcomes (filled post-completion)
// -----------------------------------------------------------------------------

export const MetricOutcomeSchema = z.object({
  name: z.string(),
  actual: z.number(),
  targetMet: z.boolean(),
})

export const PRDOutcomesSchema = z.object({
  actualHours: z.number(),
  metricsAchieved: z.array(MetricOutcomeSchema),
  learnings: z.array(z.string()),
  surprises: z.array(z.string()),
  wouldDoAgain: z.boolean(),
  rating: z.number().min(1).max(5),
  completedAt: z.string(),
})

// -----------------------------------------------------------------------------
// Complete PRD Schema
// -----------------------------------------------------------------------------

export const PRDItemSchema = z.object({
  id: z.string(), // prd_xxxxxxxx
  title: z.string(),
  status: PRDStatusSchema,
  size: PRDSizeSchema,

  // Phase outputs (optional based on size)
  problem: ProblemSchema,
  userFlows: UserFlowsSchema.optional(),
  domainModel: DomainModelSchema.optional(),
  apiContracts: APIContractsSchema.optional(),
  architecture: ArchitectureSchema.optional(),
  dataArchitecture: DataArchitectureSchema.optional(),
  techStack: TechStackDecisionSchema.optional(),
  roadmap: ImplementationRoadmapSchema,

  // Estimation & Success
  estimation: EstimationSchema,
  successCriteria: SuccessCriteriaSchema,
  value: ValueAssessmentSchema.optional(),

  // Links (for integration)
  featureId: z.string().nullable(), // Link to roadmap feature
  phase: z.string().nullable(), // P0, P1, etc.
  quarter: z.string().nullable(), // Q1-2026, etc.

  // Metadata
  createdAt: z.string(),
  createdBy: z.string(),
  approvedAt: z.string().nullable(),
  approvedBy: z.string().nullable(),
  completedAt: z.string().optional(),

  // Outcomes (filled post-completion)
  outcomes: PRDOutcomesSchema.optional(),
})

export const PRDsJsonSchema = z.object({
  prds: z.array(PRDItemSchema),
  lastUpdated: z.string(),
})

// =============================================================================
// Inferred Types
// =============================================================================

export type PRDStatus = z.infer<typeof PRDStatusSchema>
export type PRDSize = z.infer<typeof PRDSizeSchema>
export type ImpactLevel = z.infer<typeof ImpactLevelSchema>
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>
export type Frequency = z.infer<typeof FrequencySchema>
export type RiskType = z.infer<typeof RiskTypeSchema>
export type APIStyle = z.infer<typeof APIStyleSchema>

export type Problem = z.infer<typeof ProblemSchema>
export type UserFlows = z.infer<typeof UserFlowsSchema>
export type DomainEntity = z.infer<typeof DomainEntitySchema>
export type DomainModel = z.infer<typeof DomainModelSchema>
export type APIEndpoint = z.infer<typeof APIEndpointSchema>
export type APIContracts = z.infer<typeof APIContractsSchema>
export type ArchitectureComponent = z.infer<typeof ArchitectureComponentSchema>
export type Architecture = z.infer<typeof ArchitectureSchema>
export type SchemaChange = z.infer<typeof SchemaChangeSchema>
export type Migration = z.infer<typeof MigrationSchema>
export type DataArchitecture = z.infer<typeof DataArchitectureSchema>
export type TechStackDecision = z.infer<typeof TechStackDecisionSchema>
export type Risk = z.infer<typeof RiskSchema>
export type ImplementationPhase = z.infer<typeof ImplementationPhaseSchema>
export type MVPScope = z.infer<typeof MVPScopeSchema>
export type ImplementationRoadmap = z.infer<typeof ImplementationRoadmapSchema>
export type Estimation = z.infer<typeof EstimationSchema>
export type SuccessMetric = z.infer<typeof SuccessMetricSchema>
export type SuccessCriteria = z.infer<typeof SuccessCriteriaSchema>
export type ValueAssessment = z.infer<typeof ValueAssessmentSchema>
export type PRDOutcomes = z.infer<typeof PRDOutcomesSchema>
export type PRDItem = z.infer<typeof PRDItemSchema>
export type PRDsJson = z.infer<typeof PRDsJsonSchema>

// =============================================================================
// Validation Helpers
// =============================================================================

/** Parse and validate prds.json content */
export const parsePRDs = (data: unknown): PRDsJson => PRDsJsonSchema.parse(data)
export const safeParsePRDs = (data: unknown) => PRDsJsonSchema.safeParse(data)

/** Parse a single PRD */
export const parsePRD = (data: unknown): PRDItem => PRDItemSchema.parse(data)
export const safeParsePRD = (data: unknown) => PRDItemSchema.safeParse(data)

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_PRD: Omit<
  PRDItem,
  'id' | 'title' | 'problem' | 'roadmap' | 'estimation' | 'successCriteria'
> = {
  status: 'draft',
  size: 'M',
  featureId: null,
  phase: null,
  quarter: null,
  createdAt: new Date().toISOString(),
  createdBy: 'chief-architect',
  approvedAt: null,
  approvedBy: null,
}

export const DEFAULT_PRDS: PRDsJson = {
  prds: [],
  lastUpdated: '',
}

// =============================================================================
// Mapping Helpers (for Linear/Jira/Monday integration)
// =============================================================================

/**
 * Maps PRD size to story points (for Jira/Linear)
 */
export const sizeToStoryPoints: Record<PRDSize, number> = {
  XS: 1,
  S: 2,
  M: 5,
  L: 8,
  XL: 13,
}

/**
 * Maps impact level to priority (for Linear/Jira)
 */
export const impactToPriority: Record<ImpactLevel, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
}

/**
 * Calculate value score for prioritization
 */
export const calculateValueScore = (prd: PRDItem): number => {
  const impactScore = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  }

  const businessImpact = prd.value?.businessImpact
    ? impactScore[prd.value.businessImpact]
    : impactScore[prd.problem.impact]

  const userImpact = prd.value?.userImpact
    ? impactScore[prd.value.userImpact]
    : impactScore[prd.problem.impact]

  const strategicAlignment = prd.value?.strategicAlignment ?? 3

  // Value = (Business Impact + User Impact) × Strategic Alignment
  return (businessImpact + userImpact) * strategicAlignment
}

/**
 * Calculate priority score (value / effort)
 */
export const calculatePriorityScore = (prd: PRDItem): number => {
  const valueScore = calculateValueScore(prd)
  const effortScore = prd.estimation.estimatedHours / 10 // Normalize hours

  // Priority = Value / Effort (higher is better)
  return effortScore > 0 ? valueScore / effortScore : valueScore
}
