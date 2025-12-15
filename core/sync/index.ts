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
export { authConfig, type AuthConfig } from './auth-config'

// OAuth
export { oauthHandler, type AuthResult } from './oauth-handler'

// Client
export {
  syncClient,
  type SyncBatchResult,
  type SyncPullResult,
  type SyncStatus,
  type SyncClientError,
} from './sync-client'

// Manager
export { syncManager, type SyncResult, type PushResult, type PullResult } from './sync-manager'

// Default export is the main sync manager
export { syncManager as default } from './sync-manager'
