/**
 * HookSystem - Plugin Lifecycle Hooks for prjct-cli
 *
 * Provides hook points for plugins to extend prjct functionality.
 * Hooks can modify data, add side effects, or integrate with external services.
 *
 * @version 1.0.0
 */

const { eventBus, EventTypes } = require('../bus')

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
  TRANSFORM_METRICS: 'transform:metrics'
}

class HookSystem {
  constructor() {
    this.hooks = new Map()
    this.pluginHooks = new Map() // Track hooks by plugin
  }

  /**
   * Register a hook handler
   * @param {string} hookPoint - Hook point from HookPoints
   * @param {Function} handler - Handler function
   * @param {Object} options
   * @param {string} options.pluginName - Name of the plugin
   * @param {number} options.priority - Execution order (lower = first)
   * @returns {Function} Unregister function
   */
  register(hookPoint, handler, options = {}) {
    const { pluginName = 'anonymous', priority = 10 } = options

    if (!this.hooks.has(hookPoint)) {
      this.hooks.set(hookPoint, [])
    }

    const hookEntry = {
      handler,
      pluginName,
      priority,
      id: `${pluginName}:${Date.now()}`
    }

    this.hooks.get(hookPoint).push(hookEntry)

    // Sort by priority
    this.hooks.get(hookPoint).sort((a, b) => a.priority - b.priority)

    // Track by plugin
    if (!this.pluginHooks.has(pluginName)) {
      this.pluginHooks.set(pluginName, [])
    }
    this.pluginHooks.get(pluginName).push({ hookPoint, id: hookEntry.id })

    // Return unregister function
    return () => this.unregister(hookPoint, hookEntry.id)
  }

  /**
   * Unregister a hook handler
   * @param {string} hookPoint
   * @param {string} id
   */
  unregister(hookPoint, id) {
    const hooks = this.hooks.get(hookPoint)
    if (hooks) {
      const index = hooks.findIndex(h => h.id === id)
      if (index !== -1) {
        hooks.splice(index, 1)
      }
    }
  }

  /**
   * Unregister all hooks from a plugin
   * @param {string} pluginName
   */
  unregisterPlugin(pluginName) {
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
   * @param {string} hookPoint
   * @param {Object} data - Data that can be modified
   * @returns {Promise<Object>} Modified data
   */
  async executeBefore(hookPoint, data) {
    const hooks = this.hooks.get(hookPoint) || []
    let result = { ...data }

    for (const hook of hooks) {
      try {
        const modified = await hook.handler(result)
        if (modified !== undefined) {
          result = { ...result, ...modified }
        }
      } catch (error) {
        console.error(`Hook error [${hook.pluginName}] at ${hookPoint}:`, error.message)
        // Continue with other hooks
      }
    }

    return result
  }

  /**
   * Execute an "after" hook (side effects only)
   * @param {string} hookPoint
   * @param {Object} data - Read-only data
   * @returns {Promise<void>}
   */
  async executeAfter(hookPoint, data) {
    const hooks = this.hooks.get(hookPoint) || []

    // Execute all hooks in parallel for after hooks
    await Promise.allSettled(
      hooks.map(async hook => {
        try {
          await hook.handler(data)
        } catch (error) {
          console.error(`Hook error [${hook.pluginName}] at ${hookPoint}:`, error.message)
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
   * @param {string} hookPoint
   * @param {*} value - Value to transform
   * @param {Object} context - Additional context
   * @returns {Promise<*>} Transformed value
   */
  async executeTransform(hookPoint, value, context = {}) {
    const hooks = this.hooks.get(hookPoint) || []
    let result = value

    for (const hook of hooks) {
      try {
        const transformed = await hook.handler(result, context)
        if (transformed !== undefined) {
          result = transformed
        }
      } catch (error) {
        console.error(`Transform hook error [${hook.pluginName}] at ${hookPoint}:`, error.message)
        // Keep previous value on error
      }
    }

    return result
  }

  /**
   * Map hook point to event type
   * @param {string} hookPoint
   * @returns {string|null}
   */
  hookToEvent(hookPoint) {
    const mapping = {
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
      [HookPoints.AFTER_SYNC]: EventTypes.PROJECT_SYNCED
    }
    return mapping[hookPoint] || null
  }

  /**
   * Get all registered hooks for a point
   * @param {string} hookPoint
   * @returns {Object[]}
   */
  getHooks(hookPoint) {
    return (this.hooks.get(hookPoint) || []).map(h => ({
      pluginName: h.pluginName,
      priority: h.priority
    }))
  }

  /**
   * Get all hooks registered by a plugin
   * @param {string} pluginName
   * @returns {string[]} Hook points
   */
  getPluginHooks(pluginName) {
    const entries = this.pluginHooks.get(pluginName) || []
    return entries.map(e => e.hookPoint)
  }

  /**
   * Check if a hook point has any handlers
   * @param {string} hookPoint
   * @returns {boolean}
   */
  hasHooks(hookPoint) {
    const hooks = this.hooks.get(hookPoint)
    return hooks && hooks.length > 0
  }

  /**
   * Clear all hooks
   */
  clear() {
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
  before: (point, handler, options) => {
    const hookPoint = `before:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Register an after hook
   */
  after: (point, handler, options) => {
    const hookPoint = `after:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Register a transform hook
   */
  transform: (point, handler, options) => {
    const hookPoint = `transform:${point}`
    return hookSystem.register(hookPoint, handler, options)
  },

  /**
   * Execute before hooks
   */
  runBefore: (point, data) => {
    return hookSystem.executeBefore(`before:${point}`, data)
  },

  /**
   * Execute after hooks
   */
  runAfter: (point, data) => {
    return hookSystem.executeAfter(`after:${point}`, data)
  },

  /**
   * Execute transform hooks
   */
  runTransform: (point, value, context) => {
    return hookSystem.executeTransform(`transform:${point}`, value, context)
  }
}

module.exports = {
  HookSystem,
  HookPoints,
  hookSystem,
  hooks
}
