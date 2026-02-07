/**
 * Config Types
 * Types for project and global configuration.
 */

import type { IntegrationsConfig } from './integrations'

/**
 * Local config - stored in .prjct/prjct.config.json
 * Minimal config that points to global storage
 */
export interface LocalConfig {
  projectId: string
  dataPath: string
  /**
   * Whether to show metrics in command output.
   * Defaults to true for new projects.
   * @see PRJ-70
   */
  showMetrics?: boolean
  /**
   * Verification checks to run after sync.
   * Built-in checks always run; custom checks are additive.
   * @see PRJ-106
   */
  verification?: {
    checks?: Array<{
      name: string
      command?: string
      script?: string
      enabled?: boolean
    }>
    failFast?: boolean
  }
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
  // Optional external integrations (Linear, JIRA)
  integrations?: IntegrationsConfig
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
  /** Preferred AI model for this project (e.g., 'opus', 'sonnet', '2.5-pro') */
  preferredModel?: string
}

/**
 * Global settings - user preferences
 */
export interface GlobalSettings {
  defaultAuthor?: string
  theme?: 'light' | 'dark'
  telemetry?: boolean
}
