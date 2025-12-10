/**
 * Validation
 * Handles migration validation and legacy cleanup.
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../path-manager'
import type { ValidationResult, StatusResult } from './types'

/**
 * Validate that migration was successful
 */
export async function validateMigration(projectId: string): Promise<ValidationResult> {
  const issues: string[] = []

  const exists = await pathManager.projectExists(projectId)
  if (!exists) {
    issues.push('Global project directory not found')
    return { valid: false, issues }
  }

  const globalPath = pathManager.getGlobalProjectPath(projectId)
  const requiredLayers = ['core', 'progress', 'planning', 'analysis', 'memory']

  for (const layer of requiredLayers) {
    try {
      await fs.access(path.join(globalPath, layer))
    } catch {
      issues.push(`Missing layer directory: ${layer}`)
    }
  }

  try {
    const coreFiles = await fs.readdir(path.join(globalPath, 'core'))
    if (coreFiles.length === 0) {
      issues.push('No files found in core directory')
    }
  } catch {
    issues.push('Cannot read core directory')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

/**
 * Cleanup legacy directories while preserving config
 * Removes: analysis/, core/, memory/, planning/, progress/, sessions/
 * Keeps: prjct.config.json
 */
export async function cleanupLegacyDirectories(projectPath: string): Promise<void> {
  const legacyPath = pathManager.getLegacyPrjctPath(projectPath)
  const layersToRemove = ['analysis', 'core', 'memory', 'planning', 'progress', 'sessions']

  for (const layer of layersToRemove) {
    const layerPath = path.join(legacyPath, layer)
    try {
      await fs.rm(layerPath, { recursive: true, force: true })
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Check migration status for a project
 */
export async function checkStatus(projectPath: string): Promise<StatusResult> {
  const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
  const hasConfig = await pathManager.hasConfig(projectPath)
  const needsMigration = hasLegacy && !hasConfig

  let status = 'unknown'
  if (!hasLegacy && !hasConfig) {
    status = 'new' // New project, not initialized
  } else if (!hasLegacy && hasConfig) {
    status = 'migrated' // Already migrated to v0.2.0
  } else if (hasLegacy && !hasConfig) {
    status = 'legacy' // v0.1.0, needs migration
  } else if (hasLegacy && hasConfig) {
    status = 'both' // Has both (migration incomplete or manual setup)
  }

  return {
    status,
    hasLegacy,
    hasConfig,
    needsMigration,
    version: hasConfig ? '0.2.0' : hasLegacy ? '0.1.0' : 'none',
  }
}
