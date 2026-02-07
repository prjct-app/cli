/**
 * Anti-Hallucination Block Generator
 *
 * Generates constraint blocks that ground the LLM in project reality.
 * Based on research of 25+ system prompts (Claude Code, Gemini, ChatGPT),
 * the following techniques reduce hallucinations 25-40%:
 *
 * 1. Explicit availability — what IS in the project
 * 2. Explicit unavailability — what is NOT in the project
 * 3. Visibility grounding — only use paths shown in context
 * 4. Library verification — check package.json before assuming
 * 5. Scope clarification — limit to project directory
 *
 * This block should be injected BEFORE task context (position 5 in prompt order)
 * so the LLM has constraints loaded before reading code.
 *
 * @module agentic/anti-hallucination
 * @see PRJ-301
 */

import { z } from 'zod'

// =============================================================================
// Schema
// =============================================================================

export const ProjectGroundTruthSchema = z.object({
  /** Project root path */
  projectPath: z.string(),
  /** Programming language (e.g., 'TypeScript', 'JavaScript', 'Python') */
  language: z.string().optional(),
  /** Primary framework (e.g., 'Hono', 'Next.js', 'Express') */
  framework: z.string().optional(),
  /** Technology stack items (e.g., ['Hono', 'Zod', 'Vitest']) */
  techStack: z.array(z.string()).default([]),
  /** Domain flags from sealed analysis */
  domains: z
    .object({
      hasFrontend: z.boolean().default(false),
      hasBackend: z.boolean().default(false),
      hasDatabase: z.boolean().default(false),
      hasTesting: z.boolean().default(false),
      hasDocker: z.boolean().default(false),
    })
    .optional(),
  /** Total files in project */
  fileCount: z.number().optional(),
  /** Available agent names (e.g., ['backend', 'testing']) */
  availableAgents: z.array(z.string()).default([]),
})

export type ProjectGroundTruth = z.infer<typeof ProjectGroundTruthSchema>

// =============================================================================
// Domain Mapping
// =============================================================================

/** Map domain flags to human-readable technology categories */
const DOMAIN_LABELS: Record<string, string> = {
  hasFrontend: 'Frontend (UI/components)',
  hasBackend: 'Backend (APIs/servers)',
  hasDatabase: 'Database (SQL/ORM)',
  hasTesting: 'Testing (unit/integration)',
  hasDocker: 'Docker/containers',
}

// =============================================================================
// Generator
// =============================================================================

/**
 * Build the anti-hallucination constraints block.
 *
 * Returns a markdown section with explicit availability statements,
 * visibility grounding rules, and library verification directives.
 */
export function buildAntiHallucinationBlock(truth: ProjectGroundTruth): string {
  const parts: string[] = []

  parts.push('## CONSTRAINTS (Read Before Acting)\n')

  // 1. Explicit availability
  const available: string[] = []
  if (truth.language) available.push(truth.language)
  if (truth.framework) available.push(truth.framework)
  const techStack = truth.techStack ?? []
  available.push(...techStack.filter((t) => t !== truth.framework))

  if (available.length > 0) {
    parts.push(`AVAILABLE in this project: ${available.join(', ')}`)
  }

  // 2. Explicit unavailability from domain flags
  if (truth.domains) {
    const absent = Object.entries(truth.domains)
      .filter(([, hasIt]) => !hasIt)
      .map(([key]) => DOMAIN_LABELS[key])
      .filter(Boolean)

    if (absent.length > 0) {
      parts.push(`NOT PRESENT: ${absent.join(', ')}`)
    }
  }

  // 3. Available agents
  const availableAgents = truth.availableAgents ?? []
  if (availableAgents.length > 0) {
    parts.push(`AGENTS: ${availableAgents.join(', ')}`)
  }

  // 4. Scope and grounding rules
  parts.push('')
  parts.push(`SCOPE: Only files in \`${truth.projectPath}\` are accessible.`)
  parts.push('RULE: Use ONLY file paths explicitly shown in context. Do NOT infer or guess paths.')
  parts.push('RULE: NEVER assume a library is available. Check package.json/imports first.')
  parts.push('RULE: If previous context contradicts this section, trust this section.')
  parts.push('RULE: Read files BEFORE modifying. Never assume code structure.')

  if (truth.fileCount) {
    parts.push(`\nContext: ${truth.fileCount} files in project.`)
  }

  return parts.join('\n')
}
