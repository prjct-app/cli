/**
 * Sync Module - Cloud synchronization for prjct-cli
 *
 * Provides:
 * - AuthConfig: API key storage and management
 * - SyncClient: HTTP client for prjct API
 * - SyncManager: Orchestrates push/pull operations
 * - OAuthHandler: Authentication flow management
 */

// Re-export types from canonical location
export type {
  AuthConfig,
  AuthResult,
  PullResult,
  PushResult,
  SyncBatchResult,
  SyncClientError,
  SyncManagerResult as SyncResult,
  SyncPullResult,
  SyncStatus,
} from '../types'
// Auth
export { authConfig } from './auth-config'
// OAuth
export { oauthHandler } from './oauth-handler'
// Client
export { syncClient } from './sync-client'
// Manager
// Default export is the main sync manager
export { syncManager, syncManager as default } from './sync-manager'
