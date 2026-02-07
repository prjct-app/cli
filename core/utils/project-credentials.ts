/**
 * Per-project credential storage
 *
 * Stores credentials in: ~/.prjct-cli/projects/{projectId}/config/credentials.json
 *
 * Fallback chain for Linear API key:
 * 1. Project credentials (per-project)
 * 2. Global keychain (macOS)
 * 3. Environment variables
 *
 * This allows different projects to use different Linear workspaces.
 */

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { getErrorMessage } from '../types/fs'
import { fileExists } from './fs-helpers'
import { type CredentialKey, getCredential } from './keychain'

interface LinearCredentials {
  apiKey: string
  teamId?: string
  teamKey?: string
  setupAt: string
}

export interface ProjectCredentials {
  linear?: LinearCredentials
}

/**
 * Get path to project credentials file
 */
function getCredentialsPath(projectId: string): string {
  return path.join(os.homedir(), '.prjct-cli', 'projects', projectId, 'config', 'credentials.json')
}

/**
 * Get all credentials for a project
 */
export async function getProjectCredentials(projectId: string): Promise<ProjectCredentials> {
  const credPath = getCredentialsPath(projectId)
  if (!(await fileExists(credPath))) {
    return {}
  }

  try {
    return JSON.parse(await fs.readFile(credPath, 'utf-8'))
  } catch (error) {
    console.error('[project-credentials] Failed to read credentials:', getErrorMessage(error))
    return {}
  }
}

/**
 * Set Linear credentials for a project
 */
export async function setLinearCredentials(
  projectId: string,
  credentials: LinearCredentials
): Promise<void> {
  const credPath = getCredentialsPath(projectId)
  const dir = path.dirname(credPath)

  // Ensure directory exists
  if (!(await fileExists(dir))) {
    await fs.mkdir(dir, { recursive: true })
  }

  // Read existing, merge, write
  const current = await getProjectCredentials(projectId)
  current.linear = credentials
  await fs.writeFile(credPath, JSON.stringify(current, null, 2))
}

/**
 * Delete Linear credentials for a project
 */
export async function deleteLinearCredentials(projectId: string): Promise<void> {
  const current = await getProjectCredentials(projectId)

  if (current.linear) {
    delete current.linear
    const credPath = getCredentialsPath(projectId)
    await fs.writeFile(credPath, JSON.stringify(current, null, 2))
  }
}

/**
 * Get Linear API key with fallback chain:
 * 1. Project credentials
 * 2. Global keychain
 * 3. Environment variable
 */
export async function getLinearApiKey(projectId: string): Promise<string | null> {
  // 1. Project credentials
  const projectCreds = await getProjectCredentials(projectId)
  if (projectCreds.linear?.apiKey) {
    return projectCreds.linear.apiKey
  }

  // 2. Global keychain (falls back to env var internally)
  return getCredential('linear-api-key' as CredentialKey)
}

/**
 * Get Linear team ID from project credentials
 */
export async function getLinearTeamId(projectId: string): Promise<string | undefined> {
  const projectCreds = await getProjectCredentials(projectId)
  return projectCreds.linear?.teamId
}

/**
 * Check if Linear is configured for a project
 */
export async function isLinearConfigured(projectId: string): Promise<boolean> {
  const apiKey = await getLinearApiKey(projectId)
  return apiKey !== null && apiKey.length > 0
}

/**
 * Get credential source for debugging
 */
export async function getCredentialSource(
  projectId: string
): Promise<'project' | 'keychain' | 'env' | 'none'> {
  // Check project credentials
  const projectCreds = await getProjectCredentials(projectId)
  if (projectCreds.linear?.apiKey) {
    return 'project'
  }

  // Check keychain/env
  const { getCredentialWithSource } = await import('./keychain')
  const result = await getCredentialWithSource('linear-api-key' as CredentialKey)
  if (result.value) {
    return result.source === 'keychain' ? 'keychain' : 'env'
  }

  return 'none'
}
