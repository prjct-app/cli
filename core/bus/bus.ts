/**
 * EventBus - Lightweight Pub/Sub System for prjct-cli
 *
 * Simple event bus for decoupled communication between components.
 * Supports sync/async listeners, wildcards, and one-time subscriptions.
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import pathManager from '../infrastructure/path-manager'
import { EventTypes, type EventData, type EventCallback } from './bus.types'

class EventBus {
  private listeners: Map<string, Set<EventCallback>>
  private onceListeners: Map<string, Set<EventCallback>>
  private history: EventData[]
  private historyLimit: number
  projectId: string | null

  constructor() {
    this.listeners = new Map()
    this.onceListeners = new Map()
    this.history = []
    this.historyLimit = 100
    this.projectId = null
  }

  /**
   * Initialize event bus for a project
   */
  async initialize(projectId: string): Promise<void> {
    this.projectId = projectId
  }

  /**
   * Subscribe to an event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Return unsubscribe function
    return () => this.off(event, callback)
  }

  /**
   * Subscribe to an event once
   */
  once(event: string, callback: EventCallback): () => void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set())
    }
    this.onceListeners.get(event)!.add(callback)

    return () => {
      const listeners = this.onceListeners.get(event)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  /**
   * Unsubscribe from an event
   */
  off(event: string, callback: EventCallback): void {
    const listeners = this.listeners.get(event)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event
   */
  async emit(event: string, data: Record<string, unknown> = {}): Promise<void> {
    const timestamp = new Date().toISOString()
    const eventData: EventData = {
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
    results.forEach((result) => {
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
   */
  getMatchingListeners(event: string): EventCallback[] {
    const callbacks: EventCallback[] = []

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
   */
  async executeCallback(callback: EventCallback, data: EventData): Promise<void> {
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
   */
  async logEvent(eventData: EventData): Promise<void> {
    try {
      const globalPath = pathManager.getGlobalProjectPath(this.projectId!)
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
   */
  getHistory(limit: number = 10, type: string | null = null): EventData[] {
    let events = this.history
    if (type) {
      events = events.filter(e => e.type === type || e.type.startsWith(type))
    }
    return events.slice(-limit)
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear()
    this.onceListeners.clear()
  }

  /**
   * Get count of listeners for an event
   */
  listenerCount(event: string): number {
    const listeners = this.listeners.get(event)
    return listeners ? listeners.size : 0
  }

  /**
   * Get all registered event types
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.listeners.keys())
  }
}

// Singleton instance
const eventBus = new EventBus()

// Convenience methods for common events
const emit = {
  sessionStarted: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SESSION_STARTED, data),
  sessionPaused: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SESSION_PAUSED, data),
  sessionResumed: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SESSION_RESUMED, data),
  sessionCompleted: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SESSION_COMPLETED, data),

  taskCreated: (data: Record<string, unknown>) => eventBus.emit(EventTypes.TASK_CREATED, data),
  taskCompleted: (data: Record<string, unknown>) => eventBus.emit(EventTypes.TASK_COMPLETED, data),

  featureAdded: (data: Record<string, unknown>) => eventBus.emit(EventTypes.FEATURE_ADDED, data),
  featureShipped: (data: Record<string, unknown>) => eventBus.emit(EventTypes.FEATURE_SHIPPED, data),

  ideaCaptured: (data: Record<string, unknown>) => eventBus.emit(EventTypes.IDEA_CAPTURED, data),

  snapshotCreated: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SNAPSHOT_CREATED, data),
  snapshotRestored: (data: Record<string, unknown>) => eventBus.emit(EventTypes.SNAPSHOT_RESTORED, data),

  commitCreated: (data: Record<string, unknown>) => eventBus.emit(EventTypes.COMMIT_CREATED, data),
  pushCompleted: (data: Record<string, unknown>) => eventBus.emit(EventTypes.PUSH_COMPLETED, data),

  projectInitialized: (data: Record<string, unknown>) => eventBus.emit(EventTypes.PROJECT_INITIALIZED, data),
  projectSynced: (data: Record<string, unknown>) => eventBus.emit(EventTypes.PROJECT_SYNCED, data),
  analysisCompleted: (data: Record<string, unknown>) => eventBus.emit(EventTypes.ANALYSIS_COMPLETED, data)
}

export { EventBus, eventBus, emit }
export default { EventBus, EventTypes, eventBus, emit }

