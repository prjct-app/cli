/**
 * Schemas Module
 *
 * TypeScript types and defaults for all project data.
 * MD-First Architecture: Markdown files are the source of truth.
 *
 * Structure: ~/.prjct-cli/projects/{projectId}/
 *   - core/     (now.md, next.md, context.md)
 *   - progress/ (shipped.md, metrics.md)
 *   - planning/ (ideas.md, roadmap.md, tasks/)
 *   - analysis/ (repo-summary.md)
 *   - memory/   (context.jsonl, patterns.json)
 */

// State (current task + queue)
export * from './state'

// Project metadata
export * from './project'

// Agents
export * from './agents'

// Ideas
export * from './ideas'

// Roadmap (features)
export * from './roadmap'

// Shipped items
export * from './shipped'

// Analysis
export * from './analysis'

// Outcomes
export * from './outcomes'

// ============================================
// ID GENERATORS - UUID ONLY
// ============================================

import crypto from 'crypto'

/**
 * Generate a standard UUID.
 * All IDs in the system use this format for PostgreSQL consistency.
 */
export function generateUUID(): string {
  return crypto.randomUUID()
}

// All use the same UUID generator
export const generateTaskId = generateUUID
export const generateFeatureId = generateUUID
export const generateIdeaId = generateUUID
export const generateShipId = generateUUID
export const generateSessionId = generateUUID

// ============================================
// PATH HELPERS
// ============================================

import { join } from 'path'
import { homedir } from 'os'

export const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

export function getProjectPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId)
}
