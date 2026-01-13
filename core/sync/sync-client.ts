/**
 * Sync Client - HTTP client for prjct API
 *
 * Handles communication with the backend API for push/pull operations.
 * Uses native fetch API (available in Node 18+ and Bun).
 */

import authConfig from './auth-config'
import type { SyncEvent } from '../events'
import type {
  SyncBatchResult,
  SyncPullResult,
  SyncStatus,
  SyncClientError,
} from '../types'

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

    const response = await this.fetchWithRetry(`${apiUrl}/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        projectId,
        events: events.map((e) => ({
          type: e.type,
          path: e.path,
          data: e.data,
          timestamp: e.timestamp,
        })),
      }),
    })

    if (!response.ok) {
      const error = await this.parseErrorResponse(response)
      throw error
    }

    return (await response.json()) as SyncBatchResult
  }

  /**
   * Pull events from the server since a timestamp
   */
  async pullEvents(projectId: string, since?: string): Promise<SyncPullResult> {
    const { apiUrl, apiKey } = await this.getAuthHeaders()

    if (!apiKey) {
      throw this.createError('AUTH_REQUIRED', 'No API key configured')
    }

    const response = await this.fetchWithRetry(`${apiUrl}/sync/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        projectId,
        since,
      }),
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
    try {
      const { apiUrl, apiKey } = await this.getAuthHeaders()

      if (!apiKey) {
        return false
      }

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Api-Key': apiKey,
        },
      })

      return response.ok
    } catch (_error) {
      // Network error or other issue - expected
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
    try {
      const response = await fetch(url, options)

      // Retry on server errors (5xx) but not client errors (4xx)
      if (response.status >= 500 && retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
          this.retryConfig.maxDelayMs
        )
        await this.sleep(delay)
        return this.fetchWithRetry(url, options, retryCount + 1)
      }

      return response
    } catch (error) {
      // Retry on network errors
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, retryCount),
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
