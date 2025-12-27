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
   * Update page content (for dashboard)
   */
  async updatePageContent(pageId: string, content: string): Promise<boolean> {
    try {
      // Convert markdown content to Notion blocks
      const blocks = this.markdownToBlocks(content)

      // Clear existing content and add new blocks
      // First, get existing blocks to delete them
      const existingBlocks = await this.apiRequest(
        `/blocks/${pageId}/children`,
        'GET'
      )

      // Delete existing blocks
      for (const block of existingBlocks.results || []) {
        await this.apiRequest(`/blocks/${block.id}`, 'DELETE')
      }

      // Add new blocks
      await this.apiRequest(`/blocks/${pageId}/children`, 'PATCH', {
        children: blocks,
      })

      return true
    } catch (error) {
      console.error('[notion] Failed to update page content:', (error as Error).message)
      return false
    }
  }

  /**
   * Convert simple markdown to Notion blocks
   */
  private markdownToBlocks(content: string): unknown[] {
    const blocks: unknown[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      if (line.startsWith('# ')) {
        blocks.push({
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        })
      } else if (line.startsWith('## ')) {
        blocks.push({
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.slice(3) } }],
          },
        })
      } else if (line.startsWith('- ')) {
        blocks.push({
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        })
      } else if (line.startsWith('|') && line.includes('|')) {
        // Table row - skip header separator
        if (!line.match(/^\|[-|]+\|$/)) {
          const cells = line.split('|').filter(Boolean).map((c) => c.trim())
          if (cells.length > 0) {
            blocks.push({
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content: cells.join(' | ') } }],
              },
            })
          }
        }
      } else if (line.trim() === '---') {
        blocks.push({ type: 'divider', divider: {} })
      } else if (line.trim()) {
        blocks.push({
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
          },
        })
      }
    }

    return blocks
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
   * Find page by name (for upsert)
   * Note: Since each project has its own database, we don't need to filter by project
   */
  async findPageByProjectAndName(
    databaseId: string,
    _projectId: string,
    name: string
  ): Promise<string | null> {
    try {
      const response = await this.apiRequest(
        `/databases/${databaseId}/query`,
        'POST',
        {
          filter: {
            or: [
              { property: 'Name', title: { equals: name } },
              { property: 'Idea', title: { equals: name } },
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
