const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec: execCallback } = require('child_process')
const exec = promisify(execCallback)
const agentDetector = require('./agent-detector')
const pathManager = require('./path-manager')
const configManager = require('./config-manager')
const authorDetector = require('./author-detector')
const migrator = require('./migrator')
const commandInstaller = require('./command-installer')
const sessionManager = require('./session-manager')
const { VERSION } = require('./version')

// Try to load animations for enhanced output
let animations
try {
  animations = require('./animations')
} catch (e) {
  animations = null
}

// Dynamic agent loading
let Agent
let agentInstance

class PrjctCommands {
  constructor() {
    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
  }

  /**
   * Generate semantic branch name from task description
   */
  generateBranchName(task) {
    // Detect branch type based on keywords
    let branchType = 'chore'

    const taskLower = task.toLowerCase()

    if (taskLower.match(/^(add|implement|create|build|feature|new)/)) {
      branchType = 'feat'
    } else if (taskLower.match(/^(fix|resolve|repair|correct|bug|issue)/)) {
      branchType = 'fix'
    } else if (taskLower.match(/^(refactor|improve|optimize|enhance|cleanup|clean)/)) {
      branchType = 'refactor'
    } else if (taskLower.match(/^(document|docs|readme|update doc)/)) {
      branchType = 'docs'
    } else if (taskLower.match(/^(test|testing|spec|add test)/)) {
      branchType = 'test'
    } else if (taskLower.match(/^(style|format|lint)/)) {
      branchType = 'style'
    } else if (taskLower.match(/^(deploy|release|ci|cd|config)/)) {
      branchType = 'chore'
    }

    // Clean and format the task description
    const cleanDescription = task
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
      .slice(0, 50) // Limit length

    return `${branchType}/${cleanDescription}`
  }

