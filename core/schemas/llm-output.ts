/**
 * LLM Output Schemas
 *
 * Zod schemas for all LLM prompt response types.
 * These schemas are:
 * 1. Injected into prompts as explicit format instructions
 * 2. Used to validate LLM responses before storage or use
 * 3. Define the contract between prompts and response handling
 *
 * @see PRJ-264
 */

import { z } from 'zod'
import { ClassificationDomainSchema, TaskClassificationSchema } from './classification'

// =============================================================================
// Agent Assignment Schema
// =============================================================================

/** LLM response when selecting which agent should handle a task */
export const AgentAssignmentSchema = z.object({
  /** Agent file name (e.g., "backend.md", "frontend.md") */
  agentName: z.string(),
  /** Why this agent was selected */
  reasoning: z.string(),
  /** Confidence in the assignment (0-1) */
  confidence: z.number().min(0).max(1),
})

// =============================================================================
// Subtask Breakdown Schema
// =============================================================================

/** LLM response when breaking a task into subtasks */
export const SubtaskBreakdownSchema = z.object({
  /** Subtasks in execution order */
  subtasks: z.array(
    z.object({
      /** Short description of the subtask */
      description: z.string(),
      /** Domain this subtask belongs to */
      domain: ClassificationDomainSchema,
      /** Suggested agent for this subtask */
      agent: z.string(),
      /** IDs of subtasks this depends on (by index, 0-based) */
      dependsOn: z.array(z.number()),
    })
  ),
  /** Estimated total effort */
  effort: z.enum(['low', 'medium', 'high']),
})

// =============================================================================
// Schema-to-Prompt Serializer
// =============================================================================

/**
 * Registry of output schemas keyed by prompt type.
 * Used by prompt-builder to inject the correct schema into each prompt.
 */
export const OUTPUT_SCHEMAS: Record<string, { schema: z.ZodTypeAny; example: string }> = {
  classification: {
    schema: TaskClassificationSchema,
    example: JSON.stringify(
      {
        primaryDomain: 'backend',
        secondaryDomains: ['database'],
        confidence: 0.9,
        filePatterns: ['src/api/**'],
        relevantAgents: ['backend.md'],
      },
      null,
      2
    ),
  },
  agentAssignment: {
    schema: AgentAssignmentSchema,
    example: JSON.stringify(
      {
        agentName: 'backend.md',
        reasoning: 'Task involves API endpoint creation',
        confidence: 0.85,
      },
      null,
      2
    ),
  },
  subtaskBreakdown: {
    schema: SubtaskBreakdownSchema,
    example: JSON.stringify(
      {
        subtasks: [
          {
            description: 'Add schema validation',
            domain: 'backend',
            agent: 'backend.md',
            dependsOn: [],
          },
          {
            description: 'Add unit tests',
            domain: 'testing',
            agent: 'testing.md',
            dependsOn: [0],
          },
        ],
        effort: 'medium',
      },
      null,
      2
    ),
  },
}

/**
 * Render a schema as prompt instructions.
 * Returns a markdown block that tells the LLM exactly what format to use.
 */
export function renderSchemaForPrompt(schemaType: string): string | null {
  const entry = OUTPUT_SCHEMAS[schemaType]
  if (!entry) return null

  return `## OUTPUT FORMAT

Return ONLY valid JSON matching this schema (no markdown, no explanation):

\`\`\`json
${entry.example}
\`\`\`

Fields:
${describeSchema(entry.schema)}`
}

/**
 * Extract field descriptions from a Zod object schema.
 */
function describeSchema(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    return Object.entries(shape)
      .map(([key, field]) => `- \`${key}\`: ${describeField(field)}`)
      .join('\n')
  }
  return '(see example above)'
}

/**
 * Describe a single Zod field type for prompt injection.
 */
function describeField(field: z.ZodTypeAny): string {
  if (field instanceof z.ZodString) return 'string'
  if (field instanceof z.ZodNumber) return 'number'
  if (field instanceof z.ZodEnum) return `one of: ${(field.options as string[]).join(', ')}`
  if (field instanceof z.ZodArray) return `array of ${describeField(field.element)}`
  if (field instanceof z.ZodObject) return 'object'
  return 'any'
}

// =============================================================================
// Inferred Types
// =============================================================================

export type AgentAssignment = z.infer<typeof AgentAssignmentSchema>
export type SubtaskBreakdown = z.infer<typeof SubtaskBreakdownSchema>
