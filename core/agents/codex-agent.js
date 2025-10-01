/**
 * OpenAI Codex Agent Adapter
 * Implements prjct commands for OpenAI Codex environment
 */

const fs = require('fs').promises
const path = require('path')

class CodexAgent {
  constructor() {
    this.name = 'OpenAI Codex'
    this.type = 'codex'
  }

  /**
   * Format response for Codex with structured output
   * Codex runs in sandboxed environments, so we use clear text formatting
   */
  formatResponse(message, type = 'info') {
    const prefixes = {
      success: '[SUCCESS]',
      error: '[ERROR]',
      warning: '[WARNING]',
      info: '[INFO]',
      celebrate: '[SHIPPED]',
      ship: '[FEATURE]',
      focus: '[FOCUS]',
      idea: '[IDEA]',
      progress: '[PROGRESS]',
      task: '[TASK]',
    }

    const prefix = prefixes[type] || prefixes.info


    return `${prefix} ${message}`
  }

  /**
   * Read file using native fs (Codex doesn't have MCP)
   */
  async readFile(filePath) {
    try {
      return await fs.readFile(filePath, 'utf8')
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error.message}`)
    }
  }

  /**
   * Write file using native fs
   */
  async writeFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content, 'utf8')
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error.message}`)
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath) {
    try {
      return await fs.readdir(dirPath)
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error.message}`)
    }
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
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`)
    }
  }

  /**
   * Get current timestamp in ISO format
   */
  getTimestamp() {
    return new Date().toISOString()
  }

  /**
   * Format task list with structured output
   */
  formatTaskList(tasks) {
    if (!tasks || tasks.length === 0) {
      return this.formatResponse('No tasks in queue', 'info')
    }

    let output = 'TASK QUEUE:\n'
    output += '===========\n'
    tasks.forEach((task, index) => {
      output += `  ${index + 1}. ${task}\n`
    })

    return output
  }

  /**
   * Format recap with structured output
   */
  formatRecap(data) {
    const output = `
PROJECT RECAP
=============

Current Task: ${data.currentTask || 'None'}
Shipped Features: ${data.shippedCount} total
Queued Tasks: ${data.queuedCount}
Ideas Captured: ${data.ideasCount}

${data.recentActivity ? 'Recent Activity:\n' + data.recentActivity : ''}

Status: ${data.shippedCount > 0 ? 'Productive' : 'Getting Started'}
        `.trim()

    return output
  }

  /**
   * Format progress report
   */
  formatProgress(data) {
    const trend =
      data.velocity > data.previousVelocity
        ? 'UP'
        : data.velocity < data.previousVelocity
          ? 'DOWN'
          : 'STEADY'

    const output = `
PROGRESS REPORT (${data.period.toUpperCase()})
=====================================

Features Shipped: ${data.count}
Velocity: ${data.velocity.toFixed(1)} features/day
Trend: ${trend}

${data.recentFeatures ? 'Recent Features:\n' + data.recentFeatures : ''}

${data.motivationalMessage}
        `.trim()

    return output
  }

  /**
   * Get help content based on issue type
   * Structured format for Codex readability
   */
  getHelpContent(issue) {
    const helps = {
      debugging: `
DEBUGGING STRATEGY:
===================
1. ISOLATE - Comment out code until error disappears
2. LOG - Add console.log at key points
3. SIMPLIFY - Create minimal reproduction
4. RESEARCH - Search for exact error message
5. BREAK - Take a walk, fresh perspective helps
            `,
      design: `
DESIGN APPROACH:
================
1. START SIMPLE - Basic version first
2. USER FIRST - What problem does this solve?
3. ITERATE - Ship v1, improve based on feedback
4. PATTERNS - Look for similar solutions
5. VALIDATE - Show mockup before building
            `,
      performance: `
PERFORMANCE STRATEGY:
====================
1. MEASURE FIRST - Profile before optimizing
2. BIGGEST WINS - Focus on slowest parts
3. CACHE - Store expensive computations
4. LAZY LOAD - Defer non-critical work
5. MONITOR - Track improvements
            `,
      default: `
GENERAL STRATEGY:
================
1. BREAK IT DOWN - Divide into smaller tasks
2. START SMALL - Implement simplest part first
3. TEST OFTEN - Verify each step works
4. DOCUMENT - Write down what you learn
5. SHIP IT - Perfect is the enemy of done
            `,
    }

    const helpType =
      Object.keys(helps).find((key) => issue.toLowerCase().includes(key)) || 'default'

    return helps[helpType]
  }

  /**
   * Suggest next action based on context
   * Clear, actionable suggestions for Codex
   */
  suggestNextAction(context) {
    const suggestions = {
      taskCompleted: 'NEXT: Check task queue with /p:next',
      featureShipped: 'NEXT: Set new focus with /p:now [task]',
      ideaCaptured: 'NEXT: Start working with /p:now [task]',
      initialized: 'NEXT: Set first task with /p:now "your first task"',
      stuck: 'NEXT: Break down problem with /p:idea for each step',
    }

    return suggestions[context] || 'NEXT: What would you like to work on?'
  }

  /**
   * Handle sandboxed environment limitations
   */
  async ensureSandboxCompatibility() {

    const isSandboxed =
      process.cwd().includes('/sandbox/') ||
      process.cwd().includes('/tmp/') ||
      process.env.CODEX_SANDBOX

    if (isSandboxed) {

      return {
        sandboxed: true,
        basePath: process.cwd(),
        restrictions: ['no-network', 'limited-filesystem'],
      }
    }

    return {
      sandboxed: false,
      basePath: process.cwd(),
      restrictions: [],
    }
  }
}

module.exports = CodexAgent
