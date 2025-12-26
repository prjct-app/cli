/**
 * Infrastructure Types
 * Types for path management, configuration, and system infrastructure.
 */

// =============================================================================
// Path Management Types
// =============================================================================

/**
 * Session information for date-based paths
 */
export interface PathSessionInfo {
  year: string
  month: string
  day: string
  path: string
  date: Date
}

/**
 * Layer types for file organization
 */
export type LayerType =
  | 'core'
  | 'planning'
  | 'progress'
  | 'analysis'
  | 'memory'
  | 'agents'
  | 'sessions'
  | 'sync'
  | 'storage'
  | 'context'

// =============================================================================
// Command Installer Types
// =============================================================================

/**
 * Result of command installation
 */
export interface InstallResult {
  success: boolean
  installed?: string[]
  errors?: Array<{ file: string; error: string }>
  path?: string
  error?: string
}

/**
 * Result of command uninstallation
 */
export interface UninstallResult {
  success: boolean
  uninstalled?: string[]
  errors?: Array<{ file: string; error: string }>
  error?: string
}

/**
 * Result of installation check
 */
export interface CheckResult {
  installed: boolean
  claudeDetected: boolean
  commands?: string[]
  path?: string
}

/**
 * Result of command sync
 */
export interface SyncResult {
  success: boolean
  added: number
  updated: number
  removed: number
  errors?: Array<{ file: string; error: string }>
  error?: string
}

/**
 * Result of global config installation
 */
export interface GlobalConfigResult {
  success: boolean
  action: string
  path?: string
  error?: string
}

// =============================================================================
// Permission Types
// =============================================================================

/**
 * Permission level for operations
 */
export type PermissionLevel = 'allow' | 'deny' | 'ask'

/**
 * File operation types
 */
export type FileOperation = 'read' | 'write' | 'delete' | 'create'

/**
 * Permissions configuration
 */
export interface PermissionsConfig {
  bash: Record<string, PermissionLevel>
  files: {
    read: Record<string, PermissionLevel>
    write: Record<string, PermissionLevel>
    delete: Record<string, PermissionLevel>
  }
  web: {
    enabled: boolean
    allowedDomains: string[]
    blockedDomains: string[]
  }
  skills: Record<string, PermissionLevel>
  doomLoop: {
    enabled: boolean
    maxRetries: number
  }
  externalDirectories: string[]
}

// =============================================================================
// Permission Manager Types
// =============================================================================

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  level: PermissionLevel
}

// =============================================================================
// Agent Detector Types
// =============================================================================

export interface AgentCapabilities {
  canExecuteBash: boolean
  canReadFiles: boolean
  canWriteFiles: boolean
  canAccessWeb: boolean
  hasToolUse: boolean
}

export interface AgentConfig {
  name: string
  type: string
  version?: string
  capabilities: AgentCapabilities
  settings?: Record<string, unknown>
}

export interface AgentEnvironment {
  isCI: boolean
  isTTY: boolean
  terminal: string | null
  shell: string | null
}

export interface DetectedAgentInfo {
  isSupported: boolean
  type: string
  name?: string
  version?: string
  capabilities?: AgentCapabilities
  environment?: AgentEnvironment
}

// =============================================================================
// Author Detector Types
// =============================================================================

export interface DetectedAuthor {
  name?: string
  email?: string
  github?: string
}

export interface ConfigStatus {
  hasLocalConfig: boolean
  hasGlobalConfig: boolean
  isValid: boolean
  projectId?: string
}
