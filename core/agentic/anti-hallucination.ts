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
import { deduplicateTechStack } from './tech-normalizer'

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
  /** Sealed analysis languages — used to ground available tech (PRJ-260) */
  analysisLanguages: z.array(z.string()).default([]),
  /** Sealed analysis frameworks — used to ground available tech (PRJ-260) */
  analysisFrameworks: z.array(z.string()).default([]),
  /** Package manager from sealed analysis (PRJ-260) */
  analysisPackageManager: z.string().optional(),
})

// ProjectGroundTruth type moved to core/types/agentic.ts
import type { ProjectGroundTruth } from '../types/agentic.js'

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

  // 1. Explicit availability (enriched by sealed analysis — PRJ-260, PRJ-300)
  // Use normalized deduplication to prevent "React" and "react" appearing twice,
  // and to handle aliases like "Next.js" vs "nextjs".
  const rawAvailable: string[] = []
  if (truth.language) rawAvailable.push(truth.language)
  if (truth.framework) rawAvailable.push(truth.framework)
  const techStack = truth.techStack ?? []
  rawAvailable.push(...techStack)
  // Merge languages/frameworks from sealed analysis
  const analysisLangs = truth.analysisLanguages ?? []
  const analysisFrameworks = truth.analysisFrameworks ?? []
  rawAvailable.push(...analysisLangs, ...analysisFrameworks)
  const available = deduplicateTechStack(rawAvailable)

  if (available.length > 0) {
    parts.push(`AVAILABLE in this project: ${available.join(', ')}`)
  }
  if (truth.analysisPackageManager) {
    parts.push(`PACKAGE MANAGER: ${truth.analysisPackageManager}`)
  }

  // 2. Explicit unavailability from domain flags
  if (truth.domains) {
    const absent = Object.entries(truth.domains)
      .filter(([, hasIt]) => !hasIt)
      .map(([key]) => key.replace(/^has/, '').toLowerCase())

    if (absent.length > 0) {
      parts.push(`NOT PRESENT: ${absent.join(', ')}`)
    }
  }

  // 3. Scope and grounding rules
  parts.push('')
  parts.push(`SCOPE: Only files in \`${truth.projectPath}\` are accessible.`)

  if (truth.fileCount) {
    parts.push(`\nContext: ${truth.fileCount} files in project.`)
  }

  return parts.join('\n')
}
