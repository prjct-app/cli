/**
 * OAuth Handler - Manages authentication flow for CLI
 *
 * Two modes:
 * 1. Simple: User copies API key from web dashboard
 * 2. Browser (future): Full OAuth device flow
 */

import type { AuthResult } from '../types/sync'
import { authConfig } from './auth-config'
import { syncClient } from './sync-client'

class OAuthHandler {
  /**
   * Start authentication flow
   * Opens browser to dashboard where user can create/copy API key
   */
  async startAuthFlow(): Promise<{ url: string }> {
    const apiUrl = await authConfig.getApiUrl()
    // Dashboard URL where user can get their API key
    const dashboardUrl = apiUrl.replace('api.', 'app.')
    const authUrl = `${dashboardUrl}/settings/api-keys`

    return { url: authUrl }
  }

  /**
   * Save API key after user provides it
   */
  async saveApiKey(apiKey: string): Promise<AuthResult> {
    // Validate format
    if (!apiKey.startsWith('prjct_')) {
      return {
        success: false,
        error: 'Invalid API key format. Keys start with "prjct_"',
      }
    }

    // Save temporarily to test connection
    await authConfig.write({ apiKey })

    // Test the key by making a request
    const isValid = await syncClient.testConnection()

    if (!isValid) {
      // Clear the invalid key
      await authConfig.clearAuth()
      return {
        success: false,
        error: 'API key is invalid or expired',
      }
    }

    // Key is valid - fetch user info
    try {
      const userInfo = await this.fetchUserInfo(apiKey)

      await authConfig.saveAuth(apiKey, userInfo.id, userInfo.email)

      return {
        success: true,
        email: userInfo.email,
      }
    } catch (_error) {
      // Key works but couldn't fetch user info - still save it
      await authConfig.write({ apiKey })
      return {
        success: true,
      }
    }
  }

  /**
   * Fetch user info using the API key
   */
  private async fetchUserInfo(
    apiKey: string
  ): Promise<{ id: string; email: string; name: string }> {
    const apiUrl = await authConfig.getApiUrl()

    const response = await fetch(`${apiUrl}/auth/me`, {
      headers: {
        'X-Api-Key': apiKey,
      },
    })

    if (!response.ok) {
      throw new Error('Failed to fetch user info')
    }

    const data = (await response.json()) as {
      user: { id: string; email: string; name: string }
    }
    return data.user
  }

  /**
   * Check if currently authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await authConfig.hasAuth()
  }

  /**
   * Get current auth status
   */
  async getStatus(): Promise<{
    authenticated: boolean
    email: string | null
    apiKeyPrefix: string | null
  }> {
    return await authConfig.getStatus()
  }

  /**
   * Logout - clear all auth data
   */
  async logout(): Promise<void> {
    await authConfig.clearAuth()
  }

  /**
   * Open URL in default browser
   */
  async openBrowser(url: string): Promise<void> {
    const { exec } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execAsync = promisify(exec)

    const platform = process.platform
    const command =
      platform === 'darwin'
        ? `open "${url}"`
        : platform === 'win32'
          ? `start "${url}"`
          : `xdg-open "${url}"`

    await execAsync(command)
  }
}

export const oauthHandler = new OAuthHandler()
export default oauthHandler
