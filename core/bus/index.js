/**
 * EventBus - Lightweight Pub/Sub System for prjct-cli
 *
 * Simple event bus for decoupled communication between components.
 * Supports sync/async listeners, wildcards, and one-time subscriptions.
 *
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const pathManager = require('../infrastructure/path-manager')

/**
 * Event Types - All events that can be emitted
 */
const EventTypes = {
  // Session events
  SESSION_STARTED: 'session.started',
  SESSION_PAUSED: 'session.paused',
  SESSION_RESUMED: 'session.resumed',
  SESSION_COMPLETED: 'session.completed',

  // Task events
  TASK_CREATED: 'task.created',
  TASK_COMPLETED: 'task.completed',
  TASK_UPDATED: 'task.updated',

  // Feature events
  FEATURE_ADDED: 'feature.added',
  FEATURE_SHIPPED: 'feature.shipped',
  FEATURE_UPDATED: 'feature.updated',

  // Idea events
  IDEA_CAPTURED: 'idea.captured',
  IDEA_PROMOTED: 'idea.promoted',

  // Snapshot events
  SNAPSHOT_CREATED: 'snapshot.created',
  SNAPSHOT_RESTORED: 'snapshot.restored',

  // Git events
  COMMIT_CREATED: 'git.commit',
  PUSH_COMPLETED: 'git.push',

  // System events
  PROJECT_INITIALIZED: 'project.init',
  PROJECT_SYNCED: 'project.sync',
  ANALYSIS_COMPLETED: 'analysis.completed',

  // Wildcard
  ALL: '*'
}

class EventBus {
  constructor() {
    this.listeners = new Map()
    this.onceListeners = new Map()
    this.history = []
    this.historyLimit = 100
    this.projectId = null
  }

  /**
   * Initialize event bus for a project
   * @param {string} projectId
   */
  async initialize(projectId) {
    this.projectId = projectId
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event type or wildcard pattern
   * @param {Function} callback - Handler function
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Subscribe to an event once
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  once(event, callback) {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set())
    }
    this.onceListeners.get(event).add(callback)

