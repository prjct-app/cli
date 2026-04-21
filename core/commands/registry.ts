/**
 * Command Registry - Central command routing and execution
 *
 * Replaces the aggregator anti-pattern in commands.ts with a proper registry.
 * Each command is registered as a handler that receives context and returns a result.
 */

import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import type {
  CategoryInfo,
  CommandHandler,
  CommandMeta,
  CommandResult,
  ExecutionContext,
  HandlerFn,
  RegistryStats,
} from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { getTimestamp } from '../utils/date-helper'

// Re-export types for convenience
export type {
  BlockingRules,
  CategoryInfo,
  CommandHandler,
  CommandMeta,
  ExecutionContext,
  HandlerFn,
  RegistryCommandUsage as CommandUsage,
  RegistryStats,
  ValidationResult,
} from '../types/commands'

/**
 * Command Registry - Routes commands to handlers
 *
 * Single source of truth for command metadata and execution.
 * Supports:
 * - Class-based handlers (CommandHandler interface)
 * - Function-based handlers (HandlerFn type)
 * - Bound method registration from existing classes
 * - Full metadata registration from static definitions
 */
export class CommandRegistry {
  private handlers: Map<string, CommandHandler<unknown>> = new Map()
  private handlerFns: Map<string, HandlerFn<unknown>> = new Map()
  private metadata: Map<string, CommandMeta> = new Map()
  private categories: Map<string, CategoryInfo> = new Map()
  private noProjectCommands: Set<string> = new Set(['init', 'setup', 'start', 'migrateAll'])

  /**
   * Register a command handler (class-based)
   */
  register<TParams>(handler: CommandHandler<TParams>, meta?: Partial<CommandMeta>): void {
    this.handlers.set(handler.name, handler as CommandHandler<unknown>)
    this.setMeta(handler.name, meta)
  }

  /**
   * Register a command handler function (function-based)
   */
  registerFn<TParams>(
    name: string,
    handler: HandlerFn<TParams>,
    meta?: Partial<CommandMeta>
  ): void {
    this.handlerFns.set(name, handler as HandlerFn<unknown>)
    this.setMeta(name, meta)
  }

  /**
   * Set command metadata with defaults
   */
  private setMeta(name: string, meta?: Partial<CommandMeta>): void {
    const requiresProject = meta?.requiresProject ?? !this.noProjectCommands.has(name)
    this.metadata.set(name, {
      name,
      group: meta?.group ?? 'unknown',
      description: meta?.description ?? '',
      requiresProject,
      usage: meta?.usage ?? { claude: null, terminal: null },
      implemented: meta?.implemented ?? true,
      hasTemplate: meta?.hasTemplate ?? false,
      params: meta?.params,
      blockingRules: meta?.blockingRules,
      features: meta?.features,
      isOptional: meta?.isOptional,
      deprecated: meta?.deprecated,
      replacedBy: meta?.replacedBy,
    })
  }

  /**
   * Register a category
   */
  registerCategory(name: string, info: CategoryInfo): void {
    this.categories.set(name, info)
  }

  /**
   * Register a bound method from an existing command group
   * Bridges command classes to the registry pattern
   */
  registerMethod<T extends object>(
    name: string,
    instance: T,
    methodName: keyof T,
    meta?: Partial<CommandMeta>
  ): void {
    const method = instance[methodName]
    if (typeof method !== 'function') {
      throw new Error(`${String(methodName)} is not a function`)
    }

    // Create a wrapper that adapts method signature to HandlerFn
    const wrapper: HandlerFn<unknown> = async (params, context) => {
      // Commands expect (param?, projectPath) signature
      type LegacyMethod = (...args: unknown[]) => Promise<CommandResult>
      if (params !== undefined && params !== null) {
        return (method as LegacyMethod).call(instance, params, context.projectPath)
      }
      return (method as LegacyMethod).call(instance, context.projectPath)
    }

    this.handlerFns.set(name, wrapper)
    this.setMeta(name, meta)
  }

  /**
   * Check if a command is registered
   */
  has(name: string): boolean {
    return this.handlers.has(name) || this.handlerFns.has(name)
  }

  /**
   * Get list of registered commands
   */
  list(): string[] {
    return [...this.handlers.keys(), ...this.handlerFns.keys()]
  }

  /**
   * Get commands by group
   */
  listByGroup(group: string): string[] {
    return Array.from(this.metadata.entries())
      .filter(([, meta]) => meta.group === group)
      .map(([name]) => name)
  }

  /**
   * Get all groups
   */
  getGroups(): string[] {
    const groups = new Set<string>()
    for (const meta of this.metadata.values()) {
      groups.add(meta.group)
    }
    return Array.from(groups)
  }

  /**
   * Get command metadata
   */
  getMeta(name: string): CommandMeta | undefined {
    return this.metadata.get(name)
  }

  // ===== Query Methods (from static registry) =====

  /**
   * Get all commands
   */
  getAll(): CommandMeta[] {
    return Array.from(this.metadata.values())
  }

  /**
   * Get command by name
   */
  getByName(name: string): CommandMeta | undefined {
    return this.metadata.get(name)
  }

  /**
   * Get commands by category/group
   */
  getByCategory(category: string): CommandMeta[] {
    return this.getAll().filter((c) => c.group === category)
  }

  /**
   * Get all implemented commands
   */
  getAllImplemented(): CommandMeta[] {
    return this.getAll().filter((c) => c.implemented)
  }

