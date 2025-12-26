/**
 * Webhook Plugin for prjct-cli
 *
 * Sends HTTP POST requests to configured webhooks on events.
 * Useful for integrating with Slack, Discord, Zapier, etc.
 *
 * @version 1.0.0
 *
 * Configuration in prjct.config.json:
 * {
 *   "plugins": ["webhook"],
 *   "webhook": {
 *     "url": "https://hooks.example.com/...",
 *     "events": ["session.completed", "feature.shipped"],
 *     "secret": "optional-signing-secret"
 *   }
 * }
 */

import crypto from 'crypto'
import { EventTypes } from '../bus'
import { HookPoints } from '../plugin/hooks'

interface WebhookConfig {
  url?: string
  events?: string[]
  secret?: string
}

interface PluginContext {
  config: WebhookConfig
}

interface WebhookPayload {
  event: string
  timestamp: string
  source: string
  data: unknown
}

const plugin = {
  name: 'webhook',
  version: '1.0.0',
  description: 'Send HTTP webhooks on events',

  // Plugin state
  config: null as WebhookConfig | null,
  enabled: false,
  enabledEvents: [] as string[],

  /**
   * Activate plugin
   */
  async activate({ config }: PluginContext): Promise<void> {
    plugin.config = config

    if (!config.url) {
      console.warn('[webhook] No URL configured, plugin disabled')
      return
    }

    plugin.enabled = true
    plugin.enabledEvents = config.events || [
      EventTypes.SESSION_COMPLETED,
      EventTypes.FEATURE_SHIPPED,
      EventTypes.SNAPSHOT_CREATED
    ]
  },

  /**
   * Deactivate plugin
   */
  async deactivate(): Promise<void> {
    plugin.enabled = false
  },

  /**
   * Event handlers
   */
  events: {
    [EventTypes.SESSION_COMPLETED]: async function(data: unknown): Promise<void> {
      await plugin.sendWebhook('session.completed', data)
    },

    [EventTypes.FEATURE_SHIPPED]: async function(data: unknown): Promise<void> {
      await plugin.sendWebhook('feature.shipped', data)
    },

    [EventTypes.SNAPSHOT_CREATED]: async function(data: unknown): Promise<void> {
      await plugin.sendWebhook('snapshot.created', data)
    },

    [EventTypes.TASK_COMPLETED]: async function(data: unknown): Promise<void> {
      await plugin.sendWebhook('task.completed', data)
    }
  },

  /**
   * Hook handlers
   */
  hooks: {
    [HookPoints.AFTER_FEATURE_SHIP]: async function(data: { feature: string; version: string; timestamp: string }): Promise<void> {
      await plugin.sendWebhook('feature.shipped', {
        feature: data.feature,
        version: data.version,
        timestamp: data.timestamp
      })
    }
  },

  /**
   * Send webhook request
   */
  async sendWebhook(event: string, data: unknown): Promise<void> {
    if (!plugin.enabled || !plugin.config?.url) return

    // Check if this event should be sent
    if (plugin.config.events && !plugin.config.events.includes(event)) {
      return
    }

    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      source: 'prjct-cli',
      data
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'prjct-cli/webhook'
      }

      // Add signature if secret is configured
      if (plugin.config.secret) {
        const signature = crypto
          .createHmac('sha256', plugin.config.secret)
          .update(JSON.stringify(payload))
          .digest('hex')
        headers['X-Prjct-Signature'] = `sha256=${signature}`
      }

      const response = await fetch(plugin.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error(`[webhook] Request failed: ${response.status}`)
      }
    } catch (error) {
      console.error(`[webhook] Error sending webhook:`, (error as Error).message)
    }
  }
}

export default plugin
