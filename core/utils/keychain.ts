/**
 * Keychain Helper - Secure credential storage
 *
 * Uses macOS Keychain for secure storage of API keys and tokens.
 * Falls back to environment variables if keychain is not available.
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { getErrorMessage } from '../types/fs'

const execAsync = promisify(exec)

const SERVICE_NAME = 'prjct-cli'

export type CredentialKey = 'linear-api-key' | 'jira-api-token'

/**
 * Store a credential in the keychain
 */
export async function setCredential(key: CredentialKey, value: string): Promise<boolean> {
  if (process.platform !== 'darwin') {
    console.warn('[keychain] macOS Keychain only available on macOS')
    return false
  }

  try {
    // Delete existing entry first (ignore errors if it doesn't exist)
    await execAsync(
      `security delete-generic-password -s "${SERVICE_NAME}" -a "${key}" 2>/dev/null || true`
    )

    // Add new entry
    await execAsync(`security add-generic-password -s "${SERVICE_NAME}" -a "${key}" -w "${value}"`)

    return true
  } catch (error) {
    console.error('[keychain] Failed to store credential:', getErrorMessage(error))
    return false
  }
}

/**
 * Get a credential from the keychain
 */
export async function getCredential(key: CredentialKey): Promise<string | null> {
  if (process.platform !== 'darwin') {
    // Fallback to environment variables on non-macOS
    return getEnvFallback(key)
  }

  try {
    const { stdout } = await execAsync(
      `security find-generic-password -s "${SERVICE_NAME}" -a "${key}" -w 2>/dev/null`
    )
    return stdout.trim() || null
  } catch (_error) {
    // Not found in keychain - expected, try environment variable
    return getEnvFallback(key)
  }
}

/**
 * Delete a credential from the keychain
 */
export async function deleteCredential(key: CredentialKey): Promise<boolean> {
  if (process.platform !== 'darwin') {
    return false
  }

  try {
    await execAsync(`security delete-generic-password -s "${SERVICE_NAME}" -a "${key}" 2>/dev/null`)
    return true
  } catch (_error) {
    // Not found in keychain - expected
    return false
  }
}

/**
 * Check if a credential exists
 */
export async function hasCredential(key: CredentialKey): Promise<boolean> {
  const value = await getCredential(key)
  return value !== null && value.length > 0
}

/**
 * Get environment variable fallback for a credential key
 */
function getEnvFallback(key: CredentialKey): string | null {
  const envMap: Record<CredentialKey, string> = {
    'linear-api-key': 'LINEAR_API_KEY',
    'jira-api-token': 'JIRA_API_TOKEN',
  }

  const envVar = envMap[key]
  return process.env[envVar] || null
}

/**
 * Get credential with source information
 */
export async function getCredentialWithSource(
  key: CredentialKey
): Promise<{ value: string | null; source: 'keychain' | 'env' | 'none' }> {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execAsync(
        `security find-generic-password -s "${SERVICE_NAME}" -a "${key}" -w 2>/dev/null`
      )
      const value = stdout.trim()
      if (value) {
        return { value, source: 'keychain' }
      }
    } catch (_error) {
      // Not in keychain - expected, check env
    }
  }

  const envValue = getEnvFallback(key)
  if (envValue) {
    return { value: envValue, source: 'env' }
  }

  return { value: null, source: 'none' }
}
