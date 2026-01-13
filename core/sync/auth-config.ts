/**
 * Auth Config - Manages API key storage for cloud sync
 *
 * Stores credentials in ~/.prjct-cli/config/auth.json
 * Used by SyncClient to authenticate with prjct API
 */

import path from 'path'
import * as fileHelper from '../utils/file-helper'
import pathManager from '../infrastructure/path-manager'
import type { AuthConfig } from '../types'

const DEFAULT_API_URL = 'https://api.prjct.app'

const DEFAULT_CONFIG: AuthConfig = {
  apiKey: null,
  apiUrl: DEFAULT_API_URL,
  userId: null,
  email: null,
  lastAuth: null,
}

class AuthConfigManager {
  private configPath: string
  private cachedConfig: AuthConfig | null = null

  constructor() {
    this.configPath = pathManager.getAuthConfigPath()
  }

  /**
   * Get the auth config file path
   */
  getConfigPath(): string {
    return this.configPath
  }

  /**
   * Read auth config from disk
   */
  async read(): Promise<AuthConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    const config = await fileHelper.readJson<AuthConfig>(this.configPath)
    this.cachedConfig = config ?? { ...DEFAULT_CONFIG }
    return this.cachedConfig
  }

  /**
   * Write auth config to disk
   */
  async write(config: Partial<AuthConfig>): Promise<void> {
    const current = await this.read()
    const updated: AuthConfig = {
      ...current,
      ...config,
      lastAuth: new Date().toISOString(),
    }

    await fileHelper.ensureDir(path.dirname(this.configPath))
    await fileHelper.writeJson(this.configPath, updated)
    this.cachedConfig = updated
  }

  /**
   * Check if user is authenticated (has valid API key)
   */
  async hasAuth(): Promise<boolean> {
    const config = await this.read()
    return config.apiKey !== null && config.apiKey.length > 0
  }

  /**
   * Get the API key if available
   */
  async getApiKey(): Promise<string | null> {
    const config = await this.read()
    return config.apiKey
  }

  /**
   * Get the API URL (allows override for dev/staging)
   */
  async getApiUrl(): Promise<string> {
    const config = await this.read()
    return config.apiUrl || DEFAULT_API_URL
  }

  /**
   * Save API key and user info after successful auth
   */
  async saveAuth(apiKey: string, userId: string, email: string): Promise<void> {
    await this.write({
      apiKey,
      userId,
      email,
    })
  }

  /**
   * Clear all auth data (logout)
   */
  async clearAuth(): Promise<void> {
    this.cachedConfig = { ...DEFAULT_CONFIG }
    await fileHelper.writeJson(this.configPath, this.cachedConfig)
  }

  /**
   * Get auth status for display
   */
  async getStatus(): Promise<{
    authenticated: boolean
    email: string | null
    apiKeyPrefix: string | null
    lastAuth: string | null
  }> {
    const config = await this.read()

    return {
      authenticated: config.apiKey !== null,
      email: config.email,
      apiKeyPrefix: config.apiKey ? config.apiKey.substring(0, 12) + '...' : null,
      lastAuth: config.lastAuth,
    }
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.cachedConfig = null
  }
}

export const authConfig = new AuthConfigManager()
export default authConfig
