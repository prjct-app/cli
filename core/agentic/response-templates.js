/**
 * Response Templates
 * Minimal output templates for all commands
 * Rule: < 4 lines, always actionable
 *
 * OPTIMIZATION (P0.3): Minimal Output
 * - Concise responses (< 4 lines)
 * - Always suggest next action
 * - Use symbols for status, not words
 *
 * Source: Claude Code, Kiro patterns
 */

/**
 * Format duration from milliseconds or ISO strings
 * @param {number|string|Date} start - Start time
 * @param {number|string|Date} end - End time (defaults to now)
 * @returns {string} Human-readable duration
 */
function formatDuration(start, end = new Date()) {
  const startMs = new Date(start).getTime()
  const endMs = new Date(end).getTime()
  const diffMs = endMs - startMs

  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Truncate text to max length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
function truncate(text, maxLength = 40) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Response templates for each command
 * Each template is a function that returns minimal formatted output
 */
const templates = {
  /**
   * /p:done - Task completed
   */
  done: ({ task, duration, nextTask }) => {
    let output = `✓ '${truncate(task)}' (${duration})`
    if (nextTask) {
      output += `\n→ Next: '${truncate(nextTask)}'`
    }
    output += '\n\n/p:ship to release'
    return output
  },

  /**
   * /p:now - Current task set/shown
   */
  now: ({ task, started, isNew }) => {
    if (!task) {
      return `No active task\n→ /p:now "task" to start`
    }
    if (isNew) {
      return `🎯 Started: '${truncate(task)}'\n→ /p:done when complete`
    }
    return `🎯 Working on: '${truncate(task)}'\n⏱️ ${started || 'just now'}\n→ /p:done when complete`
  },

  /**
   * /p:next - Priority queue
   */
  next: ({ tasks, total }) => {
    if (!tasks || tasks.length === 0) {
      return `Queue empty\n→ /p:feature or /p:idea to add`
    }
    const top3 = tasks.slice(0, 3).map((t, i) =>
      `${i + 1}. ${truncate(t.name, 35)}`
    ).join('\n')
    const more = total > 3 ? `\n+${total - 3} more` : ''
    return `${top3}${more}\n\n/p:now 1 to start`
  },

  /**
   * /p:ship - Feature shipped
   */
  ship: ({ feature, agent, duration, version }) => {
    let output = `🚀 Shipped: '${truncate(feature)}'`
    if (agent) output += ` (${agent})`
    if (duration) output += ` | ${duration}`
    if (version) output += ` | v${version}`
    output += '\n→ /compact recommended'
    return output
  },

  /**
   * /p:idea - Idea captured
   */
  idea: ({ idea, addedToQueue }) => {
    let output = `💡 Captured: '${truncate(idea)}'`
    if (addedToQueue) {
      output += '\n→ Added to queue'
    }
    output += '\n\n/p:next to see queue'
    return output
  },

  /**
   * /p:feature - Feature added
   */
  feature: ({ feature, tasks, impact, effort }) => {
    let output = `📋 Feature: '${truncate(feature)}'`
    if (tasks) output += ` (${tasks} tasks)`
    if (impact) output += `\nImpact: ${impact}`
    if (effort) output += ` | Effort: ${effort}`
    output += '\n\n/p:now to start'
    return output
  },

  /**
   * /p:bug - Bug reported
   */
  bug: ({ description, priority, addedAt }) => {
    const priorityIcon = {
      'critical': '🔴',
      'high': '🟠',
      'medium': '🟡',
      'low': '🟢'
    }[priority] || '🟡'

    let output = `${priorityIcon} Bug: '${truncate(description)}'\nPriority: ${priority}`
    if (addedAt) {
      output += ` | Added: ${addedAt}`
    }
    output += '\n\n/p:now to fix'
    return output
  },

  /**
   * /p:pause - Task paused
   */
  pause: ({ task, duration }) => {
    return `⏸️ Paused: '${truncate(task)}' (${duration})\n→ /p:resume to continue`
  },

  /**
   * /p:resume - Task resumed
   */
  resume: ({ task, pausedFor }) => {
    return `▶️ Resumed: '${truncate(task)}'\nPaused for: ${pausedFor}\n→ /p:done when complete`
  },

  /**
   * /p:recap - Project overview
   */
  recap: ({ shipped, inProgress, queued, momentum }) => {
    const momentumIcon = {
      'high': '🔥',
      'medium': '✨',
      'low': '💤'
    }[momentum] || '✨'

    return `${momentumIcon} ${shipped} shipped | ${inProgress ? '1 active' : '0 active'} | ${queued} queued`
  },

  /**
   * /p:progress - Progress metrics
   */
  progress: ({ period, shipped, velocity, trend }) => {
    const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→'
    return `📊 ${period}: ${shipped} shipped\nVelocity: ${velocity}/week ${trendIcon}`
  },

  /**
   * /p:analyze - Analysis complete
   */
  analyze: ({ stack, files, agents }) => {
    return `🔍 Analyzed: ${stack}\n${files} files | ${agents} agents generated\n\n/p:sync to update`
  },

  /**
   * /p:sync - Sync complete
   */
  sync: ({ updated, agents }) => {
    return `🔄 Synced: ${updated} files updated\n${agents} agents refreshed`
  },

  /**
   * /p:help - Help shown
   */
  help: ({ context, suggestions }) => {
    const sugs = suggestions.slice(0, 3).map(s => `• ${s}`).join('\n')
    return `📚 ${context}\n\n${sugs}`
  },

  /**
   * /p:suggest - Suggestions
   */
  suggest: ({ urgency, suggestion, command }) => {
    const urgencyIcon = {
      'high': '🔥',
      'medium': '💡',
      'low': '✨'
    }[urgency] || '💡'

    return `${urgencyIcon} ${suggestion}\n→ ${command}`
  },

  /**
   * /p:spec - Spec created/updated
   */
  spec: ({ name, status, tasks, requirements, isNew }) => {
    let output = isNew
      ? `📋 Created spec: '${truncate(name)}'`
      : `📋 Updated spec: '${truncate(name)}'`

    if (requirements) output += `\n${requirements} requirements`
    if (tasks) output += ` | ${tasks} tasks`
    if (status) output += ` | Status: ${status}`

    output += '\n\n→ Review and approve to start'
    return output
  },

  /**
   * Generic success response
   */
  success: ({ message, nextAction }) => {
    let output = `✓ ${message}`
    if (nextAction) {
      output += `\n→ ${nextAction}`
    }
    return output
  },

  /**
   * Generic error response
   */
  error: ({ error, suggestion }) => {
    let output = `❌ ${error}`
    if (suggestion) {
      output += `\n→ ${suggestion}`
    }
    return output
  }
}

/**
 * Format a response using the appropriate template
 *
 * @param {string} commandName - Command name
 * @param {Object} data - Data for the template
 * @returns {string} Formatted response
 */
function format(commandName, data) {
  const template = templates[commandName]
  if (!template) {
    // Fallback to generic success/error
    if (data.error) {
      return templates.error(data)
    }
    return templates.success(data)
  }

  return template(data)
}

/**
 * Check if response exceeds recommended length
 * @param {string} response - Response text
 * @returns {boolean} True if too long
 */
function isTooLong(response) {
  const lines = response.split('\n').filter(l => l.trim())
  return lines.length > 4
}

module.exports = {
  format,
  templates,
  formatDuration,
  truncate,
  isTooLong
}
