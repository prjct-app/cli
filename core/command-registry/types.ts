/**
 * Command Registry Types
 */

export interface CommandUsage {
  claude: string | null
  terminal: string | null
}

export interface BlockingRules {
  check: string
  message: string
}

export interface Command {
  name: string
  category: string
  description: string
  usage: CommandUsage
  params?: string
  implemented: boolean
  hasTemplate: boolean
  requiresInit: boolean
  blockingRules?: BlockingRules
  features?: string[]
  isOptional?: boolean
  deprecated?: boolean
  replacedBy?: string
}

export interface CategoryInfo {
  title: string
  description: string
  order: number
}

export interface Categories {
  [key: string]: CategoryInfo
}

export interface RegistryStats {
  total: number
  core: number
  optional: number
  setup: number
  implemented: number
  withTemplates: number
  claudeOnly: number
  terminalOnly: number
  both: number
  requiresInit: number
  withBlockingRules: number
  byCategory: Record<string, number>
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
}
