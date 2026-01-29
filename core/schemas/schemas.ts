/**
 * Schemas Utilities
 *
 * ID generators and path helpers for project data.
 */

import crypto from 'node:crypto'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ============================================
// ID GENERATORS - UUID ONLY
// ============================================

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

export const GLOBAL_STORAGE = join(homedir(), '.prjct-cli', 'projects')

export function getProjectPath(projectId: string): string {
  return join(GLOBAL_STORAGE, projectId)
}
