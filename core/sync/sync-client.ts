/**
 * Sync Client - HTTP client for prjct API
 *
 * Handles communication with the backend API for push/pull operations.
 * Uses native fetch API (available in Node 18+ and Bun).
 *
 * PRJ-111: Includes configurable timeout support via AbortController.
 */

import type { SyncEvent } from '../types/events'
import type { SyncBatchResult, SyncClientError, SyncPullResult, SyncStatus } from '../types/sync'
import { getTimeout } from '../utils/constants'
import authConfig from './auth-config'
import { mapCliEventsToWebFormat } from './event-mapper'

// ============================================
// Sync Client
// ============================================

class SyncClient {
  private retryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
  }

  /**
   * Push local events to the server
   */
  async pushEvents(projectId: string, events: SyncEvent[]): Promise<SyncBatchResult> {
    const { apiUrl, apiKey } = await this.getAuthHeaders()

    if (!apiKey) {
      throw this.createError('AUTH_REQUIRED', 'No API key configured')
    }

    // Transform CLI events to web format before sending
    const webEvents = mapCliEventsToWebFormat(projectId, events)

    const response = await this.fetchWithRetry(`${apiUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        projectId,
        events: webEvents,
      }),
    })

    if (!response.ok) {
      const error = await this.parseErrorResponse(response)
      throw error
    }

    return (await response.json()) as SyncBatchResult
  }

  /**
   * Pull events from the server.
   *
   * Phase 1.6 / B4: cli sends only `sinceEventId` (server-assigned
   * monotonic id). The legacy `since` (timestamp) is no longer sent —
   * prjct-cloud is pre-MVP and no pre-1.5 servers exist in production
   * that would need the timestamp fallback. Removing it eliminates a
   * parallel cursor that could disagree with the event_id under
   * rebase / partial pulls.
   *
   * The `sinceTimestamp` parameter is retained on the signature but
   * unused; internal callers stay source-compatible. Drop the
   * parameter in a future major bump.
   */
  async pullEvents(
    projectId: string,
    sinceEventId?: number,
    _sinceTimestamp?: string
  ): Promise<SyncPullResult> {
    const { apiUrl, apiKey } = await this.getAuthHeaders()

    if (!apiKey) {
      throw this.createError('AUTH_REQUIRED', 'No API key configured')
    }

    const body: Record<string, unknown> = { projectId }
    if (typeof sinceEventId === 'number' && sinceEventId > 0) {
      body.sinceEventId = sinceEventId
    }

    const response = await this.fetchWithRetry(`${apiUrl}/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await this.parseErrorResponse(response)
      throw error
    }

    return (await response.json()) as SyncPullResult
  }

  /**
   * Get sync status for a project
   */
  async getStatus(projectId: string): Promise<SyncStatus> {
    const { apiUrl, apiKey } = await this.getAuthHeaders()

    if (!apiKey) {
      throw this.createError('AUTH_REQUIRED', 'No API key configured')
    }

    const response = await this.fetchWithRetry(`${apiUrl}/sync/status/${projectId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      const error = await this.parseErrorResponse(response)
      throw error
    }

    return (await response.json()) as SyncStatus
  }

  /**
   * Test connection to the API
   */
  async testConnection(): Promise<boolean> {
    // PRJ-111: Add timeout to connection test
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), getTimeout('API_REQUEST'))

    try {
      const { apiUrl, apiKey } = await this.getAuthHeaders()

      if (!apiKey) {
        clearTimeout(timeoutId)
        return false
      }

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch (_error) {
      // Network error, timeout, or other issue - expected
      clearTimeout(timeoutId)
      return false
    }
  }

  /**
   * Check if we have valid authentication
   */
  async hasAuth(): Promise<boolean> {
    return await authConfig.hasAuth()
  }

  // ============================================
  // Private helpers
  // ============================================

  private async getAuthHeaders(): Promise<{ apiUrl: string; apiKey: string | null }> {
    const [apiUrl, apiKey] = await Promise.all([authConfig.getApiUrl(), authConfig.getApiKey()])
    return { apiUrl, apiKey }
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retryCount = 0
  ): Promise<Response> {
    // PRJ-111: Add AbortController-based timeout (default: 30s, configurable via PRJCT_TIMEOUT_API_REQUEST)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), getTimeout('API_REQUEST'))

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500 && retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * 2 ** retryCount,
          this.retryConfig.maxDelayMs
        )
        await this.sleep(delay)
        return this.fetchWithRetry(url, options, retryCount + 1)
      }

      return response
    } catch (error) {
      clearTimeout(timeoutId)

      // Check if this is a timeout (AbortError)
      if (error instanceof Error && error.name === 'AbortError') {
        throw this.createError(
          'NETWORK_ERROR',
          `Request timed out. Try increasing PRJCT_TIMEOUT_API_REQUEST (current: ${getTimeout('API_REQUEST')}ms)`
        )
      }

      // Retry on network errors
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * 2 ** retryCount,
          this.retryConfig.maxDelayMs
        )
        await this.sleep(delay)
        return this.fetchWithRetry(url, options, retryCount + 1)
      }

      throw this.createError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed'
      )
    }
  }

  private async parseErrorResponse(response: Response): Promise<SyncClientError> {
    try {
      const body = (await response.json()) as { message?: string; error?: string }
      const message = body.message || body.error || `HTTP ${response.status}`

      if (response.status === 401 || response.status === 403) {
        return this.createError('AUTH_REQUIRED', message, response.status)
      }

      return this.createError('API_ERROR', message, response.status)
    } catch (_error) {
      // JSON parse error - use generic message (expected for non-JSON responses)
      return this.createError('API_ERROR', `HTTP ${response.status}`, response.status)
    }
  }

  private createError(
    code: SyncClientError['code'],
    message: string,
    status?: number
  ): SyncClientError {
    return { code, message, status }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const syncClient = new SyncClient()
export default syncClient
