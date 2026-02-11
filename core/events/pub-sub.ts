/**
 * EventBus - Lightweight Pub/Sub System for prjct-cli
 *
 * Simple event bus for decoupled communication between components.
 * Supports sync/async listeners, wildcards, and one-time subscriptions.
 *
 * @version 1.0.0
 */

import { getErrorMessage } from '../errors'
import { prjctDb } from '../storage/database'
import {
  type AnalysisCompletedPayload,
  type EventCallback,
  type EventData,
  type EventMap,
  EventTypes,
  type FeaturePayload,
  type GitCommitPayload,
  type GitPushPayload,
  type IdeaCapturedPayload,
  type ProjectInitializedPayload,
  type ProjectSyncedPayload,
  type SessionCompletedPayload,
  type SessionPausedPayload,
  type SessionResumedPayload,
  type SessionStartedPayload,
  type SnapshotCreatedPayload,
  type SnapshotRestoredPayload,
  type TaskCompletedPayload,
  type TaskCreatedPayload,
} from '../types'
import { EVENT_LIMITS } from '../utils/constants'
import log from '../utils/logger'

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
    this.historyLimit = EVENT_LIMITS.HISTORY_MAX
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
   * Emit an event with typed payload
   */
  async emit<K extends keyof EventMap>(event: K, data: EventMap[K]): Promise<void>
  async emit(event: string, data: Record<string, unknown>): Promise<void>
  async emit(event: string, data: Record<string, unknown> = {}): Promise<void> {
    const timestamp = new Date().toISOString()
    const eventData: EventData = {
      type: event,
      timestamp,
      projectId: this.projectId,
      ...data,
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
      callbacks.map((cb) => this.executeCallback(cb, eventData))
    )

    // Log any errors
    results.forEach((result) => {
      if (result.status === 'rejected') {
        log.error(`Event listener error for ${event}:`, result.reason)
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
      log.error('Event callback error:', error)
      throw error
    }
  }

  /**
   * Log event to persistent storage
   */
  async logEvent(eventData: EventData): Promise<void> {
    try {
      prjctDb.appendEvent(this.projectId!, eventData.type, eventData as Record<string, unknown>)
    } catch (error) {
      log.debug('Failed to log event:', getErrorMessage(error))
    }
  }

  /**
   * Get recent events from history
   */
  getHistory(limit: number = 10, type: string | null = null): EventData[] {
    let events = this.history
    if (type) {
      events = events.filter((e) => e.type === type || e.type.startsWith(type))
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
   * Flush event history and clean up stale once-listeners.
   * Call on task completion, project switch, or periodically.
   */
  flush(): void {
    this.history = []

    // Remove once-listeners for events that were never fired
    this.onceListeners.clear()
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event)
      this.onceListeners.delete(event)
    } else {
      this.listeners.clear()
      this.onceListeners.clear()
    }
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

// Convenience methods for common events (typed payloads)
const emit = {
  sessionStarted: (data: SessionStartedPayload) => eventBus.emit(EventTypes.SESSION_STARTED, data),
  sessionPaused: (data: SessionPausedPayload) => eventBus.emit(EventTypes.SESSION_PAUSED, data),
  sessionResumed: (data: SessionResumedPayload) => eventBus.emit(EventTypes.SESSION_RESUMED, data),
  sessionCompleted: (data: SessionCompletedPayload) =>
    eventBus.emit(EventTypes.SESSION_COMPLETED, data),

  taskCreated: (data: TaskCreatedPayload) => eventBus.emit(EventTypes.TASK_CREATED, data),
  taskCompleted: (data: TaskCompletedPayload) => eventBus.emit(EventTypes.TASK_COMPLETED, data),

  featureAdded: (data: FeaturePayload) => eventBus.emit(EventTypes.FEATURE_ADDED, data),
  featureShipped: (data: FeaturePayload) => eventBus.emit(EventTypes.FEATURE_SHIPPED, data),

  ideaCaptured: (data: IdeaCapturedPayload) => eventBus.emit(EventTypes.IDEA_CAPTURED, data),

  snapshotCreated: (data: SnapshotCreatedPayload) =>
    eventBus.emit(EventTypes.SNAPSHOT_CREATED, data),
  snapshotRestored: (data: SnapshotRestoredPayload) =>
    eventBus.emit(EventTypes.SNAPSHOT_RESTORED, data),

  commitCreated: (data: GitCommitPayload) => eventBus.emit(EventTypes.COMMIT_CREATED, data),
  pushCompleted: (data: GitPushPayload) => eventBus.emit(EventTypes.PUSH_COMPLETED, data),

  projectInitialized: (data: ProjectInitializedPayload) =>
    eventBus.emit(EventTypes.PROJECT_INITIALIZED, data),
  projectSynced: (data: ProjectSyncedPayload) => eventBus.emit(EventTypes.PROJECT_SYNCED, data),
  analysisCompleted: (data: AnalysisCompletedPayload) =>
    eventBus.emit(EventTypes.ANALYSIS_COMPLETED, data),
}

export { EventBus, eventBus, emit }
