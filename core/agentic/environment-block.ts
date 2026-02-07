/**
 * Environment Block Generator
 *
 * Generates a structured <env> block for prompt injection.
 * Provides the LLM with structured environment context (project, git, platform,
 * runtime, model) so it knows its operating environment before processing tasks.
 *
 * Research shows placing environment context early in prompts (position 2, after identity)
 * significantly improves grounding and reduces hallucinations.
 *
 * @module agentic/environment-block
 * @see PRJ-301
 */

import os from 'node:os'
import { z } from 'zod'

// =============================================================================
// Schema
// =============================================================================

export const EnvironmentBlockInputSchema = z.object({
  /** Project display name */
  projectName: z.string(),
  /** Absolute path to project root */
  projectPath: z.string(),
  /** Whether the project is a git repository */
  isGitRepo: z.boolean().default(true),
  /** Current git branch name */
  gitBranch: z.string().optional(),
  /** Operating system platform (auto-detected if not provided) */
  platform: z.string().optional(),
  /** JavaScript runtime (auto-detected if not provided) */
  runtime: z.string().optional(),
  /** Current date in ISO format (auto-generated if not provided) */
  date: z.string().optional(),
  /** AI model identifier (e.g., 'opus', 'sonnet', '2.5-pro') */
  model: z.string().optional(),
  /** AI provider name (e.g., 'claude', 'gemini', 'cursor') */
  provider: z.string().optional(),
})

export type EnvironmentBlockInput = z.infer<typeof EnvironmentBlockInputSchema>

// =============================================================================
// Runtime Detection
// =============================================================================

/** Detect the current JavaScript runtime */
function detectRuntime(): string {
  if (typeof globalThis !== 'undefined' && 'Bun' in globalThis) {
    return 'bun'
  }
  return 'node'
}

/** Normalize platform name for readability */
function normalizePlatform(platform: string): string {
  const platformMap: Record<string, string> = {
    darwin: 'macOS',
    linux: 'Linux',
    win32: 'Windows',
    freebsd: 'FreeBSD',
  }
  return platformMap[platform] ?? platform
}

// =============================================================================
// Generator
// =============================================================================

/**
 * Build a structured environment block for prompt injection.
 *
 * Returns an XML-style `<env>` block containing project metadata,
 * git state, platform info, and AI model/provider details.
 *
 * Fields with undefined/null values are omitted from output.
 */
export function buildEnvironmentBlock(input: EnvironmentBlockInput): string {
  const platform = input.platform ?? os.platform()
  const runtime = input.runtime ?? detectRuntime()
  const date = input.date ?? new Date().toISOString().split('T')[0]

  const fields: [string, string | undefined][] = [
    ['project', input.projectName],
    ['path', input.projectPath],
    ['git', input.isGitRepo ? 'true' : 'false'],
    ['branch', input.gitBranch],
    ['platform', normalizePlatform(platform)],
    ['runtime', runtime],
    ['date', date],
    ['model', input.model],
    ['provider', input.provider],
  ]

  const lines = fields
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value}`)

  return `<env>\n${lines.join('\n')}\n</env>`
}
