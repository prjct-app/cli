/**
 * Configuration Types
 *
 * Type definitions for project configuration.
 */

import type { PermissionsConfig } from '../schemas/permissions'

/**
 * Author information
 */
export interface Author {
  name: string
  email: string
  github: string
  firstContribution?: string
  lastActivity?: string
}

/**
 * Local project configuration (.prjct/prjct.config.json)
 */
export interface LocalConfig {
  projectId: string
  dataPath: string
  authors?: Author[]
  author?: Author
  version?: string
  created?: string
  lastSync?: string
  /** Granular permissions for bash, files, and web access */
  permissions?: PermissionsConfig
}

/**
 * Global project configuration (~/.prjct-cli/projects/{id}/project.json)
 */
export interface GlobalConfig {
  projectId: string
  authors: Author[]
  version: string
  created?: string
  lastSync: string
}
