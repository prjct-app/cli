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

const { EventTypes } = require('../bus')
const { HookPoints } = require('../plugin/hooks')

const plugin = {
  name: 'webhook',
  version: '1.0.0',
  description: 'Send HTTP webhooks on events',

  // Plugin state
  config: null,
  enabled: false,

  /**
   * Activate plugin
   */
  async activate({ config }) {
    this.config = config

    if (!config.url) {
      console.warn('[webhook] No URL configured, plugin disabled')
      return
    }

    this.enabled = true
    this.events = config.events || [
      EventTypes.SESSION_COMPLETED,
      EventTypes.FEATURE_SHIPPED,
      EventTypes.SNAPSHOT_CREATED
    ]
  },

  /**
   * Deactivate plugin
   */
  async deactivate() {
    this.enabled = false
  },

  /**
   * Event handlers
   */
  events: {
    [EventTypes.SESSION_COMPLETED]: async function(data) {
      await plugin.sendWebhook('session.completed', data)
    },

    [EventTypes.FEATURE_SHIPPED]: async function(data) {
      await plugin.sendWebhook('feature.shipped', data)
    },

    [EventTypes.SNAPSHOT_CREATED]: async function(data) {
      await plugin.sendWebhook('snapshot.created', data)
    },

    [EventTypes.TASK_COMPLETED]: async function(data) {
      await plugin.sendWebhook('task.completed', data)
    }
  },

  /**
   * Hook handlers
   */
  hooks: {
    [HookPoints.AFTER_FEATURE_SHIP]: async function(data) {
      await plugin.sendWebhook('feature.shipped', {
        feature: data.feature,
        version: data.version,
        timestamp: data.timestamp
      })
    }
  },

  /**
   * Send webhook request
   * @param {string} event - Event type
   * @param {Object} data - Event data
   */
  async sendWebhook(event, data) {
    if (!this.enabled || !this.config.url) return

    // Check if this event should be sent
    if (this.config.events && !this.config.events.includes(event)) {
      return
    }

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      source: 'prjct-cli',
      data
    }

    try {
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'prjct-cli/webhook'
      }

      // Add signature if secret is configured
      if (this.config.secret) {
        const crypto = require('crypto')
        const signature = crypto
          .createHmac('sha256', this.config.secret)
          .update(JSON.stringify(payload))
          .digest('hex')
        headers['X-Prjct-Signature'] = `sha256=${signature}`
      }

      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        console.error(`[webhook] Request failed: ${response.status}`)
      }
    } catch (error) {
      console.error(`[webhook] Error sending webhook:`, error.message)
    }
  }
}

module.exports = plugin
