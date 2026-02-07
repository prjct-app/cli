/**
 * HookSystem - Plugin Lifecycle Hooks for prjct-cli
 *
 * Provides hook points for plugins to extend prjct functionality.
 * Hooks can modify data, add side effects, or integrate with external services.
 *
 * @version 1.0.0
 */

import { EventTypes, eventBus } from '../bus'
import { getErrorMessage } from '../types/fs'

/**
 * Hook Points - Where plugins can intercept
 */
const HookPoints = {
  // Before hooks (can modify data)
  BEFORE_SESSION_START: 'before:session.start',
  BEFORE_SESSION_COMPLETE: 'before:session.complete',
  BEFORE_TASK_CREATE: 'before:task.create',
  BEFORE_FEATURE_SHIP: 'before:feature.ship',
  BEFORE_SNAPSHOT_CREATE: 'before:snapshot.create',
  BEFORE_COMMIT: 'before:git.commit',

  // After hooks (for side effects)
  AFTER_SESSION_START: 'after:session.start',
  AFTER_SESSION_COMPLETE: 'after:session.complete',
  AFTER_TASK_CREATE: 'after:task.create',
  AFTER_TASK_COMPLETE: 'after:task.complete',
  AFTER_FEATURE_SHIP: 'after:feature.ship',
  AFTER_IDEA_CAPTURE: 'after:idea.capture',
  AFTER_SNAPSHOT_CREATE: 'after:snapshot.create',
  AFTER_SNAPSHOT_RESTORE: 'after:snapshot.restore',
  AFTER_COMMIT: 'after:git.commit',
  AFTER_PUSH: 'after:git.push',
  AFTER_SYNC: 'after:project.sync',

  // Transform hooks (must return modified data)
  TRANSFORM_COMMIT_MESSAGE: 'transform:commit.message',
  TRANSFORM_TASK_DATA: 'transform:task.data',
  TRANSFORM_METRICS: 'transform:metrics',
} as const

export type HookPoint = (typeof HookPoints)[keyof typeof HookPoints]
type HookHandler = (data: unknown, context?: unknown) => unknown | Promise<unknown>

interface HookEntry {
  handler: HookHandler
  pluginName: string
  priority: number
  id: string
}

interface HookRegisterOptions {
  pluginName?: string
  priority?: number
}

interface PluginHookEntry {
  hookPoint: string
  id: string
}

class HookSystem {
  private hooks: Map<string, HookEntry[]>
  private pluginHooks: Map<string, PluginHookEntry[]>

  constructor() {
    this.hooks = new Map()
    this.pluginHooks = new Map()
  }

  /**
   * Register a hook handler
   */
  register(hookPoint: string, handler: HookHandler, options: HookRegisterOptions = {}): () => void {
    const { pluginName = 'anonymous', priority = 10 } = options

    if (!this.hooks.has(hookPoint)) {
      this.hooks.set(hookPoint, [])
    }

    const hookEntry: HookEntry = {
      handler,
      pluginName,
      priority,
      id: `${pluginName}:${Date.now()}`,
    }

    this.hooks.get(hookPoint)!.push(hookEntry)

    // Sort by priority
    this.hooks.get(hookPoint)!.sort((a, b) => a.priority - b.priority)

    // Track by plugin
    if (!this.pluginHooks.has(pluginName)) {
      this.pluginHooks.set(pluginName, [])
    }
    this.pluginHooks.get(pluginName)!.push({ hookPoint, id: hookEntry.id })

    // Return unregister function
    return () => this.unregister(hookPoint, hookEntry.id)
  }

  /**
   * Unregister a hook handler
   */
  unregister(hookPoint: string, id: string): void {
    const hooks = this.hooks.get(hookPoint)
    if (hooks) {
      const index = hooks.findIndex((h) => h.id === id)
      if (index !== -1) {
        hooks.splice(index, 1)
      }
    }
  }

  /**
   * Unregister all hooks from a plugin
   */
  unregisterPlugin(pluginName: string): void {
    const pluginEntries = this.pluginHooks.get(pluginName)
    if (pluginEntries) {
      for (const entry of pluginEntries) {
        this.unregister(entry.hookPoint, entry.id)
      }
      this.pluginHooks.delete(pluginName)
    }
  }

  /**
   * Execute a "before" hook (can modify data)
   */
  async executeBefore(
    hookPoint: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const hooks = this.hooks.get(hookPoint) || []
    let result = { ...data }

    for (const hook of hooks) {
      try {
        const modified = await hook.handler(result)
        if (modified !== undefined) {
          result = { ...result, ...(modified as Record<string, unknown>) }
        }
      } catch (error) {
        console.error(`Hook error [${hook.pluginName}] at ${hookPoint}:`, getErrorMessage(error))
        // Continue with other hooks
      }
    }

    return result
  }