    return () => {
      const listeners = this.onceListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  /**
   * Unsubscribe from an event
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event type
   * @param {Object} data - Event payload
   * @returns {Promise<void>}
   */
  async emit(event, data = {}) {
    const timestamp = new Date().toISOString()
    const eventData = {
      type: event,
      timestamp,
      projectId: this.projectId,
      ...data
    }

    // Store in history
    this.history.push(eventData)
    if (this.history.length > this.historyLimit) {
      this.history.shift()
    }

    // Log event if project initialized
    if (this.projectId) {
      await this.logEvent(eventData)
    }

    // Get all matching listeners
    const callbacks = this.getMatchingListeners(event)

    // Execute all callbacks
    const results = await Promise.allSettled(
      callbacks.map(cb => this.executeCallback(cb, eventData))
    )

    // Log any errors
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Event listener error for ${event}:`, result.reason)
      }
    })

    // Handle once listeners
    const onceCallbacks = this.onceListeners.get(event)
    if (onceCallbacks) {
      for (const cb of onceCallbacks) {
        await this.executeCallback(cb, eventData)
      }
      this.onceListeners.delete(event)
    }

    // Also trigger wildcard once listeners
    const wildcardOnce = this.onceListeners.get(EventTypes.ALL)
    if (wildcardOnce) {
      for (const cb of wildcardOnce) {
        await this.executeCallback(cb, eventData)
      }
      // Don't delete wildcard once - only for specific events
    }
  }

  /**
   * Get all listeners that match an event (including wildcards)
   * @param {string} event
   * @returns {Function[]}
   */
  getMatchingListeners(event) {
    const callbacks = []

    // Exact match
    const exact = this.listeners.get(event)
    if (exact) {
      callbacks.push(...exact)
    }

    // Wildcard match (*)
    const wildcard = this.listeners.get(EventTypes.ALL)
    if (wildcard) {
      callbacks.push(...wildcard)
    }

    // Namespace wildcard (e.g., 'session.*' matches 'session.started')
    const namespace = event.split('.')[0]
    const namespaceWildcard = this.listeners.get(`${namespace}.*`)
    if (namespaceWildcard) {
      callbacks.push(...namespaceWildcard)
    }

    return callbacks
  }

  /**
   * Execute a callback safely (handles sync and async)
   * @param {Function} callback
   * @param {Object} data
   */
  async executeCallback(callback, data) {
    try {
      const result = callback(data)
      if (result instanceof Promise) {
        await result
      }
    } catch (error) {
      console.error('Event callback error:', error)
      throw error
    }
  }

  /**
   * Log event to persistent storage
   * @param {Object} eventData
   */
  async logEvent(eventData) {
    try {
      const globalPath = pathManager.getGlobalProjectPath(this.projectId)
      const eventsPath = path.join(globalPath, 'memory', 'events.jsonl')

      // Ensure directory exists
      await fs.mkdir(path.dirname(eventsPath), { recursive: true })

      // Append event
      const line = JSON.stringify(eventData) + '\n'
      await fs.appendFile(eventsPath, line)
    } catch {
      // Silently fail - logging should not break functionality
    }
  }

  /**
   * Get recent events from history
   * @param {number} limit
   * @param {string} [type] - Optional filter by event type
   * @returns {Object[]}
   */
  getHistory(limit = 10, type = null) {
    let events = this.history
    if (type) {
      events = events.filter(e => e.type === type || e.type.startsWith(type))
    }
    return events.slice(-limit)
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.listeners.clear()
    this.onceListeners.clear()
  }

  /**
   * Get count of listeners for an event
   * @param {string} event
   * @returns {number}
   */
  listenerCount(event) {
    const listeners = this.listeners.get(event)
    return listeners ? listeners.size : 0
  }

  /**
   * Get all registered event types
   * @returns {string[]}
   */
  getRegisteredEvents() {
    return Array.from(this.listeners.keys())
  }
}

// Singleton instance
const eventBus = new EventBus()

// Convenience methods for common events
const emit = {
  sessionStarted: (data) => eventBus.emit(EventTypes.SESSION_STARTED, data),
  sessionPaused: (data) => eventBus.emit(EventTypes.SESSION_PAUSED, data),
  sessionResumed: (data) => eventBus.emit(EventTypes.SESSION_RESUMED, data),
  sessionCompleted: (data) => eventBus.emit(EventTypes.SESSION_COMPLETED, data),

  taskCreated: (data) => eventBus.emit(EventTypes.TASK_CREATED, data),
  taskCompleted: (data) => eventBus.emit(EventTypes.TASK_COMPLETED, data),

  featureAdded: (data) => eventBus.emit(EventTypes.FEATURE_ADDED, data),
  featureShipped: (data) => eventBus.emit(EventTypes.FEATURE_SHIPPED, data),

  ideaCaptured: (data) => eventBus.emit(EventTypes.IDEA_CAPTURED, data),

  snapshotCreated: (data) => eventBus.emit(EventTypes.SNAPSHOT_CREATED, data),
  snapshotRestored: (data) => eventBus.emit(EventTypes.SNAPSHOT_RESTORED, data),

  commitCreated: (data) => eventBus.emit(EventTypes.COMMIT_CREATED, data),
  pushCompleted: (data) => eventBus.emit(EventTypes.PUSH_COMPLETED, data),

  projectInitialized: (data) => eventBus.emit(EventTypes.PROJECT_INITIALIZED, data),
  projectSynced: (data) => eventBus.emit(EventTypes.PROJECT_SYNCED, data),
  analysisCompleted: (data) => eventBus.emit(EventTypes.ANALYSIS_COMPLETED, data)
}

module.exports = {
  EventBus,
  EventTypes,
  eventBus,
  emit
}
