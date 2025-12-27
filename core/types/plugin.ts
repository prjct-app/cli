/**
 * Plugin Types
 * Types for the plugin system.
 */

// =============================================================================
// Webhook Plugin Types
// =============================================================================

export interface WebhookConfig {
  url?: string
  events?: string[]
  secret?: string
}

export interface WebhookPluginContext {
  config: WebhookConfig
}

export interface WebhookPayload {
  event: string
  timestamp: string
  source: string
  data: unknown
}
