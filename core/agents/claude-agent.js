/**
 * Claude Code Agent Adapter
 * Implements prjct commands for Claude Code environment
 */

const fs = require('fs').promises
const path = require('path')

class ClaudeAgent {
  constructor() {
    this.name = 'Claude Code'
    this.type = 'claude'
  }

  /**
   * Format response for Claude Code with rich markdown and emojis
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

    const emoji = emojis[type] || emojis.info


    return `${emoji} **${message}**`
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
   * Format task list with rich formatting
   */
  formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.formatResponse('No tasks in queue', 'info')
    }

    let output = '📋 **Task Queue**\n\n'
    tasks.forEach((task, index) => {
      output += `${index + 1}. ${task}\n`
    })

    return output
  }

  /**
   * Format recap with rich formatting
   */
  formatRecap(data) {
    const output = `
📊 **Project Recap**

🎯 **Current Task**: ${data.currentTask || 'None'}
🚀 **Shipped Features**: ${data.shippedCount} total
📝 **Queued Tasks**: ${data.queuedCount}
💡 **Ideas Captured**: ${data.ideasCount}

${data.recentActivity ? '**Recent Activity**:\n' + data.recentActivity : ''}

_Keep shipping! Every feature counts!_ 💪
        `.trim()

    return output
  }

  /**
   * Format progress report
   */
  formatProgress(data) {
    const trend =
      data.velocity > data.previousVelocity
        ? '📈'
        : data.velocity < data.previousVelocity
          ? '📉'
          : '➡️'

    const output = `
📊 **Progress Report** (${data.period})

**Features Shipped**: ${data.count}
**Velocity**: ${data.velocity.toFixed(1)} features/day ${trend}

${data.recentFeatures ? '**Recent Wins**:\n' + data.recentFeatures : ''}

${data.motivationalMessage}
        `.trim()

    return output
  }

  /**
   * Get help content based on issue type
   */
  getHelpContent(issue) {
    const helps = {
      debugging: `
🔍 **Debugging Strategy**:
1. **Isolate**: Comment out code until error disappears
2. **Log**: Add console.log at key points
3. **Simplify**: Create minimal reproduction
4. **Research**: Search for exact error message
5. **Break**: Take a walk, fresh perspective helps!
            `,
      design: `
🎨 **Design Approach**:
1. **Start Simple**: Basic version first
2. **User First**: What problem does this solve?
3. **Iterate**: Ship v1, improve based on feedback
4. **Patterns**: Look for similar solutions
5. **Validate**: Show mockup before building
            `,
      performance: `
⚡ **Performance Strategy**:
1. **Measure First**: Profile before optimizing
2. **Biggest Wins**: Focus on slowest parts
3. **Cache**: Store expensive computations
4. **Lazy Load**: Defer non-critical work
5. **Monitor**: Track improvements
            `,
      default: `
💡 **General Strategy**:
1. **Break It Down**: Divide into smaller tasks
2. **Start Small**: Implement simplest part first
3. **Test Often**: Verify each step works
4. **Document**: Write down what you learn
5. **Ship It**: Perfect is the enemy of done
            `,
    }

    const helpType =
      Object.keys(helps).find((key) => issue.toLowerCase().includes(key)) || 'default'

    return helps[helpType]
  }

  /**
   * Suggest next action based on context
   */
  suggestNextAction(context) {
    const suggestions = {
      taskCompleted: '💡 Ready for the next challenge? Use `/p:next` to see your queue!',
      featureShipped: '🎉 Awesome! Take a moment to celebrate, then `/p:now` for next focus!',
      ideaCaptured: '💭 Great idea! Use `/p:now` to start working on it!',
      initialized: '🚀 All set! Start with `/p:now "your first task"`',
      stuck: '💪 You got this! Break it down with `/p:idea` for each step',
    }

    return suggestions[context] || '→ What would you like to work on next?'
  }
}

module.exports = ClaudeAgent
