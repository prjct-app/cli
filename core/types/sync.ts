/**
 * Sync Types
 * Types for sync and cloud modules.
 */

// =============================================================================
// OAuth Types
// =============================================================================

export interface AuthResult {
  success: boolean
  accessToken?: string
  refreshToken?: string
  expiresAt?: string
  error?: string
}

export interface AuthConfig {
  clientId: string
  redirectUri: string
  scopes: string[]
  authEndpoint: string
  tokenEndpoint: string
}

// =============================================================================
// Sync Manager Types
// =============================================================================

export interface SyncManagerResult {
  success: boolean
  eventsProcessed: number
  errors: string[]
  timestamp: string
}

export interface PushResult {
  success: boolean
  eventsPushed: number
  failedEvents: string[]
  timestamp: string
}

export interface PullResult {
  success: boolean
  eventsPulled: number
  appliedChanges: number
  conflicts: string[]
  timestamp: string
}

// =============================================================================
// Sync Client Types
// =============================================================================

export interface SyncBatchResult {
  success: boolean
  processed: number
  failed: number
}

export interface SyncPullResult {
  success: boolean
  events: unknown[]
  cursor?: string
  hasMore: boolean
}

export interface SyncStatus {
  connected: boolean
  lastSync?: string
  pendingEvents: number
}

export interface SyncClientError {
  code: string
  message: string
  retryable: boolean
}
