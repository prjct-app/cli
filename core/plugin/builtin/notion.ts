/**
 * Notion Plugin for prjct-cli
 *
 * Syncs prjct data to Notion databases on events.
 * Activated when project has integrations.notion.enabled = true
 *
 * @version 1.0.0
 *
 * Configuration in GlobalConfig.integrations.notion:
 * {
 *   "enabled": true,
 *   "databases": {
 *     "shipped": "notion-db-id",
 *     "ideas": "notion-db-id"
 *   },
 *   "syncOn": { "ship": true, "idea": true }
 * }
 */

import { HookPoints } from '../hooks'
import type { NotionIntegrationConfig } from '../../types/integrations'
import type { ShippedFeature, Idea } from '../../types/storage'
import { notionClient, syncShippedFeature, syncIdea } from '../../integrations/notion'

interface NotionPluginContext {
  projectId: string
  config: NotionIntegrationConfig
  apiToken?: string
}

const plugin = {
  name: 'notion',
  version: '1.0.0',
  description: 'Sync prjct data to Notion',

  // Plugin state
  enabled: false,
  projectId: null as string | null,
  config: null as NotionIntegrationConfig | null,

  /**
   * Activate plugin
   */
  async activate(context: NotionPluginContext): Promise<void> {
    const { projectId, config, apiToken } = context

    if (!config?.enabled) {
      return
    }

    // Initialize Notion client
    notionClient.initialize(config, apiToken || process.env.NOTION_TOKEN)

    if (!notionClient.isReady()) {
      console.warn('[notion] API token not configured, plugin disabled')
      return
    }

    plugin.enabled = true
    plugin.projectId = projectId
    plugin.config = config
  },

  /**
   * Deactivate plugin
   */
  async deactivate(): Promise<void> {
    plugin.enabled = false
    plugin.projectId = null
    plugin.config = null
  },

  /**
   * Hook handlers
   */
  hooks: {
    /**
     * Sync shipped feature to Notion after ship
     */
    [HookPoints.AFTER_FEATURE_SHIP]: async function (data: {
      feature: ShippedFeature
      projectId?: string
    }): Promise<void> {
      if (!plugin.enabled || !plugin.config || !plugin.projectId) return
      if (!plugin.config.syncOn?.ship) return

      try {
        const result = await syncShippedFeature(
          data.projectId || plugin.projectId,
          data.feature,
          plugin.config
        )

        if (result.success) {
          console.log(`[notion] Synced: ${data.feature.name} (${result.action})`)
        } else if (result.error) {
          console.warn(`[notion] Sync failed: ${result.error}`)
        }
      } catch (error) {
        // Graceful degradation - don't fail the ship
        console.warn('[notion] Sync error:', (error as Error).message)
      }
    },

    /**
     * Sync idea to Notion after capture
     */
    [HookPoints.AFTER_IDEA_CAPTURE]: async function (data: {
      idea: Idea
      projectId?: string
    }): Promise<void> {
      if (!plugin.enabled || !plugin.config || !plugin.projectId) return
      if (!plugin.config.syncOn?.idea) return

      try {
        const result = await syncIdea(
          data.projectId || plugin.projectId,
          data.idea,
          plugin.config
        )

        if (result.success) {
          console.log(`[notion] Synced idea: ${data.idea.text.slice(0, 30)}... (${result.action})`)
        } else if (result.error) {
          console.warn(`[notion] Sync failed: ${result.error}`)
        }
      } catch (error) {
        // Graceful degradation - don't fail the idea capture
        console.warn('[notion] Sync error:', (error as Error).message)
      }
    },

    /**
     * Sync task completion (optional)
     */
    [HookPoints.AFTER_TASK_COMPLETE]: async function (data: {
      taskName?: string
      projectId?: string
    }): Promise<void> {
      if (!plugin.enabled || !plugin.config || !plugin.projectId) return
      if (!plugin.config.syncOn?.done) return

      // Task sync is optional and less critical
      // Could update task status in Notion if database exists
      if (data.taskName) {
        console.log(`[notion] Task completed: ${data.taskName}`)
      }
    },
  },

  /**
   * Check if plugin is active
   */
  isActive(): boolean {
    return plugin.enabled && plugin.config?.enabled === true
  },

  /**
   * Get current sync status
   */
  getStatus(): {
    enabled: boolean
    databases: number
    lastSync?: string
  } {
    const dbCount = plugin.config?.databases
      ? Object.values(plugin.config.databases).filter(Boolean).length
      : 0

    return {
      enabled: plugin.enabled,
      databases: dbCount,
      lastSync: plugin.config?.lastSyncAt,
    }
  },
}

export default plugin
