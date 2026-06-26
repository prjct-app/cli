/**
 * Sync Types
 * Types for sync and cloud modules.
 */

// OAuth Types

/**
 * Result of an authentication attempt
 */
export interface AuthResult {
  success: boolean
  email?: string
  error?: string
}

/**
 * Authentication metadata stored in ~/.prjct-cli/config/auth.json.
 * The Cloud API token is loaded from the OS credential store and exposed
 * in-memory as apiKey for callers.
 *
 * `deviceId` (Phase 1.5 / B6) is generated as a UUID v4 the first
 * time auth.json is read on a 1.5+ binary. Persisted on first write;
 * non-breaking on pre-1.5 auth.json files (we synthesize it on read
 * and lazily write it back on the next save).
 */
export interface AuthConfig {
  apiKey: string | null
  apiUrl: string
  userId: string | null
  email: string | null
  lastAuth: string | null
  /** UUIDv4. Identifies the device emitting events for sync. */
  deviceId?: string
  /** Hostname captured at first auth — surfaced in account UI. */
  hostname?: string
}

// Sync Manager Types

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
  /** Classified failure code (e.g. PAYMENT_REQUIRED) for tailored messaging. */
  code?: SyncErrorCode
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
  code?: SyncErrorCode
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
  code?: SyncErrorCode
}

// Sync Client Types

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

export interface SyncLinkResult {
  projectId: string
  syncStatus: 'active' | 'payment_required' | 'payment_pending'
  billingState: 'free' | 'pending' | 'active' | 'past_due' | 'lifetime' | 'canceled'
  billingInterval?: 'monthly' | 'annual' | 'lifetime' | null
  billingUrl: string
  message: string
}

/**
 * Product benchmark payload sent to the prjct cloud API.
 *
 * The CLI keeps local eval artifacts under PRJCT_CLI_HOME, but the shared
 * benchmark history belongs in the cloud product, not in GitHub branches.
 */
export interface BenchmarkPublishPayload {
  schemaVersion: 1
  artifactType: 'run' | 'comparison'
  artifactId: string
  repo: string
  createdAt: string
  run?: unknown
  comparison?: unknown
  reportMarkdown: string
}

/**
 * Server response for benchmark publication. The API may add fields over time;
 * callers should only depend on these stable fields.
 */
export interface BenchmarkPublishResult {
  success?: boolean
  benchmarkId?: string
  url?: string
  publishedAt?: string
}

/** Classified sync failure. PAYMENT_REQUIRED = the server's 402 paid gate. */
export type SyncErrorCode =
  | 'AUTH_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'UNKNOWN'

/**
 * Error from sync client
 */
export interface SyncClientError {
  code: SyncErrorCode
  message: string
  status?: number
}
