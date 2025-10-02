/**
 * Claude Code Agent Adapter
 * Implements prjct commands for Claude Code environment
 */

const fs = require('fs').promises

class ClaudeAgent {
  constructor() {
    this.name = 'Claude Code'
    this.type = 'claude'
  }

  /**
   * Format response - minimal, actionable
   */
  formatResponse(message, type = 'info') {
    const emojis = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      celebrate: '🎉',
      ship: '🚀',
      focus: '🎯',
      idea: '💡',
      progress: '📊',
      task: '📝',
    }

    return `${emojis[type] || emojis.info} ${message}`
  }

  /**
   * Read file using MCP if available, fallback to fs
   */
  async readFile(filePath) {
    try {
      if (global.mcp && global.mcp.filesystem) {
        return await global.mcp.filesystem.read(filePath)
      }
    } catch (e) {

    }

    return await fs.readFile(filePath, 'utf8')
  }

  /**
   * Write file using MCP if available, fallback to fs
   */
  async writeFile(filePath, content) {
    try {
      if (global.mcp && global.mcp.filesystem) {
        return await global.mcp.filesystem.write(filePath, content)
      }
    } catch (e) {

    }

    await fs.writeFile(filePath, content, 'utf8')
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath) {
    try {
      if (global.mcp && global.mcp.filesystem) {
        return await global.mcp.filesystem.list(dirPath)
      }
    } catch (e) {

    }

    return await fs.readdir(dirPath)
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true })
  }

  /**
   * Get current timestamp in ISO format
   */
  getTimestamp() {
    return new Date().toISOString()
  }

  /**
   * Format task list - data only
   */
  formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
      return '📋 No tasks queued'
    }

    return '📋 Queue:\n' + tasks.map((t, i) => `${i + 1}. ${t}`).join('\n')
  }

  /**
   * Format recap - metrics only
   */
  formatRecap(data) {
    return `📊 Recap

🎯 Current: ${data.currentTask || 'None'}
🚀 Shipped: ${data.shippedCount}
📝 Queue: ${data.queuedCount}
💡 Ideas: ${data.ideasCount}
${data.recentActivity ? '\n' + data.recentActivity : ''}`
  }

  /**
   * Format progress - data only
   */
  formatProgress(data) {
    const trend =
      data.velocity > data.previousVelocity ? '📈' : data.velocity < data.previousVelocity ? '📉' : '➡️'

    return `📊 ${data.period}

Shipped: ${data.count}
Velocity: ${data.velocity.toFixed(1)}/day ${trend}
${data.recentFeatures || ''}`
  }

  /**
   * Get help - actionable steps only
   */
  getHelpContent(issue) {
    const helps = {
      debugging: '🔍 1. Isolate code causing error\n2. Add logs at key points\n3. Search exact error message',
      design: '🎨 1. Define problem clearly\n2. Start with simplest solution\n3. Ship MVP, iterate',
      performance:
        '⚡ 1. Profile/measure first\n2. Optimize slowest parts\n3. Cache expensive operations',
      default: '💡 1. Break into smaller tasks\n2. Start with simplest part\n3. Ship it',
    }

    const helpType = Object.keys(helps).find((key) => issue.toLowerCase().includes(key)) || 'default'
    return helps[helpType]
  }

  /**
   * Suggest next action - conversational prompts
   */
  suggestNextAction(context) {
    const suggestions = {
      taskCompleted: `What's next?
• "start [task]" → Begin working
• "ship feature" → Track & celebrate
• "add idea" → Brainstorm

Or: /p:now | /p:ship | /p:idea`,

      featureShipped: `Keep the momentum!
• "start next task" → Keep building
• "see progress" → View stats
• "plan ahead" → Strategic thinking

Or: /p:now | /p:recap | /p:roadmap`,

      ideaCaptured: `Ready to start?
• "start this" → Begin now
• "plan more" → Keep brainstorming
• "see ideas" → View backlog

Or: /p:now | /p:idea | /p:recap`,

      initialized: `Ready to start? Tell me what you want to build!

Or type /p:help to see all options`,

      stuck: `Let's break it down:
• "start the first part"
• "add as tasks"
• "think more"

Or: /p:now | /p:task | /p:idea`,
    }

    return suggestions[context] || `What would you like to do?

Type /p:help to see all options`
  }

  /**
   * Detect user intent from natural language
   */
  detectIntent(message) {
    const msg = message.toLowerCase()

    // Start/begin task
    if (/^(start|empez|begin|quiero|want|let'?s|voy)/i.test(msg)) {
      return { intent: 'start', command: 'now' }
    }

    // Complete task
    if (/^(done|termin|finish|acab|complete|listo|ya)/i.test(msg)) {
      return { intent: 'complete', command: 'done' }
    }

    // Ship feature
    if (/^(ship|deploy|launch|public)/i.test(msg)) {
      return { intent: 'ship', command: 'ship' }
    }

    // Capture idea
    if (/^(idea|think|thought|ocurr|tengo)/i.test(msg)) {
      return { intent: 'idea', command: 'idea' }
    }

    // View status/progress
    if (
      /(show|see|view|muestra|ver).*(progress|status|recap|avance)/i.test(msg) ||
      /^(progress|status|recap|avance)/i.test(msg)
    ) {
      return { intent: 'status', command: 'recap' }
    }

    // Stuck/help
    if (/^(stuck|help|ayud|atascado|perdido)/i.test(msg)) {
      return { intent: 'stuck', command: 'stuck' }
    }

    // View queue/next
    if (/(what|que).*(next|sigue|after|despues)/i.test(msg) || /^(next|sigue)/i.test(msg)) {
      return { intent: 'next', command: 'next' }
    }

    return { intent: 'unknown', command: null }
  }
}

module.exports = ClaudeAgent