  /**
   * Get all commands with templates
   */
  getAllWithTemplates(): CommandMeta[] {
    return this.getAll().filter((c) => c.hasTemplate)
  }

  /**
   * Get commands available in Claude Code
   */
  getClaudeCommands(): CommandMeta[] {
    return this.getAll().filter((c) => c.usage.claude !== null)
  }

  /**
   * Get commands available in terminal
   */
  getTerminalCommands(): CommandMeta[] {
    return this.getAll().filter((c) => c.usage.terminal !== null)
  }

  /**
   * Get all categories
   */
  getAllCategories(): Map<string, CategoryInfo> {
    return new Map(this.categories)
  }

  /**
   * Get category metadata
   */
  getCategory(category: string): CategoryInfo | undefined {
    return this.categories.get(category)
  }

  /**
   * Get commands that require initialization
   */
  getRequiresInit(): CommandMeta[] {
    return this.getAll().filter((c) => c.requiresProject)
  }

  /**
   * Get commands with blocking rules
   */
  getWithBlockingRules(): CommandMeta[] {
    return this.getAll().filter((c) => c.blockingRules !== undefined)
  }

  /**
   * Get optional commands
   */
  getOptionalCommands(): CommandMeta[] {
    return this.getAll().filter((c) => c.isOptional)
  }

  /**
   * Get deprecated commands
   */
  getDeprecatedCommands(): CommandMeta[] {
    return this.getAll().filter((c) => c.deprecated)
  }

  /**
   * Get statistics
   */
  getStats(): RegistryStats {
    const all = this.getAll()
    const byCategory: Record<string, number> = {}

    for (const category of this.categories.keys()) {
      byCategory[category] = all.filter((c) => c.group === category).length
    }

    return {
      total: all.length,
      implemented: all.filter((c) => c.implemented).length,
      withTemplates: all.filter((c) => c.hasTemplate).length,
      claudeOnly: all.filter((c) => c.usage.claude && !c.usage.terminal).length,
      terminalOnly: all.filter((c) => !c.usage.claude && c.usage.terminal).length,
      both: all.filter((c) => c.usage.claude && c.usage.terminal).length,
      requiresInit: all.filter((c) => c.requiresProject).length,
      byCategory,
    }
  }

  /**
   * Validate registry
   */
  validate(): { valid: boolean; issues: string[] } {
    const issues: string[] = []
    const all = this.getAll()

    // Check for duplicate names
    const names = all.map((c) => c.name)
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index)
    if (duplicates.length > 0) {
      issues.push(`Duplicate command names: ${duplicates.join(', ')}`)
    }

    // Check for commands with templates but not implemented
    const notImplemented = all.filter((c) => c.hasTemplate && !c.implemented)
    if (notImplemented.length > 0) {
      issues.push(
        `Commands with templates but not implemented: ${notImplemented.map((c) => c.name).join(', ')}`
      )
    }

    // Check for invalid categories
    const validCategories = Array.from(this.categories.keys())
    if (validCategories.length > 0) {
      const invalidCategories = all.filter((c) => !validCategories.includes(c.group))
      if (invalidCategories.length > 0) {
        issues.push(
          `Invalid categories: ${invalidCategories.map((c) => `${c.name}:${c.group}`).join(', ')}`
        )
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }

  /**
   * Build execution context for a project
   */
  async buildContext(projectPath: string): Promise<ExecutionContext> {
    const projectId = await configManager.getProjectId(projectPath)

    if (!projectId) {
      throw new Error('No prjct project found. Run /p:init first.')
    }

    return {
      projectId,
      projectPath,
      globalPath: pathManager.getGlobalProjectPath(projectId),
      timestamp: getTimestamp(),
    }
  }

  /**
   * Execute a command by name
   */
  async execute<TParams = void>(
    name: string,
    params: TParams,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const meta = this.metadata.get(name)

    // Build context (may throw if project not initialized)
    let context: ExecutionContext
    if (meta?.requiresProject === false) {
      context = {
        projectId: '',
        projectPath,
        globalPath: '',
        timestamp: getTimestamp(),
      }
    } else {
      try {
        context = await this.buildContext(projectPath)
      } catch (error) {
        return {
          success: false,
          error: getErrorMessage(error),
        }
      }
    }

    // Check class-based handlers first
    const handler = this.handlers.get(name)
    if (handler) {
      return handler.execute(params, context)
    }

    // Check function-based handlers
    const handlerFn = this.handlerFns.get(name)
    if (handlerFn) {
      return handlerFn(params, context)
    }

    return {
      success: false,
      error: `Command not found: ${name}`,
    }
  }

  /**
   * Execute without requiring project (for init, setup commands)
   * @deprecated Use execute() - it auto-detects based on command metadata
   */
  async executeWithoutProject<TParams = void>(
    name: string,
    params: TParams,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    const handler = this.handlers.get(name)
    if (handler) {
      const context: ExecutionContext = {
        projectId: '',
        projectPath,
        globalPath: '',
        timestamp: getTimestamp(),
      }
      return handler.execute(params, context)
    }

    const handlerFn = this.handlerFns.get(name)
    if (handlerFn) {
      const context: ExecutionContext = {
        projectId: '',
        projectPath,
        globalPath: '',
        timestamp: getTimestamp(),
      }
      return handlerFn(params, context)
    }

    return {
      success: false,
      error: `Command not found: ${name}`,
    }
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.handlers.clear()
    this.handlerFns.clear()
    this.metadata.clear()
    this.categories.clear()
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry()
export default commandRegistry
