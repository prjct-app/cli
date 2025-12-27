/**
 * Notion Client
 * Wrapper for Notion MCP tools with fallback to direct API.
 *
 * Uses MCP tools when available (via Claude), falls back to fetch for CLI usage.
 */

import type { NotionIntegrationConfig } from '../../types/integrations'

// =============================================================================
// Types
// =============================================================================

export interface NotionDatabase {
  id: string
  title: string
  url: string
}

export interface NotionPage {
  id: string
  url: string
}

export interface NotionProperty {
  type: string
  [key: string]: unknown
}

export interface NotionDatabaseSchema {
  title: string
  properties: Record<string, NotionProperty>
}

export interface NotionQueryFilter {
  property: string
  rich_text?: { equals: string }
  title?: { equals: string }
  date?: { equals: string }
}

// Notion API response types
interface NotionApiResponse {
  id?: string
  url?: string
  bot?: {
    workspace_name?: string
    owner?: {
      workspace?: {
        id?: string
      }
    }
  }
  results?: Array<{ id: string; properties: Record<string, unknown> }>
}

// =============================================================================
// Notion Client Class
// =============================================================================

export class NotionClient {
  private config: NotionIntegrationConfig | null = null
  private apiToken: string | null = null

  /**
   * Initialize client with config
   */
  initialize(config: NotionIntegrationConfig, apiToken?: string): void {
    this.config = config
    this.apiToken = apiToken || process.env.NOTION_TOKEN || null
  }

  /**
   * Check if client is ready
   */
  isReady(): boolean {
    return this.config?.enabled === true && this.apiToken !== null
  }

  /**
   * Get workspace info
   */
  async getWorkspace(): Promise<{ id: string; name: string } | null> {
    if (!this.apiToken) return null

    try {
      const response = await this.apiRequest('/users/me')
      if (response.bot?.workspace_name) {
        return {
          id: response.bot.owner?.workspace?.id || 'unknown',
          name: response.bot.workspace_name,
        }
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Create a database in Notion
   */
  async createDatabase(
    parentPageId: string,
    schema: NotionDatabaseSchema
  ): Promise<NotionDatabase | null> {
    try {
      const response = await this.apiRequest('/databases', 'POST', {
        parent: { type: 'page_id', page_id: parentPageId },
        title: [{ type: 'text', text: { content: schema.title } }],
        properties: schema.properties,
      })

      if (!response.id || !response.url) {
        return null
      }

      return {
        id: response.id,
        title: schema.title,
        url: response.url,
      }
    } catch (error) {
      console.error('[notion] Failed to create database:', (error as Error).message)
      return null
    }
  }

  /**
   * Create a page in a database
   */
  async createPage(
    databaseId: string,
    properties: Record<string, unknown>
  ): Promise<NotionPage | null> {
    try {
      const response = await this.apiRequest('/pages', 'POST', {
        parent: { type: 'database_id', database_id: databaseId },
        properties,
      })

      if (!response.id || !response.url) {
        return null
      }

      return {
        id: response.id,
        url: response.url,
      }
    } catch (error) {
      console.error('[notion] Failed to create page:', (error as Error).message)
      return null
    }
  }

  /**
   * Update a page
   */
  async updatePage(
    pageId: string,
    properties: Record<string, unknown>
  ): Promise<NotionPage | null> {
    try {
      const response = await this.apiRequest(`/pages/${pageId}`, 'PATCH', {
        properties,
      })

      if (!response.id || !response.url) {
        return null
      }

      return {
        id: response.id,
        url: response.url,
      }
    } catch (error) {
      console.error('[notion] Failed to update page:', (error as Error).message)
      return null
    }
  }

  /**
   * Query a database
   */
  async queryDatabase(
    databaseId: string,
    filter?: NotionQueryFilter
  ): Promise<Array<{ id: string; properties: Record<string, unknown> }>> {
    try {
      const body: Record<string, unknown> = {}
      if (filter) {
        body.filter = filter
      }

      const response = await this.apiRequest(
        `/databases/${databaseId}/query`,
        'POST',
        body
      )

      return (response.results || []).map(
        (page: { id: string; properties: Record<string, unknown> }) => ({
          id: page.id,
          properties: page.properties,
        })
      )
    } catch (error) {
      console.error('[notion] Failed to query database:', (error as Error).message)
      return []
    }
  }

  /**
   * Find page by project ID and name (for upsert)
   */
  async findPageByProjectAndName(
    databaseId: string,
    projectId: string,
    name: string
  ): Promise<string | null> {
    try {
      const response = await this.apiRequest(
        `/databases/${databaseId}/query`,
        'POST',
        {
          filter: {
            and: [
              { property: 'Project', rich_text: { equals: projectId } },
              { property: 'Name', title: { equals: name } },
            ],
          },
        }
      )

      const results = response.results || []
      return results.length > 0 ? results[0].id : null
    } catch {
      return null
    }
  }

  /**
   * Create a page (for dashboard)
   */
  async createDashboardPage(
    parentPageId: string,
    title: string,
    content: string
  ): Promise<NotionPage | null> {
    try {
      const response = await this.apiRequest('/pages', 'POST', {
        parent: { type: 'page_id', page_id: parentPageId },
        properties: {
          title: [{ type: 'text', text: { content: title } }],
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content } }],
            },
          },
        ],
      })

      if (!response.id || !response.url) {
        return null
      }

      return {
        id: response.id,
        url: response.url,
      }
    } catch (error) {
      console.error('[notion] Failed to create page:', (error as Error).message)
      return null
    }
  }

  /**
   * Make API request to Notion
   */
  private async apiRequest(
    endpoint: string,
    method = 'GET',
    body?: Record<string, unknown>
  ): Promise<NotionApiResponse> {
    if (!this.apiToken) {
      throw new Error('Notion API token not configured')
    }

    const url = `https://api.notion.com/v1${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    }

    const options: RequestInit = {
      method,
      headers,
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as { message?: string }
      throw new Error(
        `Notion API error: ${response.status} - ${errorData.message || 'Unknown error'}`
      )
    }

    return (await response.json()) as NotionApiResponse
  }
}

// Singleton instance
export const notionClient = new NotionClient()
