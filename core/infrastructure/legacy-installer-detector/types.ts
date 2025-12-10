/**
 * Legacy Installer Detector Types
 */

// Colors
export const CYAN = '\x1b[36m'
export const GREEN = '\x1b[32m'
export const YELLOW = '\x1b[33m'
export const RED = '\x1b[31m'
export const DIM = '\x1b[2m'
export const NC = '\x1b[0m'

export interface CleanupSteps {
  projectsMigrated: number
  installationCleaned: boolean
  pathCleaned: boolean
  symlinksCleaned: boolean
}

export interface CleanupReport {
  success: boolean
  legacyVersion: string | null
  hasNpm: boolean
  steps: CleanupSteps
  messages: string[]
}

export interface MigrationResult {
  success: boolean
  projectsMigrated: number
  message: string
}

export interface CleanupResult {
  success: boolean
  message: string
  filesModified?: number
}

export interface CleanupOptions {
  verbose?: boolean
}
