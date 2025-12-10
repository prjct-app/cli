/**
 * Command Installer Types
 */

export interface InstallResult {
  success: boolean
  installed?: string[]
  errors?: Array<{ file: string; error: string }>
  path?: string
  error?: string
}

export interface UninstallResult {
  success: boolean
  uninstalled?: string[]
  errors?: Array<{ file: string; error: string }>
  error?: string
}

export interface CheckResult {
  installed: boolean
  claudeDetected: boolean
  commands?: string[]
  path?: string
}

export interface SyncResult {
  success: boolean
  added: number
  updated: number
  removed: number
  errors?: Array<{ file: string; error: string }>
  error?: string
}

export interface GlobalConfigResult {
  success: boolean
  action: string
  path?: string
  error?: string
}
