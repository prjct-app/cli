/**
 * Config Types
 * Types for project and global configuration.
 */

/**
 * Persona declaration — Claude's role in THIS project.
 *
 * Hooks inject this as additionalContext so Claude enters every session
 * knowing what hat to wear. The human rotates across contexts (PM in
 * project A, Founder in B, DEV in C); the persona makes that switch
 * explicit without ceremony.
 *
 * Declarative only: lists what MCPs/packs exist, never how to use them.
 */
export interface ProjectPersona {
  /** Claude's role label. Freeform, but common: PM / PO / DEV / TDD / Founder / Research / custom */
  role: string
  /** One-line project focus — e.g. "B2B SaaS onboarding optimization" */
  focus?: string
  /** MCP servers this project expects available. Purely informational signal for Claude. */
  mcps?: string[]
  /** Seed packs active in this project (see templates/packs/*.json) */
  packs?: string[]
}

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
  /**
   * Persona declaration for this project. Read by hooks to inject
   * Claude's role + available MCPs into `additionalContext`.
   */
  persona?: ProjectPersona
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
