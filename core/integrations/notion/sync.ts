/**
 * Notion Sync Logic
 * Sync prjct data to Notion databases.
 */

import type { ShippedFeature, Idea } from '../../types/storage'
import type { NotionIntegrationConfig } from '../../types/integrations'
import { notionClient } from './client'

// =============================================================================
// Types
// =============================================================================

export interface SyncResult {
  success: boolean
  action: 'created' | 'updated' | 'skipped'
  pageId?: string
  url?: string
  error?: string
}

// =============================================================================
// Property Builders
// =============================================================================

/**
 * Build Notion properties for a shipped feature
 */
function buildShippedProperties(
  feature: ShippedFeature,
  projectId: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: feature.name } }],
    },
    Project: {
      rich_text: [{ text: { content: projectId } }],
    },
  }

  if (feature.version) {
    props.Version = {
      rich_text: [{ text: { content: feature.version } }],
    }
  }

  if (feature.type) {
    props.Type = {
      select: { name: feature.type },
    }
  }

  if (feature.shippedAt) {
    props['Shipped Date'] = {
      date: { start: feature.shippedAt.split('T')[0] },
    }
  }

  if (feature.codeMetrics) {
    const metrics = feature.codeMetrics
    props['Lines Changed'] = {
      number: (metrics.linesAdded || 0) + (metrics.linesRemoved || 0),
    }
    props['Files Changed'] = {
      number: metrics.filesChanged || 0,
    }
    props.Commits = {
      number: metrics.commits || 0,
    }
  }

  if (feature.duration) {
    props.Duration = {
      rich_text: [{ text: { content: feature.duration } }],
    }
  }

  if (feature.description) {
    props.Description = {
      rich_text: [{ text: { content: feature.description.slice(0, 2000) } }],
    }
  }

  return props
}

/**
 * Build Notion properties for an idea
 */
function buildIdeaProperties(
  idea: Idea,
  projectId: string
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    Idea: {
      title: [{ text: { content: idea.text } }],
    },
    Project: {
      rich_text: [{ text: { content: projectId } }],
    },
  }

  if (idea.status) {
    const statusMap: Record<string, string> = {
      pending: 'Pending',
      converted: 'Converted',
      completed: 'Converted',
      archived: 'Archived',
    }
    props.Status = {
      status: { name: statusMap[idea.status] || 'Pending' },
    }
  }

  if (idea.priority) {
    props.Priority = {
      select: { name: idea.priority },
    }
  }

  if (idea.tags && idea.tags.length > 0) {
    props.Tags = {
      multi_select: idea.tags.map((tag) => ({ name: tag })),
    }
  }

  const createdDate = idea.createdAt || idea.addedAt
  if (createdDate) {
    props.Created = {
      date: { start: createdDate.split('T')[0] },
    }
  }

  if (idea.convertedTo) {
    props['Converted To'] = {
      rich_text: [{ text: { content: idea.convertedTo } }],
    }
  }

  return props
}

// =============================================================================
// Sync Functions
// =============================================================================

/**
 * Sync a shipped feature to Notion
 */
export async function syncShippedFeature(
  projectId: string,
  feature: ShippedFeature,
  config: NotionIntegrationConfig
): Promise<SyncResult> {
  if (!config.enabled || !config.databases.shipped) {
    return { success: false, action: 'skipped', error: 'Notion not configured' }
  }

  if (!notionClient.isReady()) {
    return { success: false, action: 'skipped', error: 'Notion client not ready' }
  }

  try {
    const databaseId = config.databases.shipped
    const properties = buildShippedProperties(feature, projectId)

    // Check if already exists (upsert)
    const existingPageId = await notionClient.findPageByProjectAndName(
      databaseId,
      projectId,
      feature.name
    )

    if (existingPageId) {
      const page = await notionClient.updatePage(existingPageId, properties)
      if (page) {
        return {
          success: true,
          action: 'updated',
          pageId: page.id,
          url: page.url,
        }
      }
    } else {
      const page = await notionClient.createPage(databaseId, properties)
      if (page) {
        return {
          success: true,
          action: 'created',
          pageId: page.id,
          url: page.url,
        }
      }
    }

    return { success: false, action: 'skipped', error: 'Failed to sync' }
  } catch (error) {
    return {
      success: false,
      action: 'skipped',
      error: (error as Error).message,
    }
  }
}

/**
 * Sync an idea to Notion
 */
export async function syncIdea(
  projectId: string,
  idea: Idea,
  config: NotionIntegrationConfig
): Promise<SyncResult> {
  if (!config.enabled || !config.databases.ideas) {
    return { success: false, action: 'skipped', error: 'Notion not configured' }
  }

  if (!notionClient.isReady()) {
    return { success: false, action: 'skipped', error: 'Notion client not ready' }
  }

  try {
    const databaseId = config.databases.ideas
    const properties = buildIdeaProperties(idea, projectId)

    // Check if already exists (by ID in text)
    const existingPageId = await notionClient.findPageByProjectAndName(
      databaseId,
      projectId,
      idea.text
    )

    if (existingPageId) {
      const page = await notionClient.updatePage(existingPageId, properties)
      if (page) {
        return {
          success: true,
          action: 'updated',
          pageId: page.id,
          url: page.url,
        }
      }
    } else {
      const page = await notionClient.createPage(databaseId, properties)
      if (page) {
        return {
          success: true,
          action: 'created',
          pageId: page.id,
          url: page.url,
        }
      }
    }

    return { success: false, action: 'skipped', error: 'Failed to sync' }
  } catch (error) {
    return {
      success: false,
      action: 'skipped',
      error: (error as Error).message,
    }
  }
}

/**
 * Full sync - sync all data to Notion
 * Used for initial setup or manual resync
 */
export async function fullSync(
  projectId: string,
  config: NotionIntegrationConfig,
  data: {
    shipped?: ShippedFeature[]
    ideas?: Idea[]
  }
): Promise<{
  shipped: { synced: number; failed: number }
  ideas: { synced: number; failed: number }
}> {
  const results = {
    shipped: { synced: 0, failed: 0 },
    ideas: { synced: 0, failed: 0 },
  }

  // Sync shipped features
  if (data.shipped && config.databases.shipped) {
    for (const feature of data.shipped) {
      const result = await syncShippedFeature(projectId, feature, config)
      if (result.success) {
        results.shipped.synced++
      } else {
        results.shipped.failed++
      }
    }
  }

  // Sync ideas
  if (data.ideas && config.databases.ideas) {
    for (const idea of data.ideas) {
      const result = await syncIdea(projectId, idea, config)
      if (result.success) {
        results.ideas.synced++
      } else {
        results.ideas.failed++
      }
    }
  }

  return results
}
