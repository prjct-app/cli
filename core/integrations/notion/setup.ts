/**
 * Notion Setup Flow
 * Interactive setup for Notion integration.
 */

import type { NotionIntegrationConfig } from '../../types/integrations'
import { DEFAULT_NOTION_CONFIG } from '../../types/integrations'
import { notionClient } from './client'
import {
  ALL_DATABASE_SCHEMAS,
  getDashboardContent,
} from './templates'

// =============================================================================
// Types
// =============================================================================

export interface SetupResult {
  success: boolean
  config?: NotionIntegrationConfig
  error?: string
  message?: string
}

export interface ValidationResult {
  valid: boolean
  workspaceName?: string
  error?: string
}

// =============================================================================
// Setup Functions
// =============================================================================

/**
 * Check if Notion MCP is available
 * Returns true if the MCP server is configured
 */
export function checkNotionMCPAvailable(): boolean {
  // Check if running in Claude environment with MCP
  if (typeof globalThis !== 'undefined') {
    const g = globalThis as Record<string, unknown>
    if (g.mcp || g.notion || process.env.NOTION_TOKEN) {
      return true
    }
  }
  return !!process.env.NOTION_TOKEN
}

/**
 * Validate Notion API token
 */
export async function validateToken(token: string): Promise<ValidationResult> {
  try {
    // Temporarily initialize client with token
    const tempConfig: NotionIntegrationConfig = {
      ...DEFAULT_NOTION_CONFIG,
      enabled: true,
    }
    notionClient.initialize(tempConfig, token)

    const workspace = await notionClient.getWorkspace()
    if (workspace) {
      return {
        valid: true,
        workspaceName: workspace.name,
      }
    }

    return {
      valid: false,
      error: 'Could not connect to Notion workspace',
    }
  } catch (error) {
    return {
      valid: false,
      error: (error as Error).message,
    }
  }
}

/**
 * Create all prjct databases in Notion
 */
export async function createDatabases(
  parentPageId: string,
  projectName: string
): Promise<{
  success: boolean
  databases: NotionIntegrationConfig['databases']
  dashboardPageId?: string
  error?: string
}> {
  const databases: NotionIntegrationConfig['databases'] = {}

  try {
    // Create each database
    for (const [key, schema] of Object.entries(ALL_DATABASE_SCHEMAS)) {
      const db = await notionClient.createDatabase(parentPageId, schema)
      if (db) {
        databases[key as keyof typeof databases] = db.id
      } else {
        return {
          success: false,
          databases,
          error: `Failed to create ${schema.title} database`,
        }
      }
    }

    // Create dashboard page
    const dashboardContent = getDashboardContent(projectName, databases)
    const dashboard = await notionClient.createDashboardPage(
      parentPageId,
      `${projectName} Dashboard`,
      dashboardContent
    )

    return {
      success: true,
      databases,
      dashboardPageId: dashboard?.id,
    }
  } catch (error) {
    return {
      success: false,
      databases,
      error: (error as Error).message,
    }
  }
}

/**
 * Full setup flow
 * Called by /p:init or /p:notion setup
 */
export async function setupNotion(params: {
  token: string
  parentPageId: string
  projectId: string
  projectName: string
}): Promise<SetupResult> {
  const { token, parentPageId, projectId, projectName } = params

  // Step 1: Validate token
  const validation = await validateToken(token)
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error || 'Invalid token',
    }
  }

  // Step 2: Initialize client
  const config: NotionIntegrationConfig = {
    ...DEFAULT_NOTION_CONFIG,
    enabled: true,
    workspaceName: validation.workspaceName,
  }
  notionClient.initialize(config, token)

  // Step 3: Create databases
  const result = await createDatabases(parentPageId, projectName)
  if (!result.success) {
    return {
      success: false,
      error: result.error,
    }
  }

  // Step 4: Build final config
  const finalConfig: NotionIntegrationConfig = {
    enabled: true,
    workspaceName: validation.workspaceName,
    databases: result.databases,
    dashboardPageId: result.dashboardPageId,
    syncOn: {
      ship: true,
      done: false,
      idea: true,
    },
    setupAt: new Date().toISOString(),
  }

  return {
    success: true,
    config: finalConfig,
    message: `Notion connected to "${validation.workspaceName}". Created 4 databases.`,
  }
}

/**
 * Get setup instructions for user
 */
export function getSetupInstructions(): string[] {
  return [
    '1. Go to https://www.notion.so/my-integrations',
    '2. Click "New integration"',
    '3. Name it "prjct-cli" and select your workspace',
    '4. Copy the Internal Integration Secret (starts with ntn_)',
    '5. Share a Notion page with the integration (this will be the parent)',
    '6. Copy the page ID from the URL (the 32-character string)',
  ]
}

/**
 * Parse Notion page URL to get page ID
 */
export function parseNotionPageUrl(url: string): string | null {
  // Handle various Notion URL formats
  // https://www.notion.so/workspace/Page-Title-abc123def456
  // https://notion.so/abc123def456
  // abc123def456 (just the ID)

  const cleanUrl = url.trim()

  // If it's already a 32-char hex string
  if (/^[a-f0-9]{32}$/i.test(cleanUrl)) {
    return cleanUrl
  }

  // If it's a UUID format (with dashes)
  if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(cleanUrl)) {
    return cleanUrl.replace(/-/g, '')
  }

  // Try to extract from URL
  const match = cleanUrl.match(/([a-f0-9]{32})/i)
  return match ? match[1] : null
}
