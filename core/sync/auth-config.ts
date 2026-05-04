/**
 * Auth Config - Manages API key storage for cloud sync
 *
 * Stores credentials in ~/.prjct-cli/config/auth.json
 * Used by SyncClient to authenticate with prjct API
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import type { AuthConfig } from '../types/sync'
import * as fileHelper from '../utils/file-helper'

const DEFAULT_API_URL = 'https://api.prjct.app'

const DEFAULT_CONFIG: AuthConfig = {
  apiKey: null,
  apiUrl: DEFAULT_API_URL,
  userId: null,
  email: null,
  lastAuth: null,
}

/**
 * Generate a stable UUIDv4 the first time we read an auth.json that
 * lacks one (B6 / Phase 1.5). Older auth.json files keep working —
 * the next `write` persists the new field.
 */
function freshDeviceId(): string {
  return crypto.randomUUID()
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
   * Read auth config from disk.
   *
   * Phase 1.5 / B6: synthesizes `deviceId` as a UUIDv4 if the
   * persisted file lacks it, and lazily persists it back so future
   * reads return a stable value. Non-breaking — pre-1.5 auth.json
   * files keep working.
   */
  async read(): Promise<AuthConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    const config = await fileHelper.readJson<AuthConfig>(this.configPath)
    const merged: AuthConfig = config ?? { ...DEFAULT_CONFIG }
    let mutated = false
    if (!merged.deviceId) {
      merged.deviceId = freshDeviceId()
      mutated = true
    }
    if (!merged.hostname) {
      merged.hostname = os.hostname()
      mutated = true
    }
    this.cachedConfig = merged
    // Lazy persist of deviceId/hostname only if we have an existing
    // file (don't write a fresh auth.json on a CLI that's never been
    // logged in — that would just create empty config files).
    if (mutated && config) {
      try {
        await fileHelper.writeJson(this.configPath, this.cachedConfig)
        await fs.chmod(this.configPath, 0o600)
      } catch {
        // Best-effort — sync will still get a usable deviceId from cache.
      }
    }
    return this.cachedConfig
  }

  /**
   * Stable UUIDv4 for THIS device. Generated lazily; persisted on the
   * first write. Used by storages (publishEvent → SyncEvent.deviceId)
   * and by sync_cursors as part of the (user_id, device_id, project_id)
   * primary key.
   */
  async getDeviceId(): Promise<string> {
    const config = await this.read()
    return config.deviceId ?? freshDeviceId()
  }

  /** Hostname captured at first auth (B6) — surfaced in account UI. */
  async getHostname(): Promise<string> {
    const config = await this.read()
    return config.hostname ?? os.hostname()
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
    // Restrict file permissions to owner-only (0600) since it contains API keys
    await fs.chmod(this.configPath, 0o600)
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
      apiKeyPrefix: config.apiKey ? `${config.apiKey.substring(0, 12)}...` : null,
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

const authConfig = new AuthConfigManager()
export default authConfig
