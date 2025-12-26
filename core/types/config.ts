/**
 * Config Types
 * Types for project and global configuration.
 */

/**
 * Local config - stored in .prjct/prjct.config.json
 * Minimal config that points to global storage
 */
export interface LocalConfig {
  projectId: string
  dataPath: string
}

/**
 * Global config - stored in ~/.prjct-cli/projects/{id}/project.json
 * Contains all project metadata
 */
export interface GlobalConfig {
  projectId: string
  projectPath?: string
  authors: AuthorEntry[]
  version: string
  created?: string
  lastSync: string
}

/**
 * Author entry in global config
 */
export interface AuthorEntry {
  name: string
  email: string
  github: string
  firstContribution?: string
  lastActivity?: string
}

/**
 * Project config - generic project settings (for registry)
 */
export interface ProjectConfig {
  projectId: string
  name?: string
  createdAt: string
  updatedAt: string
  settings?: ProjectSettings
}

/**
 * Project-specific settings
 */
export interface ProjectSettings {
  autoCommit?: boolean
  commitFooter?: string
  branchNaming?: string
}

/**
 * Global settings - user preferences
 */
export interface GlobalSettings {
  defaultAuthor?: string
  theme?: 'light' | 'dark'
  telemetry?: boolean
}
