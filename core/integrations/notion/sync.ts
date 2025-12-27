/**
 * Notion Sync Logic
 * Sync prjct data to Notion databases.
 */

import type { ShippedFeature, Idea } from '../../types/storage'
import type { NotionIntegrationConfig } from '../../types/integrations'
import { notionClient } from './client'
import { getDashboardContent, type DashboardMetrics } from './templates'

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
 * Includes ALL fields for comprehensive sync
 */
function buildShippedProperties(
  feature: ShippedFeature,
  _projectId: string
): Record<string, unknown> {
  const now = new Date().toISOString()

  // Note: Project field removed - each project now has its own database
  const props: Record<string, unknown> = {
    Name: {
      title: [{ text: { content: feature.name } }],
    },
    // Sync tracking fields
    prjctId: {
      rich_text: [{ text: { content: feature.id } }],
    },
    'Last Updated': {
      date: { start: now.split('T')[0] },
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

  // Full code metrics
  if (feature.codeMetrics) {
    const metrics = feature.codeMetrics
    props['Lines Added'] = {
      number: metrics.linesAdded || 0,
    }
    props['Lines Removed'] = {
      number: metrics.linesRemoved || 0,
    }
    props['Files Changed'] = {
      number: metrics.filesChanged || 0,
    }
  }

  // Commit info
  if (feature.commit && typeof feature.commit === 'object') {
    props.Commit = {
      rich_text: [{ text: { content: feature.commit.hash || '' } }],
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

  // Impact level based on metrics
  const impact = feature.codeMetrics?.linesAdded && feature.codeMetrics.linesAdded > 500 ? 'High' :
                 feature.codeMetrics?.linesAdded && feature.codeMetrics.linesAdded > 100 ? 'Medium' : 'Low'
  props.Impact = {
    select: { name: impact },
  }

  return props
}

/**
 * Build Notion properties for an idea
 * Includes ALL fields for comprehensive sync
 */
function buildIdeaProperties(
  idea: Idea,
  _projectId: string
): Record<string, unknown> {
  const now = new Date().toISOString()

  // Note: Project field removed - each project now has its own database
  const props: Record<string, unknown> = {
    Idea: {
      title: [{ text: { content: idea.text } }],
    },
    // Sync tracking fields
    prjctId: {
      rich_text: [{ text: { content: idea.id } }],
    },
    'Last Updated': {
      date: { start: now.split('T')[0] },
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

  // Details/notes
  if (idea.details) {
    props.Details = {
      rich_text: [{ text: { content: idea.details.slice(0, 2000) } }],
    }
  }

  // Impact/Effort matrix
  if (idea.impactEffort) {
    props.Impact = {
      select: { name: idea.impactEffort.impact },
    }
    props.Effort = {
      select: { name: idea.impactEffort.effort },
    }
  }

  // Pain points as text
  if (idea.painPoints && idea.painPoints.length > 0) {
    props['Pain Points'] = {
      rich_text: [{ text: { content: idea.painPoints.join(', ').slice(0, 2000) } }],
    }
  }

  // Solutions as text
  if (idea.solutions && idea.solutions.length > 0) {
    props.Solutions = {
      rich_text: [{ text: { content: idea.solutions.join(', ').slice(0, 2000) } }],
    }
  }

  // Files affected
  if (idea.filesAffected && idea.filesAffected.length > 0) {
    props['Files Affected'] = {
      rich_text: [{ text: { content: idea.filesAffected.join(', ').slice(0, 2000) } }],
    }
  }

  // Risks count
  if (idea.risksCount !== undefined) {
    props.Risks = {
      number: idea.risksCount,
    }
  }

  return props
}

// =============================================================================
// Property Parsers (Notion → prjct)
// =============================================================================

/**
 * Extract text from Notion rich_text property
 */
function extractText(prop: unknown): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as { rich_text?: Array<{ plain_text?: string }> }
  if (!p.rich_text || p.rich_text.length === 0) return undefined
  return p.rich_text.map((t) => t.plain_text || '').join('')
}

/**
 * Extract title from Notion title property
 */
function extractTitle(prop: unknown): string {
  if (!prop || typeof prop !== 'object') return ''
  const p = prop as { title?: Array<{ plain_text?: string }> }
  if (!p.title || p.title.length === 0) return ''
  return p.title.map((t) => t.plain_text || '').join('')
}

/**
 * Extract date from Notion date property
 */
function extractDate(prop: unknown): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as { date?: { start?: string } }
  return p.date?.start
}

/**
 * Extract select value from Notion select property
 */
function extractSelect(prop: unknown): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as { select?: { name?: string } }
  return p.select?.name
}

/**
 * Extract status value from Notion status property
 */
function extractStatus(prop: unknown): string | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as { status?: { name?: string } }
  return p.status?.name
}

/**
 * Extract number from Notion number property
 */
function extractNumber(prop: unknown): number | undefined {
  if (!prop || typeof prop !== 'object') return undefined
  const p = prop as { number?: number | null }
  return p.number ?? undefined
}

/**
 * Extract multi-select as string array
 */
function extractMultiSelect(prop: unknown): string[] {
  if (!prop || typeof prop !== 'object') return []
  const p = prop as { multi_select?: Array<{ name?: string }> }
  if (!p.multi_select) return []
  return p.multi_select.map((s) => s.name || '').filter(Boolean)
}

/**
 * Parse Notion page to ShippedFeature
 */
function parseShippedFeature(
  pageId: string,
  props: Record<string, unknown>
): Partial<ShippedFeature> & { notionPageId: string } {
  return {
    notionPageId: pageId,
    id: extractText(props.prjctId) || '',
    name: extractTitle(props.Name) || '',
    version: extractText(props.Version) || '',
    shippedAt: extractDate(props['Shipped Date']) || new Date().toISOString(),
    description: extractText(props.Description),
    type: extractSelect(props.Type) as ShippedFeature['type'],
    duration: extractText(props.Duration),
    codeMetrics: {
      linesAdded: extractNumber(props['Lines Added']) || 0,
      linesRemoved: extractNumber(props['Lines Removed']) || 0,
      filesChanged: extractNumber(props['Files Changed']) || 0,
      commits: 0,
    },
    lastSyncedAt: new Date().toISOString(),
  }
}

/**
 * Parse Notion page to Idea
 */
function parseIdea(
  pageId: string,
  props: Record<string, unknown>
): Partial<Idea> & { notionPageId: string } {
  const statusMap: Record<string, Idea['status']> = {
    Pending: 'pending',
    Converted: 'converted',
    Archived: 'archived',
  }

  const priorityMap: Record<string, Idea['priority']> = {
    high: 'high',
    medium: 'medium',
    low: 'low',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  }

  return {
    notionPageId: pageId,
    id: extractText(props.prjctId) || '',
    text: extractTitle(props.Idea) || '',
    status: statusMap[extractStatus(props.Status) || ''] || 'pending',
    priority: priorityMap[extractSelect(props.Priority) || ''] || 'medium',
    tags: extractMultiSelect(props.Tags),
    details: extractText(props.Details),
    addedAt: extractDate(props.Created) || new Date().toISOString(),
    convertedTo: extractText(props['Converted To']),
    lastSyncedAt: new Date().toISOString(),
  }
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

// =============================================================================
// Pull Sync Functions (Notion → prjct)
// =============================================================================

export interface PullResult<T> {
  items: T[]
  newCount: number
  updatedCount: number
  errors: string[]
}

/**
 * Pull shipped features from Notion
 * Returns new and updated features from Notion that don't exist or are newer in Notion
 */
export async function pullShippedFeatures(
  config: NotionIntegrationConfig,
  existingFeatures: ShippedFeature[]
): Promise<PullResult<ShippedFeature>> {
  const result: PullResult<ShippedFeature> = {
    items: [],
    newCount: 0,
    updatedCount: 0,
    errors: [],
  }

  if (!config.enabled || !config.databases.shipped) {
    return result
  }

  if (!notionClient.isReady()) {
    result.errors.push('Notion client not ready')
    return result
  }

  try {
    const pages = await notionClient.queryDatabase(config.databases.shipped)

    // Create lookup map by prjctId and notionPageId
    const existingByPrjctId = new Map(
      existingFeatures.filter((f) => f.id).map((f) => [f.id, f])
    )
    const existingByNotionId = new Map(
      existingFeatures.filter((f) => f.notionPageId).map((f) => [f.notionPageId, f])
    )

    for (const page of pages) {
      const parsed = parseShippedFeature(page.id, page.properties)

      // Skip if no name (invalid entry)
      if (!parsed.name) continue

      // Check if exists locally
      const existingByPrjct = parsed.id ? existingByPrjctId.get(parsed.id) : undefined
      const existingByNotion = existingByNotionId.get(page.id)
      const existing = existingByPrjct || existingByNotion

      if (existing) {
        // Update existing - merge with local data
        const merged: ShippedFeature = {
          ...existing,
          ...parsed,
          id: existing.id || parsed.id || crypto.randomUUID(),
          notionPageId: page.id,
          lastSyncedAt: new Date().toISOString(),
        }
        result.items.push(merged)
        result.updatedCount++
      } else {
        // New from Notion - create new entry
        const newFeature: ShippedFeature = {
          id: parsed.id || crypto.randomUUID(),
          name: parsed.name,
          shippedAt: parsed.shippedAt || new Date().toISOString(),
          version: parsed.version || '0.0.0',
          description: parsed.description,
          type: parsed.type,
          duration: parsed.duration,
          codeMetrics: parsed.codeMetrics,
          notionPageId: page.id,
          lastSyncedAt: new Date().toISOString(),
        }
        result.items.push(newFeature)
        result.newCount++
      }
    }

    return result
  } catch (error) {
    result.errors.push((error as Error).message)
    return result
  }
}

/**
 * Pull ideas from Notion
 * Returns new and updated ideas from Notion
 */
export async function pullIdeas(
  config: NotionIntegrationConfig,
  existingIdeas: Idea[]
): Promise<PullResult<Idea>> {
  const result: PullResult<Idea> = {
    items: [],
    newCount: 0,
    updatedCount: 0,
    errors: [],
  }

  if (!config.enabled || !config.databases.ideas) {
    return result
  }

  if (!notionClient.isReady()) {
    result.errors.push('Notion client not ready')
    return result
  }

  try {
    const pages = await notionClient.queryDatabase(config.databases.ideas)

    // Create lookup map
    const existingByPrjctId = new Map(
      existingIdeas.filter((i) => i.id).map((i) => [i.id, i])
    )
    const existingByNotionId = new Map(
      existingIdeas.filter((i) => i.notionPageId).map((i) => [i.notionPageId, i])
    )

    for (const page of pages) {
      const parsed = parseIdea(page.id, page.properties)

      // Skip if no text (invalid entry)
      if (!parsed.text) continue

      // Check if exists locally
      const existingByPrjct = parsed.id ? existingByPrjctId.get(parsed.id) : undefined
      const existingByNotion = existingByNotionId.get(page.id)
      const existing = existingByPrjct || existingByNotion

      if (existing) {
        // Update existing
        const merged: Idea = {
          ...existing,
          ...parsed,
          id: existing.id || parsed.id || crypto.randomUUID(),
          notionPageId: page.id,
          lastSyncedAt: new Date().toISOString(),
        }
        result.items.push(merged)
        result.updatedCount++
      } else {
        // New from Notion
        const newIdea: Idea = {
          id: parsed.id || crypto.randomUUID(),
          text: parsed.text,
          status: parsed.status || 'pending',
          priority: parsed.priority || 'medium',
          tags: parsed.tags || [],
          addedAt: parsed.addedAt || new Date().toISOString(),
          details: parsed.details,
          convertedTo: parsed.convertedTo,
          notionPageId: page.id,
          lastSyncedAt: new Date().toISOString(),
        }
        result.items.push(newIdea)
        result.newCount++
      }
    }

    return result
  } catch (error) {
    result.errors.push((error as Error).message)
    return result
  }
}

/**
 * Bidirectional sync - combines push and pull
 * Uses "last edit wins" strategy based on lastSyncedAt
 */
export async function bidirectionalSync(
  projectId: string,
  config: NotionIntegrationConfig,
  localData: {
    shipped?: ShippedFeature[]
    ideas?: Idea[]
  }
): Promise<{
  pushed: { shipped: number; ideas: number }
  pulled: { shipped: PullResult<ShippedFeature>; ideas: PullResult<Idea> }
}> {
  const results = {
    pushed: { shipped: 0, ideas: 0 },
    pulled: {
      shipped: { items: [], newCount: 0, updatedCount: 0, errors: [] } as PullResult<ShippedFeature>,
      ideas: { items: [], newCount: 0, updatedCount: 0, errors: [] } as PullResult<Idea>,
    },
  }

  // 1. Pull from Notion first (to get latest)
  if (localData.shipped) {
    results.pulled.shipped = await pullShippedFeatures(config, localData.shipped)
  }
  if (localData.ideas) {
    results.pulled.ideas = await pullIdeas(config, localData.ideas)
  }

  // 2. Push local items that don't have notionPageId (new local items)
  if (localData.shipped && config.databases.shipped) {
    for (const feature of localData.shipped) {
      if (!feature.notionPageId) {
        const result = await syncShippedFeature(projectId, feature, config)
        if (result.success) {
          results.pushed.shipped++
        }
      }
    }
  }

  if (localData.ideas && config.databases.ideas) {
    for (const idea of localData.ideas) {
      if (!idea.notionPageId) {
        const result = await syncIdea(projectId, idea, config)
        if (result.success) {
          results.pushed.ideas++
        }
      }
    }
  }

  return results
}

// =============================================================================
// Dashboard Metrics Update
// =============================================================================

/**
 * Update dashboard page with current metrics
 * Called after sync operations
 */
export async function updateDashboardMetrics(
  config: NotionIntegrationConfig,
  projectName: string,
  metrics: DashboardMetrics
): Promise<{ success: boolean; error?: string }> {
  if (!config.enabled || !config.dashboardPageId) {
    return { success: false, error: 'Dashboard not configured' }
  }

  if (!notionClient.isReady()) {
    return { success: false, error: 'Notion client not ready' }
  }

  try {
    const content = getDashboardContent(projectName, config.databases, metrics)

    // Update dashboard page content
    await notionClient.updatePageContent(config.dashboardPageId, content)

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
    }
  }
}

/**
 * Calculate metrics from local data
 */
export function calculateMetrics(data: {
  shipped?: ShippedFeature[]
  ideas?: Idea[]
  tasks?: Array<{ status?: string; completed?: boolean }>
  roadmap?: Array<{ progress?: number }>
}): DashboardMetrics {
  const shippedCount = data.shipped?.length || 0
  const ideasPending = data.ideas?.filter((i) => i.status === 'pending').length || 0
  const tasksActive = data.tasks?.filter((t) => !t.completed && t.status !== 'completed').length || 0

  // Calculate roadmap progress as average of all features
  let roadmapProgress = 0
  if (data.roadmap && data.roadmap.length > 0) {
    const totalProgress = data.roadmap.reduce((sum, f) => sum + (f.progress || 0), 0)
    roadmapProgress = Math.round(totalProgress / data.roadmap.length)
  }

  return {
    shippedCount,
    ideasPending,
    tasksActive,
    roadmapProgress,
  }
}
