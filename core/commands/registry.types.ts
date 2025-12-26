/**
 * Command Registry Types
 *
 * Type definitions for the command registry system.
 */

import type { CommandResult } from './types'

/**
 * Execution context passed to all command handlers
 */
export interface ExecutionContext {
  projectId: string
  projectPath: string
  globalPath: string
  timestamp: string
}

/**
 * Command handler interface - all commands implement this
 */
export interface CommandHandler<TParams = void, TResult = CommandResult> {
  /** Command name for registration */
  readonly name: string
  /** Execute the command */
  execute(params: TParams, context: ExecutionContext): Promise<TResult>
}

/**
 * Handler function type for simple commands
 */
export type HandlerFn<TParams = void> = (
  params: TParams,
  context: ExecutionContext
) => Promise<CommandResult>

/**
 * Command usage - which interfaces support this command
 */
export interface CommandUsage {
  claude: string | null
  terminal: string | null
}

/**
 * Blocking rules for commands
 */
export interface BlockingRules {
  check: string
  message: string
}

/**
 * Command metadata for introspection
 */
export interface CommandMeta {
  name: string
  group: string
  description: string
  requiresProject: boolean
  usage: CommandUsage
  params?: string
  implemented: boolean
  hasTemplate: boolean
  blockingRules?: BlockingRules
  features?: string[]
  isOptional?: boolean
  deprecated?: boolean
  replacedBy?: string
}

/**
 * Category metadata
 */
export interface CategoryInfo {
  title: string
  description: string
  order: number
}

/**
 * Registry statistics
 */
export interface RegistryStats {
  total: number
  implemented: number
  withTemplates: number
  claudeOnly: number
  terminalOnly: number
  both: number
  requiresInit: number
  byCategory: Record<string, number>
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean
  issues: string[]
}
