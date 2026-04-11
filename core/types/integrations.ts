/**
 * Integration Types
 */

/**
 * Obsidian Integration Config
 */
export interface ObsidianConfig {
  /** Absolute path to the Obsidian vault root */
  vaultPath: string
  /** Folder name inside vault/projects/ for this project (defaults to project directory name) */
  projectFolder?: string
  /** Auto-export on lifecycle events (task, done, ship) */
  autoExport?: boolean
}

/**
 * Integrations Config
 * Container for all external integrations
 */
export interface IntegrationsConfig {
  obsidian?: ObsidianConfig
}
