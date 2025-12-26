/**
 * Command Registry - Central command routing and execution
 *
 * Replaces the aggregator anti-pattern in commands.ts with a proper registry.
 * Each command is registered as a handler that receives context and returns a result.
 */

import type { CommandResult } from './types'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { getTimestamp } from '../utils/date-helper'

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
 * Command metadata for introspection
 */
export interface CommandMeta {
  name: string
  group: string
  description?: string
  requiresProject: boolean
}

/**
 * Command Registry - Routes commands to handlers
 *
 * Supports:
 * - Class-based handlers (CommandHandler interface)
 * - Function-based handlers (HandlerFn type)
 * - Bound method registration from existing classes
 */
export class CommandRegistry {
  private handlers: Map<string, CommandHandler<unknown>> = new Map()
  private handlerFns: Map<string, HandlerFn<unknown>> = new Map()
  private metadata: Map<string, CommandMeta> = new Map()
  private noProjectCommands: Set<string> = new Set(['init', 'setup', 'start', 'migrateAll'])

  /**
   * Register a command handler (class-based)
   */
  register<TParams>(handler: CommandHandler<TParams>, meta?: Partial<CommandMeta>): void {
    this.handlers.set(handler.name, handler as CommandHandler<unknown>)
    this.metadata.set(handler.name, {
      name: handler.name,
      group: meta?.group ?? 'unknown',
      description: meta?.description,
      requiresProject: !this.noProjectCommands.has(handler.name),
    })
  }

  /**
   * Register a command handler function (function-based)
   */
  registerFn<TParams>(name: string, handler: HandlerFn<TParams>, meta?: Partial<CommandMeta>): void {
    this.handlerFns.set(name, handler as HandlerFn<unknown>)
    this.metadata.set(name, {
      name,
      group: meta?.group ?? 'unknown',
      description: meta?.description,
      requiresProject: !this.noProjectCommands.has(name),
    })
  }

  /**
   * Register a bound method from an existing command group
   * Bridges legacy command classes to the registry pattern
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

    // Create a wrapper that adapts legacy method signature to HandlerFn
    const wrapper: HandlerFn<unknown> = async (params, context) => {
      // Legacy commands expect (param?, projectPath) signature
      // Most commands use first param + projectPath
      if (params !== undefined && params !== null) {
        return (method as Function).call(instance, params, context.projectPath)
      }
      return (method as Function).call(instance, context.projectPath)
    }

    this.handlerFns.set(name, wrapper)
    this.metadata.set(name, {
      name,
      group: meta?.group ?? 'unknown',
      description: meta?.description,
      requiresProject: !this.noProjectCommands.has(name),
    })
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
    return [
      ...this.handlers.keys(),
      ...this.handlerFns.keys(),
    ]
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
          error: (error as Error).message,
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
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry()
export default commandRegistry