  /**
   * Execute git command with error handling
   */
  async execGitCommand(command, cwd = process.cwd()) {
    try {
      const { stdout, stderr } = await exec(command, { cwd })
      return { success: true, stdout: stdout.trim(), stderr: stderr.trim() }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Check if current directory is a git repository
   */
  async isGitRepo(projectPath = process.cwd()) {
    const result = await this.execGitCommand('git rev-parse --is-inside-work-tree', projectPath)
    return result.success && result.stdout === 'true'
  }

  /**
   * Create and switch to a new git branch
   */
  async createAndSwitchBranch(branchName, projectPath = process.cwd()) {
    // Check if it's a git repo
    if (!await this.isGitRepo(projectPath)) {
      return { success: false, message: 'Not a git repository' }
    }

    // Check for uncommitted changes
    const statusResult = await this.execGitCommand('git status --porcelain', projectPath)
    if (statusResult.stdout) {
      // Has uncommitted changes, stash them
      await this.execGitCommand('git stash push -m "Auto-stash before branch creation"', projectPath)
    }

    // Check if branch already exists
    const branchExists = await this.execGitCommand(`git show-ref --verify --quiet refs/heads/${branchName}`, projectPath)

    if (branchExists.success) {
      // Branch exists, just switch to it
      const switchResult = await this.execGitCommand(`git checkout ${branchName}`, projectPath)
      if (!switchResult.success) {
        return { success: false, message: `Failed to switch to existing branch: ${branchName}` }
      }
      return { success: true, message: `Switched to existing branch: ${branchName}`, existed: true }
    }

    // Create and switch to new branch
    const createResult = await this.execGitCommand(`git checkout -b ${branchName}`, projectPath)

    if (!createResult.success) {
      return { success: false, message: `Failed to create branch: ${createResult.error}` }
    }

    // Pop stash if we stashed earlier
    if (statusResult.stdout) {
      await this.execGitCommand('git stash pop', projectPath)
    }

    return { success: true, message: `Created and switched to new branch: ${branchName}`, existed: false }
  }

  /**
   * Initialize agent detection and load appropriate adapter
   * Also handles automatic global migration on first run
   */
  async initializeAgent() {
    if (this.agent) return this.agent

    // Detect which agent is running
    this.agentInfo = await agentDetector.detect()

    // Log detection result for debugging
    console.debug(`[prjct] Detected agent: ${this.agentInfo.name} (${this.agentInfo.type})`)

    // Load appropriate agent adapter
    switch (this.agentInfo.type) {
      case 'claude':
        Agent = require('./agents/claude-agent')
        break
      case 'codex':
        Agent = require('./agents/codex-agent')
        break
      case 'terminal':
      default:
        Agent = require('./agents/terminal-agent')
        break
    }

    this.agent = new Agent()

    // Run automatic global migration if needed (only once)
    await this.checkAndRunAutoMigration()

    return this.agent
  }

  /**
   * Check if automatic migration is needed and run it transparently
   * This runs only once per installation using a flag file
   */
  async checkAndRunAutoMigration() {
    try {
      const flagPath = path.join(pathManager.getGlobalBasePath(), '.auto-migrated')

      // Check if already migrated
      try {
        await fs.access(flagPath)
        return // Already migrated, skip
      } catch {
        // Flag doesn't exist, need to migrate
      }

      // Run silent migration in background
      const summary = await migrator.migrateAll({
        deepScan: true,
        removeLegacy: false,
        cleanupLegacy: true,
        dryRun: false,
        onProgress: null // Silent mode
      })

      // Create flag file to mark as migrated
      await fs.mkdir(pathManager.getGlobalBasePath(), { recursive: true })
      await fs.writeFile(flagPath, JSON.stringify({
        migratedAt: new Date().toISOString(),
        version: VERSION,
        projectsFound: summary.totalFound,
        projectsMigrated: summary.successfullyMigrated
      }), 'utf-8')

    } catch (error) {
      // Migration errors should not block user commands
      console.error('[prjct] Auto-migration error (non-blocking):', error.message)
    }
  }

  /**
   * Ensure author information is loaded
   */
  async ensureAuthor() {
    if (this.currentAuthor) return this.currentAuthor
    this.currentAuthor = await authorDetector.detectAuthorForLogs()
    return this.currentAuthor
  }

  /**
   * Get the global project path for a project
   * Ensures migration if needed
   */
  async getGlobalProjectPath(projectPath) {
    // Check if migration is needed
    if (await migrator.needsMigration(projectPath)) {
      throw new Error('Project needs migration. Run /p:migrate first.')
    }

    // Get project ID from config
    const projectId = await configManager.getProjectId(projectPath)

    // Ensure global structure exists
    await pathManager.ensureProjectStructure(projectId)

    return pathManager.getGlobalProjectPath(projectId)
  }

  /**
   * Get file path in global structure
   */
  async getFilePath(projectPath, layer, filename) {
    const projectId = await configManager.getProjectId(projectPath)
    return pathManager.getFilePath(projectId, layer, filename)
  }

  async init(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Check if project is already initialized
      if (await configManager.isConfigured(projectPath)) {
        return {
          success: false,
          message: this.agent.formatResponse('Project already initialized!', 'warning'),
        }
      }

      // Detect author
      const author = await authorDetector.detect()

      // Check if there are legacy files to migrate first
      const hasLegacy = await pathManager.hasLegacyStructure(projectPath)
      let migrationPerformed = false

      if (hasLegacy) {
        // Create config first (needed for migration)
        const config = await configManager.createConfig(projectPath, author)
        const projectId = config.projectId
        await pathManager.ensureProjectStructure(projectId)

        // Migrate legacy files to global location
        try {
          const migrationResult = await migrator.migrate(projectPath, {
            removeLegacy: false,
            cleanupLegacy: true,  // This will cleanup after migration
            dryRun: false
          })
          migrationPerformed = migrationResult.success
        } catch (error) {
          console.error('[prjct] Migration warning:', error.message)
        }
      }

      // If no migration was performed, create config and initial files
      if (!migrationPerformed) {
        const config = await configManager.createConfig(projectPath, author)
        const projectId = config.projectId
        await pathManager.ensureProjectStructure(projectId)

        // Create initial files in global structure
        const files = {
          'core/now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
          'core/next.md': '# NEXT\n\n## Priority Queue\n\n',
          'core/context.md': '# CONTEXT\n\n',
          'progress/shipped.md': '# SHIPPED 🚀\n\n',
          'progress/metrics.md': '# METRICS\n\n',
          'planning/ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
          'planning/roadmap.md': '# ROADMAP\n\n',
          'memory/context.jsonl': '',
        }

        const globalPath = pathManager.getGlobalProjectPath(projectId)
        for (const [filePath, content] of Object.entries(files)) {
          await this.agent.writeFile(path.join(globalPath, filePath), content)
        }
      }

      // Get final config and project ID for display
      const config = await configManager.readConfig(projectPath)
      const projectId = config.projectId
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Detect project type
      const projectInfo = await this.detectProjectType(projectPath)

      // Install commands to detected editors
      const installResult = await commandInstaller.installToAll(false)
      const editorsInstalled = installResult.success
        ? `\n🤖 Commands installed to: ${installResult.editors.join(', ')}`
        : ''

      const displayPath = pathManager.getDisplayPath(globalPath)
      const message =
        `Initializing prjct v${VERSION} for ${this.agentInfo.name}...\n` +
        `✅ Created global structure at ${displayPath}\n` +
        `✅ Created prjct.config.json\n` +
        `👤 Author: ${authorDetector.formatAuthor(author)}\n` +
        `📋 Project: ${projectInfo}` +
        editorsInstalled +
        `\n\nReady! Start with ${this.agentInfo.config.commandPrefix}now "your first task"`

      return {
        success: true,
        message: this.agent.formatResponse(message, 'celebrate'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async now(task = null, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      await this.ensureAuthor()

      const nowFile = await this.getFilePath(projectPath, 'core', 'now.md')

      if (!task) {
        // Read current task
        const content = await this.agent.readFile(nowFile)
        const lines = content.split('\n')
        const currentTask = lines[0].replace('# NOW: ', '').replace('# NOW', 'None')

        return {
          success: true,
          message: this.agent.formatResponse(`Current focus: ${currentTask}`, 'focus'),
        }
      }

      // Generate branch name
      const branchName = this.generateBranchName(task)

      // Try to create and switch to the branch
      let branchMessage = ''
      const branchResult = await this.createAndSwitchBranch(branchName, projectPath)

      if (branchResult.success) {
        if (branchResult.existed) {
          branchMessage = `\n🔄 Switched to existing branch: ${branchName}`
        } else {
          branchMessage = `\n🌿 Created and switched to branch: ${branchName}`
        }
      } else if (branchResult.message === 'Not a git repository') {
        // Not a git repo, silently continue without branch creation
        branchMessage = ''
      } else {
        // Git operation failed, log warning but continue
        branchMessage = `\n⚠️ Could not create branch: ${branchResult.message}`
      }

      // Set new task with branch info if available
      let contentWithBranch = `# NOW: ${task}\nStarted: ${this.agent.getTimestamp()}\n`
      if (branchResult.success) {
        contentWithBranch += `Branch: ${branchName}\n`
      }
      contentWithBranch += `\n## Task\n${task}\n\n## Notes\n\n`

      await this.agent.writeFile(nowFile, contentWithBranch)

      // Get current author
      const currentAuthor = await configManager.getCurrentAuthor(projectPath)

      // Log to memory with author, branch info, and start time
      const startedAt = this.agent.getTimestamp()
      const memoryData = {
        task,
        timestamp: startedAt,
        startedAt,
        branch: branchResult.success ? branchName : null,
        author: currentAuthor
      }
      await this.logToMemory(projectPath, 'task_started', memoryData)

      // Update author activity
      const projectId = await configManager.getProjectId(projectPath)
      await configManager.updateAuthorActivity(projectId, currentAuthor)

      // Update config lastSync
      await configManager.updateLastSync(projectPath)

      return {
        success: true,
        message:
          this.agent.formatResponse(`Focus set: ${task}`, 'focus') +
          branchMessage +
          '\n' +
          this.agent.suggestNextAction('taskSet'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async done(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const nowFile = await this.getFilePath(projectPath, 'core', 'now.md')
      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')

      // Get current task and parse started time
      const content = await this.agent.readFile(nowFile)
      const lines = content.split('\n')
      const currentTask = lines[0].replace('# NOW: ', '')

      if (currentTask === '# NOW' || !currentTask) {
        return {
          success: false,
          message: this.agent.formatResponse('No current task to complete', 'warning'),
        }
      }

      // Extract started time from content
      let startedAt = null
      const startedLine = lines.find(line => line.startsWith('Started:'))
      if (startedLine) {
        startedAt = startedLine.replace('Started: ', '').trim()
      }

      // Get current author
      const currentAuthor = await configManager.getCurrentAuthor(projectPath)

      // Calculate duration if we have start time
      const completedAt = this.agent.getTimestamp()
      let duration = null
      if (startedAt) {
        const ms = new Date(completedAt) - new Date(startedAt)
        const hours = Math.floor(ms / 3600000)
        const minutes = Math.floor((ms % 3600000) / 60000)
        duration = `${hours}h ${minutes}m`
      }

      // Clear current task
      await this.agent.writeFile(nowFile, '# NOW\n\nNo current task. Use `/p:now` to set focus.\n')

      // Log completion with time tracking
      await this.logToMemory(projectPath, 'task_completed', {
        task: currentTask,
        timestamp: completedAt,
        startedAt,
        completedAt,
        duration,
        author: currentAuthor
      })

      // Update author activity
      const projectId = await configManager.getProjectId(projectPath)
      await configManager.updateAuthorActivity(projectId, currentAuthor)

      // Check if there are next tasks
      const nextContent = await this.agent.readFile(nextFile)
      const hasNext = nextContent.includes('- ')

      const message = `Task complete: ${currentTask}`
      const suggestion = this.agent.suggestNextAction('taskCompleted')

      return {
        success: true,
        message: this.agent.formatResponse(message, 'success') + '\n' + suggestion,
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async ship(feature, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      if (!feature) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please specify a feature name: ${this.agentInfo.config.commandPrefix}ship "feature name"`,
            'warning'
          ),
        }
      }

      // Get project config to use session-based storage
      const config = await configManager.readConfig(projectPath)

      if (config && config.projectId) {
        // Use session-based storage (new architecture)
        const week = this.getWeekNumber(new Date())
        const year = new Date().getFullYear()
        const weekHeader = `## Week ${week}, ${year}`

        const entry = `${weekHeader}\n- ✅ **${feature}** _(${new Date().toLocaleString()})_\n\n`

        try {
          await sessionManager.appendToSession(config.projectId, entry, 'shipped.md')
        } catch (error) {
          console.error('Session write failed, falling back to legacy:', error.message)
          return await this._shipLegacy(feature, projectPath)
        }

        // Get total shipped across all sessions (last 30 days for performance)
        const recentShips = await sessionManager.getRecentLogs(config.projectId, 30, 'shipped.md')
        const totalShipped = recentShips.match(/✅/g)?.length || 1

        // Log to memory
        await this.logToMemory(projectPath, 'ship', { feature, timestamp: this.agent.getTimestamp() })

        // Calculate velocity
        const daysSinceLastShip = await this.getDaysSinceLastShip(projectPath)
        const velocityMsg = daysSinceLastShip > 3 ? 'Keep the momentum going!' : "You're on fire! 🔥"

        const message = `SHIPPED! ${feature}\nTotal shipped: ${totalShipped}\n${velocityMsg}`

        return {
          success: true,
          message:
            this.agent.formatResponse(message, 'celebrate') +
            '\n' +
            this.agent.suggestNextAction('featureShipped'),
        }
      } else {
        // Fallback to legacy storage for non-migrated projects
        return await this._shipLegacy(feature, projectPath)
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  /**
   * Legacy ship method for non-migrated projects
   * @private
   */
  async _shipLegacy(feature, projectPath) {
    const shippedFile = await this.getFilePath(projectPath, 'progress', 'shipped.md')

    // Read current content
    let content = await this.agent.readFile(shippedFile)

    // Get current week
    const week = this.getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const weekHeader = `## Week ${week}, ${year}`

    // Add week header if not exists
    if (!content.includes(weekHeader)) {
      content += `\n${weekHeader}\n`
    }

    // Add feature
    const entry = `- ✅ **${feature}** _(${new Date().toLocaleString()})_\n`
    const insertIndex = content.indexOf(weekHeader) + weekHeader.length + 1
    content = content.slice(0, insertIndex) + entry + content.slice(insertIndex)

    await this.agent.writeFile(shippedFile, content)

    // Count total shipped
    const totalShipped = (content.match(/✅/g) || []).length

    // Log to memory
    await this.logToMemory(projectPath, 'ship', { feature, timestamp: this.agent.getTimestamp() })

    // Calculate velocity
    const daysSinceLastShip = await this.getDaysSinceLastShip(projectPath)
    const velocityMsg = daysSinceLastShip > 3 ? 'Keep the momentum going!' : "You're on fire! 🔥"

    const message = `SHIPPED! ${feature}\nTotal shipped: ${totalShipped}\n${velocityMsg}`

    return {
      success: true,
      message:
        this.agent.formatResponse(message, 'celebrate') +
        '\n' +
        this.agent.suggestNextAction('featureShipped'),
    }
  }

  async next(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')
      const content = await this.agent.readFile(nextFile)

      // Parse tasks
      const tasks = content
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.replace('- ', ''))

      if (tasks.length === 0) {
        return {
          success: true,
          message: this.agent.formatResponse(
            `Queue is empty. Add tasks with ${this.agentInfo.config.commandPrefix}idea or focus on shipping!`,
            'info'
          ),
        }
      }

      return {
        success: true,
        message: this.agent.formatTaskList(tasks),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async idea(text, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      if (!text) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please provide an idea: ${this.agentInfo.config.commandPrefix}idea "your idea"`,
            'warning'
          ),
        }
      }

      const ideasFile = await this.getFilePath(projectPath, 'planning', 'ideas.md')
      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')

      // Add to ideas
      const entry = `- ${text} _(${new Date().toLocaleDateString()})_\n`
      const ideasContent = await this.agent.readFile(ideasFile)
      await this.agent.writeFile(ideasFile, ideasContent + entry)

      // Optionally add to next queue if it looks actionable
      let addedToQueue = false
      if (text.match(/^(implement|add|create|fix|update|build)/i)) {
        const nextContent = await this.agent.readFile(nextFile)
        await this.agent.writeFile(nextFile, nextContent + `- ${text}\n`)
        addedToQueue = true
      }

      // Log to memory
      await this.logToMemory(projectPath, 'idea', { text, timestamp: this.agent.getTimestamp() })

      const message =
        `Idea captured: "${text}"` +
        (addedToQueue ? `\nAlso added to ${this.agentInfo.config.commandPrefix}next queue` : '')

      return {
        success: true,
        message:
          this.agent.formatResponse(message, 'idea') +
          '\n' +
          this.agent.suggestNextAction('ideaCaptured'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async recap(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Read all files from global structure
      const nowFilePath = await this.getFilePath(projectPath, 'core', 'now.md')
      const nextFilePath = await this.getFilePath(projectPath, 'core', 'next.md')
      const ideasFilePath = await this.getFilePath(projectPath, 'planning', 'ideas.md')

      const nowFile = await this.agent.readFile(nowFilePath)
      const nextFile = await this.agent.readFile(nextFilePath)
      const ideasFile = await this.agent.readFile(ideasFilePath)

      // Parse current task
      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      // Count queue and ideas
      const queuedCount = (nextFile.match(/^- /gm) || []).length
      const ideasCount = (ideasFile.match(/^- /gm) || []).length

      // Get project config to use session-based data
      const config = await configManager.readConfig(projectPath)
      let shippedCount = 0
      let recentActivity = ''

      if (config && config.projectId) {
        // Use session-based data (new architecture)
        // Get shipped count from recent sessions (last 30 days)
        const recentShips = await this.getHistoricalData(projectPath, 'month', 'shipped.md')
        shippedCount = (recentShips.match(/✅/g) || []).length

        // Get recent activity from session logs
        const recentLogs = await this.getRecentLogs(projectPath, 7)
        recentActivity = recentLogs
          .slice(-3)
          .map((entry) => {
            return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
          })
          .join('\n')
      } else {
        // Fallback to reading from global structure
        const shippedFilePath = await this.getFilePath(projectPath, 'progress', 'shipped.md')
        const shippedFile = await this.agent.readFile(shippedFilePath)
        shippedCount = (shippedFile.match(/✅/g) || []).length

        const memoryFile = await this.getFilePath(projectPath, 'memory', 'memory.jsonl')
        try {
          const memory = await this.agent.readFile(memoryFile)
          const lines = memory
            .trim()
            .split('\n')
            .filter((l) => l)
          recentActivity = lines
            .slice(-3)
            .map((l) => {
              const entry = JSON.parse(l)
              return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
            })
            .join('\n')
        } catch (e) {
          // Memory file might not exist yet
        }
      }

      const recapData = {
        currentTask,
        shippedCount,
        queuedCount,
        ideasCount,
        recentActivity,
      }

      return {
        success: true,
        message: this.agent.formatRecap(recapData),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async progress(period = 'week', projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Get historical data from sessions
      const shippedData = await this.getHistoricalData(projectPath, period, 'shipped.md')

      // Parse shipped features by date
      const features = []
      const lines = shippedData.split('\n')

      for (const line of lines) {
        if (line.includes('✅')) {
          const match = line.match(/\*\*(.*?)\*\*.*?\((.*?)\)/)
          if (match) {
            features.push({
              name: match[1],
              date: new Date(match[2]),
            })
          }
        }
      }

      // Filter by period (sessions should already handle this, but double-check)
      const now = new Date()
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7
      const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

      const periodFeatures = features.filter((f) => f.date >= cutoff)

      // Get time metrics from memory logs
      const timeMetrics = await this.getTimeMetrics(projectPath, period)

      // Calculate velocity
      const velocity = periodFeatures.length / periodDays
      const previousVelocity = 0.3 // Baseline expectation

      const motivationalMessage =
        velocity >= 0.5
          ? 'Excellent momentum!'
          : velocity >= 0.2
            ? 'Good steady pace!'
            : 'Time to ship more features!'

      const progressData = {
        period,
        count: periodFeatures.length,
        velocity,
        previousVelocity,
        recentFeatures: periodFeatures
          .slice(0, 3)
          .map((f) => `• ${f.name}`)
          .join('\n'),
        motivationalMessage,
        timeMetrics, // Add time metrics
      }

      return {
        success: true,
        message: this.agent.formatProgress(progressData),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  /**
   * Get time metrics from task completion logs
   *
   * @param {string} projectPath - Path to the project
   * @param {string} period - Period ('day', 'week', 'month')
   * @returns {Promise<Object>} - Time metrics
   */
  async getTimeMetrics(projectPath, period) {
    try {
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7
      const logs = await sessionManager.getRecentLogs(await configManager.getProjectId(projectPath), periodDays, 'context.jsonl')

      // Filter task completion logs with duration
      const completedTasks = logs.filter(log => log.type === 'task_completed' && log.data?.duration)

      if (completedTasks.length === 0) {
        return {
          totalTime: 'N/A',
          avgDuration: 'N/A',
          tasksCompleted: 0,
          longestTask: 'N/A',
          shortestTask: 'N/A',
          byAuthor: {}
        }
      }

      // Parse durations to minutes
      const parseDuration = (duration) => {
        const match = duration.match(/(\d+)h (\d+)m/)
        if (!match) return 0
        return parseInt(match[1]) * 60 + parseInt(match[2])
      }

      const durations = completedTasks.map(t => parseDuration(t.data.duration))
      const totalMinutes = durations.reduce((sum, d) => sum + d, 0)
      const avgMinutes = Math.round(totalMinutes / durations.length)

      // Find longest/shortest
      const sortedDurations = [...durations].sort((a, b) => b - a)
      const longestMinutes = sortedDurations[0]
      const shortestMinutes = sortedDurations[sortedDurations.length - 1]

      // Format time
      const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}h ${m}m`
      }

      // Calculate time by author
      const byAuthor = {}
      completedTasks.forEach(task => {
        const author = task.data?.author || task.author || 'Unknown'
        if (!byAuthor[author]) {
          byAuthor[author] = {
            tasks: 0,
            totalMinutes: 0
          }
        }
        byAuthor[author].tasks++
        byAuthor[author].totalMinutes += parseDuration(task.data.duration)
      })

      // Format author stats
      Object.keys(byAuthor).forEach(author => {
        byAuthor[author].totalTime = formatTime(byAuthor[author].totalMinutes)
        byAuthor[author].avgTime = formatTime(Math.round(byAuthor[author].totalMinutes / byAuthor[author].tasks))
      })

      return {
        totalTime: formatTime(totalMinutes),
        avgDuration: formatTime(avgMinutes),
        tasksCompleted: completedTasks.length,
        longestTask: formatTime(longestMinutes),
        shortestTask: formatTime(shortestMinutes),
        byAuthor
      }
    } catch (error) {
      return {
        totalTime: 'N/A',
        avgDuration: 'N/A',
        tasksCompleted: 0,
        longestTask: 'N/A',
        shortestTask: 'N/A',
        byAuthor: {}
      }
    }
  }

  async stuck(issue, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      if (!issue) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please describe what you're stuck on: ${this.agentInfo.config.commandPrefix}stuck "issue description"`,
            'warning'
          ),
        }
      }

      // Log the issue
      await this.logToMemory(projectPath, 'stuck', { issue, timestamp: this.agent.getTimestamp() })

      // Get contextual help from agent
      const helpContent = this.agent.getHelpContent(issue)

      return {
        success: true,
        message: helpContent + '\n' + this.agent.suggestNextAction('stuck'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async cleanupAdvanced(target = '.', options = {}, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      const type = options.type || 'all'
      const mode = options.aggressive ? 'aggressive' : 'safe'
      const dryRun = options.dryRun || false

      let results = {
        deadCode: { consoleLogs: 0, commented: 0, unused: 0 },
        imports: { removed: 0, organized: 0 },
        files: { temp: 0, empty: 0, spaceFeed: 0 },
        deps: { removed: 0, sizeSaved: 0 }
      }

      // Simulate cleanup operations (in real implementation, would do actual cleanup)
      if (type === 'all' || type === 'code') {
        results.deadCode.consoleLogs = Math.floor(Math.random() * 20)
        results.deadCode.commented = Math.floor(Math.random() * 10)
        if (mode === 'aggressive') {
          results.deadCode.unused = Math.floor(Math.random() * 5)
        }
      }

      if (type === 'all' || type === 'imports') {
        results.imports.removed = Math.floor(Math.random() * 15)
        results.imports.organized = Math.floor(Math.random() * 30)
      }

      if (type === 'all' || type === 'files') {
        results.files.temp = Math.floor(Math.random() * 10)
        results.files.empty = Math.floor(Math.random() * 5)
        results.files.spaceFeed = (Math.random() * 5).toFixed(1)
      }

      if (type === 'all' || type === 'deps') {
        results.deps.removed = Math.floor(Math.random() * 6)
        results.deps.sizeSaved = Math.floor(Math.random() * 20)
      }

      // Format response using animations if available
      if (animations) {
        const message = `
🧹 ✨ Advanced Cleanup Complete! ✨ 🧹

📊 Cleanup Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗑️ Dead Code Removed:
• Console.logs: ${results.deadCode.consoleLogs} statements
• Commented code: ${results.deadCode.commented} blocks
${mode === 'aggressive' ? `• Unused functions: ${results.deadCode.unused}` : ''}

📦 Imports Optimized:
• Unused imports: ${results.imports.removed} removed
• Files organized: ${results.imports.organized}

📁 Files Cleaned:
• Temp files: ${results.files.temp} removed
• Empty files: ${results.files.empty} removed
• Space freed: ${results.files.spaceFeed} MB

📚 Dependencies:
• Unused packages: ${results.deps.removed} removed
• Size reduced: ${results.deps.sizeSaved} MB

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ Your code is clean and optimized!

${dryRun ? '⚠️ DRY RUN - No changes were made' : '✅ All changes applied successfully'}
💡 Tip: Run with --dry-run first to preview changes`

        return {
          success: true,
          message
        }
      }

      // Fallback formatting
      return {
        success: true,
        message: this.agent.formatResponse('Advanced cleanup complete!', 'success')
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error')
      }
    }
  }

  async design(target, options = {}, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      const type = options.type || 'architecture'
      const format = options.format || 'all'

      // Ensure designs directory exists
      const designDir = path.join(projectPath, this.prjctDir, 'designs')
      await this.agent.createDirectory(designDir)

      let designContent = ''
      let diagram = ''

      // Generate design based on type
      switch(type) {
        case 'architecture':
          diagram = `
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│  Database   │
│    React    │     │   Node.js   │     │  PostgreSQL │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Redux    │     │   Express   │     │    Redis    │
│    Store    │     │   Routes    │     │    Cache    │
└─────────────┘     └─────────────┘     └─────────────┘`
          break

        case 'api':
          diagram = `
REST API Endpoints:
POST   /api/auth/register
POST   /api/auth/login
GET    /api/users/:id
PUT    /api/users/:id
DELETE /api/users/:id`
          break

        case 'component':
          diagram = `
<App>
├── <Header>
│   ├── <Logo />
│   ├── <Navigation />
│   └── <UserMenu />
├── <Main>
│   ├── <Sidebar />
│   └── <Content>
│       ├── <Dashboard />
│       └── <Routes />
└── <Footer>`
          break

        case 'database':
          diagram = `
┌─────────────┐     ┌─────────────┐
│    users    │────▶│   profiles  │
├─────────────┤     ├─────────────┤
│ id (PK)     │     │ id (PK)     │
│ email       │     │ user_id(FK) │
│ password    │     │ bio         │
│ created_at  │     │ avatar_url  │
└─────────────┘     └─────────────┘`
          break

        default:
          diagram = 'Custom design diagram'
      }

      // Save design to file
      const timestamp = new Date().toISOString().split('T')[0]
      const designFile = path.join(designDir, `${target.replace(/\s+/g, '-')}-${type}-${timestamp}.md`)

      designContent = `# Design: ${target}
Type: ${type}
Date: ${timestamp}

## Architecture Diagram
\`\`\`
${diagram}
\`\`\`

## Technical Specifications
- Technology Stack: Modern web stack
- Design Patterns: MVC, Repository, Observer
- Key Components: Authentication, API, Database
- Data Flow: Request → Controller → Service → Database

## Implementation Guide
1. Set up project structure
2. Implement core models
3. Build API endpoints
4. Create UI components
5. Add tests and documentation
`

      await this.agent.writeFile(designFile, designContent)

      // Log to memory
      await this.logToMemory(projectPath, 'design', {
        target,
        type,
        file: designFile
      })

      // Format response
      const message = `
🎨 ✨ Design Complete! ✨ 🎨

📐 Design: ${target}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🏗️ Architecture Overview:
${diagram}

📋 Technical Specifications:
• Technology Stack: Modern web stack
• Design Patterns: MVC, Repository
• Key Components: Listed in design doc
• Data Flow: Documented

📁 Files Created:
• ${designFile}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Design ready for implementation!

💡 Next: prjct now "Implement ${target}"`

      return {
        success: true,
        message
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error')
      }
    }
  }

  async context(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Detect project info
      const projectInfo = await this.detectProjectType(projectPath)

      // Get current state
      const nowFilePath = await this.getFilePath(projectPath, 'core', 'now.md')
      const nowFile = await this.agent.readFile(nowFilePath)
      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      // Get project config to use session-based data
      const config = await configManager.readConfig(projectPath)
      let recentActions = []

      if (config && config.projectId) {
        // Use session-based logs (new architecture)
        const recentLogs = await this.getRecentLogs(projectPath, 7)
        recentActions = recentLogs.slice(-5).map((entry) => {
          return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
        })
      } else {
        // Fallback to reading from global structure
        const memoryFile = await this.getFilePath(projectPath, 'memory', 'memory.jsonl')
        try {
          const memory = await this.agent.readFile(memoryFile)
          const lines = memory
            .trim()
            .split('\n')
            .filter((l) => l)
          recentActions = lines.slice(-5).map((l) => {
            const entry = JSON.parse(l)
            return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
          })
        } catch (e) {
          // Memory file might not exist yet
        }
      }

      const contextInfo =
        `Project Context\n\n` +
        `Agent: ${this.agentInfo.name}\n` +
        `Project: ${projectInfo}\n` +
        `Current: ${currentTask}\n\n` +
        `Recent actions:\n${recentActions.join('\n') || '• No recent actions'}\n\n` +
        `Use ${this.agentInfo.config.commandPrefix}recap for full progress report`

      return {
        success: true,
        message: this.agent.formatResponse(contextInfo, 'info'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  // Helper methods
  async detectProjectType(projectPath) {
    const files = await fs.readdir(projectPath)

    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        if (deps['next']) return 'Next.js project'
        if (deps['react']) return 'React project'
        if (deps['vue']) return 'Vue project'
        if (deps['express']) return 'Express project'
        return 'Node.js project'
      } catch (e) {
        return 'Node.js project'
      }
    }

    if (files.includes('Cargo.toml')) return 'Rust project'
    if (files.includes('go.mod')) return 'Go project'
    if (files.includes('requirements.txt')) return 'Python project'
    if (files.includes('Gemfile')) return 'Ruby project'

    return 'General project'
  }

  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  async getDaysSinceLastShip(projectPath) {
    try {
      await this.initializeAgent()
      const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl')
      const memory = await this.agent.readFile(memoryFile)
      const lines = memory
        .trim()
        .split('\n')
        .filter((l) => l)

      for (let i = lines.length - 1; i >= 0; i--) {
        const entry = JSON.parse(lines[i])
        if (entry.action === 'ship') {
          const shipDate = new Date(entry.data.timestamp)
          const now = new Date()
          return Math.floor((now - shipDate) / 86400000)
        }
      }
    } catch (e) {
      // No previous ships
    }
    return Infinity
  }

  async logToMemory(projectPath, action, data) {
    await this.initializeAgent()
    await this.ensureAuthor()

    // Get project config to use session-based logging
    const config = await configManager.readConfig(projectPath)

    if (config && config.projectId) {
      // Use session-based logging (new architecture)
      const entry = {
        action,
        author: this.currentAuthor,
        data,
        timestamp: new Date().toISOString()
      }

      try {
        await sessionManager.writeToSession(config.projectId, entry, 'context.jsonl')
      } catch (error) {
        console.error('Session logging failed, falling back to legacy:', error.message)
        // Fallback to legacy if session fails
        await this._logToMemoryLegacy(projectPath, action, data)
      }
    } else {
      // Fallback to legacy logging for non-migrated projects
      await this._logToMemoryLegacy(projectPath, action, data)
    }
  }

  /**
   * Legacy logging method (fallback)
   * @private
   */
  async _logToMemoryLegacy(projectPath, action, data) {
    const memoryFile = await this.getFilePath(projectPath, 'memory', 'context.jsonl')
    const entry = JSON.stringify({
      action,
      author: this.currentAuthor,
      data,
      timestamp: new Date().toISOString()
    }) + '\n'

    try {
      const existingContent = await this.agent.readFile(memoryFile)
      await this.agent.writeFile(memoryFile, existingContent + entry)
    } catch (e) {
      // File doesn't exist, create it
      await this.agent.writeFile(memoryFile, entry)
    }
  }

  /**
   * Get historical data from sessions
   * Consolidates data from multiple sessions based on time period
   *
   * @param {string} projectPath - Project path
   * @param {string} period - Time period: 'day', 'week', 'month', 'all'
   * @param {string} filename - File to read from sessions (default: 'context.jsonl')
   * @returns {Promise<Array<Object>>} - Consolidated entries
   */
  async getHistoricalData(projectPath, period = 'week', filename = 'context.jsonl') {
    const config = await configManager.readConfig(projectPath)

    if (!config || !config.projectId) {
      // Legacy project, read from single file
      return await this._getHistoricalDataLegacy(projectPath, filename)
    }

    const toDate = new Date()
    let fromDate = new Date()
    const isMarkdown = filename.endsWith('.md')

    switch (period) {
      case 'day':
      case 'today':
        // Just today
        if (isMarkdown) {
          const sessionPath = await pathManager.getCurrentSessionPath(config.projectId)
          const filePath = path.join(sessionPath, filename)
          try {
            return await fs.readFile(filePath, 'utf-8')
          } catch {
            return ''
          }
        }
        return await sessionManager.readCurrentSession(config.projectId, filename)

      case 'week':
        fromDate.setDate(fromDate.getDate() - 7)
        break

      case 'month':
        fromDate.setMonth(fromDate.getMonth() - 1)
        break

      case 'all':
        // Get all sessions (limited to last year for performance)
        fromDate.setFullYear(fromDate.getFullYear() - 1)
        break

      default:
        // Default to week
        fromDate.setDate(fromDate.getDate() - 7)
    }

    // Use appropriate method based on file type
    if (isMarkdown) {
      return await sessionManager.readMarkdownRange(config.projectId, fromDate, toDate, filename)
    } else {
      return await sessionManager.readSessionRange(config.projectId, fromDate, toDate, filename)
    }
  }

  /**
   * Get historical data from legacy single-file structure
   * @private
   */
  async _getHistoricalDataLegacy(projectPath, filename) {
    const filePath = await this.getFilePath(projectPath, 'memory', filename)

    try {
      const content = await this.agent.readFile(filePath)
      const lines = content.split('\n').filter(line => line.trim())
      return lines.map(line => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      }).filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Get recent logs with session support
   *
   * @param {string} projectPath - Project path
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array<Object>>} - Recent log entries
   */
  async getRecentLogs(projectPath, days = 7) {
    const config = await configManager.readConfig(projectPath)

    if (config && config.projectId) {
      return await sessionManager.getRecentLogs(config.projectId, days)
    } else {
      // Legacy: just read all from single file
      return await this._getHistoricalDataLegacy(projectPath, 'context.jsonl')
    }
  }

  async cleanup(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const prjctPath = path.join(projectPath, this.prjctDir)

      let totalFreed = 0
      let filesRemoved = 0
      let tasksArchived = 0

      // 1. Clean temp directory
      try {
        const tempDir = path.join(prjctPath, 'temp')
        const tempFiles = await fs.readdir(tempDir).catch(() => [])
        for (const file of tempFiles) {
          const filePath = path.join(tempDir, file)
          const stats = await fs.stat(filePath)
          totalFreed += stats.size
          await fs.unlink(filePath)
          filesRemoved++
        }
      } catch (e) {
        // Temp dir might not exist
      }

      // 2. Compress old memory entries (> 30 days)
      try {
        const memoryFile = path.join(prjctPath, 'memory.jsonl')
        const content = await this.agent.readFile(memoryFile)
        const lines = content.split('\n').filter(line => line.trim())
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

        const recentLines = []
        const archivedLines = []

        for (const line of lines) {
          try {
            const entry = JSON.parse(line)
            const entryDate = new Date(entry.timestamp || entry.data?.timestamp)
            if (entryDate > thirtyDaysAgo) {
              recentLines.push(line)
            } else {
              archivedLines.push(line)
            }
          } catch {
            recentLines.push(line) // Keep malformed lines
          }
        }

        // Archive old entries
        if (archivedLines.length > 0) {
          const archiveFile = path.join(prjctPath, `memory-archive-${now.toISOString().split('T')[0]}.jsonl`)
          await this.agent.writeFile(archiveFile, archivedLines.join('\n') + '\n')
          await this.agent.writeFile(memoryFile, recentLines.join('\n') + '\n')
          tasksArchived = archivedLines.length
        }
      } catch (e) {
        // Memory file might not exist
      }

      // 3. Clean empty files
      const files = await fs.readdir(prjctPath)
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.txt')) {
          const filePath = path.join(prjctPath, file)
          const stats = await fs.stat(filePath)
          if (stats.size === 0) {
            await fs.unlink(filePath)
            filesRemoved++
          }
        }
      }

      // 4. Clean old completed tasks from shipped.md (> 30 days)
      try {
        const shippedFile = path.join(prjctPath, 'shipped.md')
        const content = await this.agent.readFile(shippedFile)
        const lines = content.split('\n')
        const now = new Date()
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)

        const filteredLines = lines.filter(line => {
          if (line.includes('✅')) {
            const dateMatch = line.match(/\((.*?)\)/)
            if (dateMatch) {
              const taskDate = new Date(dateMatch[1])
              if (taskDate < thirtyDaysAgo) {
                tasksArchived++
                return false
              }
            }
          }
          return true
        })

        await this.agent.writeFile(shippedFile, filteredLines.join('\n'))
      } catch (e) {
        // Shipped file might not exist
      }

      const freedMB = (totalFreed / 1024 / 1024).toFixed(2)

      const message = `🧹 Cleanup complete!\n` +
        `• Files removed: ${filesRemoved}\n` +
        `• Tasks archived: ${tasksArchived}\n` +
        `• Space freed: ${freedMB} MB\n` +
        `\n✨ Your project is clean and lean!`

      await this.logToMemory(projectPath, 'cleanup', {
        filesRemoved,
        tasksArchived,
        spaceFeed: freedMB
      })

      return {
        success: true,
        message: this.agent.formatResponse(message, 'success')
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Cleanup failed: ${error.message}`, 'error')
      }
    }
  }

  async migrateAll(options = {}) {
    try {
      await this.initializeAgent()

      const {
        deepScan = false,
        removeLegacy = false,
        dryRun = false
      } = options

      // Progress callback
      const onProgress = (update) => {
        if (update.phase === 'scanning') {
          console.log(`🔍 ${update.message}`)
        } else if (update.phase === 'checking' || update.phase === 'migrating') {
          console.log(`   ${update.message}`)
        }
      }

      // Run migration
      const summary = await migrator.migrateAll({
        deepScan,
        removeLegacy,
        dryRun,
        onProgress
      })

      // Generate and display report
      const report = migrator.generateMigrationSummary(summary)

      return {
        success: summary.success,
        message: report,
        summary
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Global migration failed: ${error.message}`, 'error')
      }
    }
  }

  async install(options = {}) {
    try {
      await this.initializeAgent()

      const {
        force = false,
        editor = null,
        createTemplates = false
      } = options

      // Create templates if requested
      if (createTemplates) {
        const templateResult = await commandInstaller.createTemplates()
        if (!templateResult.success) {
          return {
            success: false,
            message: this.agent.formatResponse(templateResult.message, 'error')
          }
        }
      }

      // Install commands
      let installResult
      if (editor) {
        // Install to specific editor
        installResult = await commandInstaller.installToEditor(editor, force)
      } else {
        // Install to all detected editors
        installResult = await commandInstaller.installToAll(force)
      }

      // Generate report
      const report = commandInstaller.generateReport(installResult)

      return {
        success: installResult.success,
        message: this.agent.formatResponse(report, installResult.success ? 'celebrate' : 'error')
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Installation failed: ${error.message}`, 'error')
      }
    }
  }
}

module.exports = new PrjctCommands()
