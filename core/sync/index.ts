/**
 * Sync Module - Cloud synchronization for prjct-cli
 *
 * Provides:
 * - AuthConfig: API key storage and management
 * - SyncClient: HTTP client for prjct API
 * - SyncManager: Orchestrates push/pull operations
 * - OAuthHandler: Authentication flow management
 */

// Auth
export { authConfig } from './auth-config'

// OAuth
export { oauthHandler } from './oauth-handler'

// Client
export { syncClient } from './sync-client'

// Manager
export { syncManager } from './sync-manager'

// Default export is the main sync manager
export { syncManager as default } from './sync-manager'

// Re-export types from canonical location
export type {
  AuthConfig,
  AuthResult,
  SyncBatchResult,
  SyncPullResult,
  SyncStatus,
  SyncClientError,
  SyncManagerResult as SyncResult,
  PushResult,
  PullResult,
} from '../types'
