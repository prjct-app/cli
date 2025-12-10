/**
 * Schemas Module
 *
 * TypeScript types and defaults for all JSON data files.
 * These schemas define the source-of-truth for all project data.
 *
 * Data lives in: ~/.prjct-cli/projects/{projectId}/data/
 * Views are generated in: ~/.prjct-cli/projects/{projectId}/views/
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
// ID GENERATORS
// ============================================

function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return `${prefix}_${id}`
}

export const generateTaskId = (): string => generateId('task')
export const generateFeatureId = (): string => generateId('feat')
export const generateIdeaId = (): string => generateId('idea')
export const generateShipId = (): string => generateId('ship')
export const generateSessionId = (): string => generateId('sess')

// ============================================
// PATH HELPERS
// ============================================

import { join } from 'path'
import { homedir } from 'os'

export const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

export function getProjectPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId)
}

export function getDataPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId, 'data')
}

export function getViewsPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId, 'views')
}