  /**
   * Execute an "after" hook (side effects only)
   */
  async executeAfter(hookPoint: string, data: Record<string, unknown>): Promise<void> {
    const hooks = this.hooks.get(hookPoint) || []

    // Execute all hooks in parallel for after hooks
    await Promise.allSettled(
      hooks.map(async (hook) => {
        try {
          await hook.handler(data)
        } catch (error) {
          console.error(`Hook error [${hook.pluginName}] at ${hookPoint}:`, getErrorMessage(error))
        }
      })
    )

    // Emit corresponding event for plugins listening via EventBus
    const eventType = this.hookToEvent(hookPoint)
    if (eventType) {
      await eventBus.emit(eventType, data)
    }
  }

  /**
   * Execute a "transform" hook (must return modified value)
   */
  async executeTransform<T>(
    hookPoint: string,
    value: T,
    context: Record<string, unknown> = {}
  ): Promise<T> {
    const hooks = this.hooks.get(hookPoint) || []
    let result = value

    for (const hook of hooks) {
      try {
        const transformed = await hook.handler(result, context)
        if (transformed !== undefined) {
          result = transformed as T
        }
      } catch (error) {
        console.error(
          `Transform hook error [${hook.pluginName}] at ${hookPoint}:`,
          getErrorMessage(error)
        )
        // Keep previous value on error
      }
    }

    return result
  }

  /**
   * Map hook point to event type
   */
  hookToEvent(hookPoint: string): string | null {
    const mapping: Record<string, string> = {
      [HookPoints.AFTER_SESSION_START]: EventTypes.SESSION_STARTED,
      [HookPoints.AFTER_SESSION_COMPLETE]: EventTypes.SESSION_COMPLETED,
      [HookPoints.AFTER_TASK_CREATE]: EventTypes.TASK_CREATED,
      [HookPoints.AFTER_TASK_COMPLETE]: EventTypes.TASK_COMPLETED,
      [HookPoints.AFTER_FEATURE_SHIP]: EventTypes.FEATURE_SHIPPED,
      [HookPoints.AFTER_IDEA_CAPTURE]: EventTypes.IDEA_CAPTURED,
      [HookPoints.AFTER_SNAPSHOT_CREATE]: EventTypes.SNAPSHOT_CREATED,
      [HookPoints.AFTER_SNAPSHOT_RESTORE]: EventTypes.SNAPSHOT_RESTORED,
      [HookPoints.AFTER_COMMIT]: EventTypes.COMMIT_CREATED,
      [HookPoints.AFTER_PUSH]: EventTypes.PUSH_COMPLETED,
      [HookPoints.AFTER_SYNC]: EventTypes.PROJECT_SYNCED,
    }
    return mapping[hookPoint] || null
  }

  /**
   * Get all registered hooks for a point
   */
  getHooks(hookPoint: string): Array<{ pluginName: string; priority: number }> {
    return (this.hooks.get(hookPoint) || []).map((h) => ({
      pluginName: h.pluginName,
      priority: h.priority,
    }))
  }

  /**
   * Get all hooks registered by a plugin
   */
  getPluginHooks(pluginName: string): string[] {
    const entries = this.pluginHooks.get(pluginName) || []
    return entries.map((e) => e.hookPoint)
  }

  /**
   * Check if a hook point has any handlers
   */
  hasHooks(hookPoint: string): boolean {
    const hooks = this.hooks.get(hookPoint)
    return hooks !== undefined && hooks.length > 0
  }

  /**
   * Clear all hooks
   */
  clear(): void {
    this.hooks.clear()
    this.pluginHooks.clear()
  }
}

// Singleton instance
const hookSystem = new HookSystem()

// Convenience wrapper for common hook patterns
const hooks = {
  /**
   * Register a before hook
   */
  before: (point: string, handler: HookHandler, options?: HookRegisterOptions) => {
    const hookPoint = `before:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Register an after hook
   */
  after: (point: string, handler: HookHandler, options?: HookRegisterOptions) => {
    const hookPoint = `after:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Register a transform hook
   */
  transform: (point: string, handler: HookHandler, options?: HookRegisterOptions) => {
    const hookPoint = `transform:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Execute before hooks
   */
  runBefore: (point: string, data: Record<string, unknown>) => {
    return hookSystem.executeBefore(`before:${point}`, data)
  },

  /**
   * Execute after hooks
   */
  runAfter: (point: string, data: Record<string, unknown>) => {
    return hookSystem.executeAfter(`after:${point}`, data)
  },

  /**
   * Execute transform hooks
   */
  runTransform: <T>(point: string, value: T, context?: Record<string, unknown>) => {
    return hookSystem.executeTransform(`transform:${point}`, value, context)
  },
}

export { HookSystem, HookPoints, hookSystem, hooks }
