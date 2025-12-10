/**
 * Migrator Types
 * Type definitions for migration operations.
 */

export interface Author {
  name: string | null
  email: string | null
  github?: string | null
  firstContribution?: string
  lastActivity?: string
}

export interface LocalConfig {
  projectId: string
  dataPath: string
  authors?: Author[]
  author?: Author
  version?: string
  created?: string
  lastSync?: string
}

export interface LayerCounts {
  core: number
  progress: number
  planning: number
  analysis: number
  memory: number
  other: number
}

export interface MigrationResult {
  success: boolean
  projectId: string | null
  filesCopied?: number
  filescopied?: number
  layerCounts: LayerCounts
  config: LocalConfig | null
  author: Author | null
  issues: string[]
  dryRun: boolean
  legacyRemoved?: boolean
  legacyCleaned?: boolean
}

export interface VersionMigrationResult {
  success: boolean
  message: string
  oldVersion: string | null
  newVersion: string
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}

export interface FileMapping {
  layer: string
  filename: string
}

export interface MigrationStats {
  fileCount: number
  layerCounts: LayerCounts
}

export interface MigrationOptions {
  removeLegacy?: boolean
  cleanupLegacy?: boolean
  dryRun?: boolean
}

export interface StatusResult {
  status: string
  hasLegacy: boolean
  hasConfig: boolean
  needsMigration: boolean
  version: string
}

export interface ProjectInfo {
  path: string
  name: string
  status?: string
  result?: string
  reason?: string
  projectId?: string
  filesCopied?: number
  layerCounts?: LayerCounts
  errors?: string[]
}

export interface MigrationSummary {
  success: boolean
  totalFound: number
  alreadyMigrated: number
  successfullyMigrated: number
  failed: number
  skipped: number
  projects: ProjectInfo[]
  errors: Array<{ project: string; path?: string; issues: string[] }>
  dryRun: boolean
}

export interface MigrateAllOptions {
  deepScan?: boolean
  removeLegacy?: boolean
  cleanupLegacy?: boolean
  dryRun?: boolean
  interactive?: boolean
  onProgress?: (progress: {
    phase: string
    message: string
    current?: number
    total?: number
    projectPath?: string
  }) => boolean | void | Promise<boolean | void>
}

export interface FindProjectsOptions {
  deepScan?: boolean
}
