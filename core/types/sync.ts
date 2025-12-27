/**
 * Sync Types
 * Types for sync and cloud modules.
 */

// =============================================================================
// OAuth Types
// =============================================================================

/**
 * Result of an authentication attempt
 */
export interface AuthResult {
  success: boolean
  email?: string
  error?: string
}

/**
 * Authentication configuration stored in ~/.prjct-cli/config/auth.json
 */
export interface AuthConfig {
  apiKey: string | null
  apiUrl: string
  userId: string | null
  email: string | null
  lastAuth: string | null
}

// =============================================================================
// Sync Manager Types
// =============================================================================

/**
 * Result of a full sync operation (push + pull)
 */
export interface SyncManagerResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'no_pending' | 'error'
  pushed?: {
    count: number
    syncedAt: string
  }
  pulled?: {
    count: number
    syncedAt: string
  }
  error?: string
}

/**
 * Result of pushing events to the server
 */
export interface PushResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'no_pending' | 'error'
  count?: number
  syncedAt?: string
  error?: string
}

/**
 * Result of pulling events from the server
 */
export interface PullResult {
  success: boolean
  skipped: boolean
  reason?: 'no_auth' | 'error'
  count?: number
  applied?: number
  syncedAt?: string
  error?: string
}

// =============================================================================
// Sync Client Types
// =============================================================================

/**
 * Result of batch push to API
 */
export interface SyncBatchResult {
  success: boolean
  processed: number
  errors: Array<{ index: number; error: string }>
  syncedAt: string
}

/**
 * Result of pull from API
 */
export interface SyncPullResult {
  events: Array<{
    type: string
    path: string[]
    data: unknown
    timestamp: string
  }>
  syncedAt: string
}

/**
 * Project sync status from API
 */
export interface SyncStatus {
  projectId: string
  lastSync: string | null
  pendingCount: number
  hasConflicts: boolean
}

/**
 * Error from sync client
 */
export interface SyncClientError {
  code: 'AUTH_REQUIRED' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN'
  message: string
  status?: number
}
