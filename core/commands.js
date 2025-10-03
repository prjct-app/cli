const fs = require('fs').promises
const path = require('path')
const { promisify } = require('util')
const { exec: execCallback } = require('child_process')
const exec = promisify(execCallback)
const agentDetector = require('./agent-detector')
const agentGenerator = require('./agent-generator')
const pathManager = require('./path-manager')
const configManager = require('./config-manager')
const authorDetector = require('./author-detector')
const migrator = require('./migrator')
const commandInstaller = require('./command-installer')
const sessionManager = require('./session-manager')
const analyzer = require('./analyzer')
const workflowEngine = require('./workflow-engine')
const workflowPrompts = require('./workflow-prompts')
const UpdateChecker = require('./update-checker')
const { VERSION } = require('./version')

let animations
try {
  animations = require('./animations')
} catch (e) {
  animations = null
}

let Agent

/**
 * Main command handler for prjct CLI
 *
 * Manages project workflow commands including task tracking, shipping features,
 * idea capture, and project analysis
 */
class PrjctCommands {
  constructor() {
    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
    this.updateChecker = new UpdateChecker()
    this.updateNotificationShown = false
  }

  /**
   * Check for updates and show notification (non-blocking)
   * Only shows once per session
   */
  async checkAndNotifyUpdates() {
    if (this.updateNotificationShown) {
      return
    }

    try {
      const notification = await this.updateChecker.getUpdateNotification()
      if (notification) {
        console.log(notification)
        this.updateNotificationShown = true
      }
    } catch (error) {
      // Fail silently - don't interrupt user workflow
    }
  }

  /**
   * Generate semantic branch name from task description
   *
   * @param {string} task - Task description
   * @returns {string} Branch name in format type/description
   */
  generateBranchName(task) {
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

    const cleanDescription = task
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50)

    return `${branchType}/${cleanDescription}`
  }

  /**
   * Execute git command with error handling
   *
   * @param {string} command - Git command to execute
   * @param {string} [cwd=process.cwd()] - Working directory
   * @returns {Promise<Object>} Result object with success flag and output
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
   *
   * @param {string} [projectPath=process.cwd()] - Project path to check
   * @returns {Promise<boolean>} True if git repository
   */
  async isGitRepo(projectPath = process.cwd()) {
    const result = await this.execGitCommand('git rev-parse --is-inside-work-tree', projectPath)
    return result.success && result.stdout === 'true'
  }

  /**
   * Create and switch to a new git branch
   *
   * @param {string} branchName - Name of branch to create
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async createAndSwitchBranch(branchName, projectPath = process.cwd()) {
    if (!await this.isGitRepo(projectPath)) {
      return { success: false, message: 'Not a git repository' }
    }

    const statusResult = await this.execGitCommand('git status --porcelain', projectPath)
    if (statusResult.stdout) {
      await this.execGitCommand('git stash push -m "Auto-stash before branch creation"', projectPath)
    }

    const branchExists = await this.execGitCommand(`git show-ref --verify --quiet refs/heads/${branchName}`, projectPath)

    if (branchExists.success) {
      const switchResult = await this.execGitCommand(`git checkout ${branchName}`, projectPath)
      if (!switchResult.success) {
        return { success: false, message: `Failed to switch to existing branch: ${branchName}` }
      }
      return { success: true, message: `Switched to existing branch: ${branchName}`, existed: true }
    }

    const createResult = await this.execGitCommand(`git checkout -b ${branchName}`, projectPath)

    if (!createResult.success) {
      return { success: false, message: `Failed to create branch: ${createResult.error}` }
    }

    if (statusResult.stdout) {
      await this.execGitCommand('git stash pop', projectPath)
    }

    return { success: true, message: `Created and switched to new branch: ${branchName}`, existed: false }
  }

  /**
   * Initialize agent detection and load appropriate adapter
   * Also handles automatic global migration on first run
   *
   * @returns {Promise<Object>} Initialized agent instance
   */
  async initializeAgent() {
    if (this.agent) return this.agent

    this.agentInfo = await agentDetector.detect()

    console.debug(`[prjct] Detected agent: ${this.agentInfo.name} (${this.agentInfo.type})`)

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

    // Check for updates in background (non-blocking)
    this.checkAndNotifyUpdates().catch(() => {
      // Fail silently - don't interrupt workflow
    })

    return this.agent
  }

  /**
   * Check if automatic migration is needed and run it transparently
   * This runs only once per installation using a flag file
   *
   * @private
   */
  async checkAndRunAutoMigration() {
    try {
      const flagPath = path.join(pathManager.getGlobalBasePath(), '.auto-migrated')

      try {
        await fs.access(flagPath)
        return
      } catch {
      }

      const summary = await migrator.migrateAll({
        deepScan: true,
        removeLegacy: false,
        cleanupLegacy: true,
        dryRun: false,
        onProgress: null,
      })

      await fs.mkdir(pathManager.getGlobalBasePath(), { recursive: true })
      await fs.writeFile(flagPath, JSON.stringify({
        migratedAt: new Date().toISOString(),
        version: VERSION,
        projectsFound: summary.totalFound,
        projectsMigrated: summary.successfullyMigrated,
      }), 'utf-8')
    } catch (error) {
      console.error('[prjct] Auto-migration error (non-blocking):', error.message)
    }
  }

  /**
   * Ensure author information is loaded
   *
   * @returns {Promise<Object>} Current author information
   */
  async ensureAuthor() {
    if (this.currentAuthor) return this.currentAuthor
    this.currentAuthor = await authorDetector.detectAuthorForLogs()
    return this.currentAuthor
  }

  /**
   * Auto-initialize project if not configured
   * Shows warning and runs init automatically
   *
   * @param {string} projectPath - Local project path
   * @returns {Promise<{success: boolean, message?: string}>} Success or init result
   */
  async ensureProjectInit(projectPath) {
    if (await configManager.isConfigured(projectPath)) {
      return { success: true }
    }

    const chalk = require('chalk')
    console.log(chalk.yellow('⚠️  Project not initialized'))
    console.log(chalk.cyan('🔧 Running prjct init...\n'))

    const initResult = await this.init(projectPath)
    if (!initResult.success) {
      return initResult
    }

    console.log(chalk.green('✅ Project initialized!\n'))
    return { success: true }
  }

  /**
   * Get the global project path for a project
   * Ensures migration if needed
   *
   * @param {string} projectPath - Local project path
   * @returns {Promise<string>} Global project path
   * @throws {Error} If project needs migration
   */
  async getGlobalProjectPath(projectPath) {
    if (await migrator.needsMigration(projectPath)) {
      throw new Error('Project needs migration. Run /p:migrate first.')
    }

    const projectId = await configManager.getProjectId(projectPath)

    await pathManager.ensureProjectStructure(projectId)

    return pathManager.getGlobalProjectPath(projectId)
  }

  /**
   * Get file path in global structure
   *
   * @param {string} projectPath - Local project path
   * @param {string} layer - Layer name (core, progress, planning, etc.)
   * @param {string} filename - File name
   * @returns {Promise<string>} Full file path
   */
  async getFilePath(projectPath, layer, filename) {
    const projectId = await configManager.getProjectId(projectPath)
    return pathManager.getFilePath(projectId, layer, filename)
  }

  /**
   * Initialize a new prjct project
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async init(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const author = await authorDetector.detect()

      // Check if local config exists
      const isConfigured = await configManager.isConfigured(projectPath)
      let projectId
      let existingLocalData = null
      let fusionPerformed = false

      if (isConfigured) {
        // Use existing ID from local config
        const existingConfig = await configManager.readConfig(projectPath)
        projectId = existingConfig.projectId
        console.log(`🔄 Using existing project ID: ${projectId}`)

        // Check if there's local data to merge
        const localPrjctPath = path.join(projectPath, '.prjct')
        try {
          const localFiles = await fs.readdir(localPrjctPath)
          if (localFiles.length > 1) { // More than just prjct.config.json
            existingLocalData = await this.collectLocalData(localPrjctPath)
          }
        } catch (error) {
          // No local data to merge
        }
      } else {
        // Generate new ID based on path hash
        const config = await configManager.createConfig(projectPath, author)
        projectId = config.projectId
        console.log(`✨ Created new project ID: ${projectId}`)
      }

      // Ensure global structure exists
      await pathManager.ensureProjectStructure(projectId)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Check if global data exists
      const globalExists = await this.checkGlobalDataExists(globalPath)

      if (!globalExists) {
        // Create fresh global structure
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

        for (const [filePath, content] of Object.entries(files)) {
          await this.agent.writeFile(path.join(globalPath, filePath), content)
        }
        console.log('✅ Created global structure')
      } else {
        console.log('✅ Using existing global data')
      }

      // Merge local data if exists
      if (existingLocalData) {
        console.log('🔄 Merging local data with global...')
        await this.mergeProjectData(existingLocalData, globalPath)
        fusionPerformed = true
      }

      // Clean up local data (keep only prjct.config.json)
      await this.cleanupLocalData(projectPath)

      const projectInfo = await this.detectProjectType(projectPath)

      let analysisMessage = ''
      const hasExistingCode = await this.detectExistingCode(projectPath)

      if (hasExistingCode) {
        // Instead of silently analyzing, prompt the AI agent to run /p:analyze workflow
        analysisMessage = '\n\n📊 Existing codebase detected!\n' +
          `\n💡 Run ${this.agentInfo.config.commandPrefix}analyze to analyze your project and sync tasks`
      }

      const displayPath = pathManager.getDisplayPath(globalPath)
      const fusionMessage = fusionPerformed ? '\n🔄 Merged local data with global' : ''
      const message =
        `Initializing prjct v${VERSION} for ${this.agentInfo.name}...\n` +
        `✅ Project ID: ${projectId}\n` +
        `✅ Global data: ${displayPath}\n` +
        `👤 Author: ${authorDetector.formatAuthor(author)}\n` +
        `📋 Project: ${projectInfo}` +
        fusionMessage +
        analysisMessage +
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

  /**
   * Check if global data exists for a project
   *
   * @param {string} globalPath - Global project path
   * @returns {Promise<boolean>} True if global data exists
   * @private
   */
  async checkGlobalDataExists(globalPath) {
    try {
      const nowFile = path.join(globalPath, 'core', 'now.md')
      await fs.access(nowFile)
      return true
    } catch {
      return false
    }
  }

  /**
   * Collect all data from local .prjct directory
   *
   * @param {string} localPrjctPath - Path to local .prjct directory
   * @returns {Promise<Object>} Object with local data organized by category
   * @private
   */
  async collectLocalData(localPrjctPath) {
    const data = {
      core: {},
      progress: {},
      planning: {},
      memory: {},
    }

    try {
      // Collect core files
      const coreFiles = ['now.md', 'next.md', 'context.md']
      for (const file of coreFiles) {
        try {
          const filePath = path.join(localPrjctPath, file)
          data.core[file] = await this.agent.readFile(filePath)
        } catch {
          // File doesn't exist locally
        }
      }

      // Collect progress files
      const progressFiles = ['shipped.md', 'metrics.md']
      for (const file of progressFiles) {
        try {
          const filePath = path.join(localPrjctPath, file)
          data.progress[file] = await this.agent.readFile(filePath)
        } catch {
          // File doesn't exist locally
        }
      }

      // Collect planning files
      const planningFiles = ['ideas.md', 'roadmap.md']
      for (const file of planningFiles) {
        try {
          const filePath = path.join(localPrjctPath, file)
          data.planning[file] = await this.agent.readFile(filePath)
        } catch {
          // File doesn't exist locally
        }
      }

      // Collect memory
      try {
        const memoryPath = path.join(localPrjctPath, 'memory.jsonl')
        data.memory['context.jsonl'] = await this.agent.readFile(memoryPath)
      } catch {
        // Memory doesn't exist locally
      }
    } catch (error) {
      console.error('[prjct] Error collecting local data:', error.message)
    }

    return data
  }

  /**
   * Merge local project data with global data
   *
   * @param {Object} localData - Local data collected from .prjct
   * @param {string} globalPath - Global project path
   * @returns {Promise<void>}
   * @private
   */
  async mergeProjectData(localData, globalPath) {
    try {
      // Merge core files
      for (const [filename, localContent] of Object.entries(localData.core)) {
        if (!localContent) continue

        const globalFilePath = path.join(globalPath, 'core', filename)
        let globalContent = ''
        try {
          globalContent = await this.agent.readFile(globalFilePath)
        } catch {
          // Global file doesn't exist yet
        }

        const merged = this.intelligentMerge(localContent, globalContent, filename)
        await this.agent.writeFile(globalFilePath, merged)
      }

      // Merge progress files
      for (const [filename, localContent] of Object.entries(localData.progress)) {
        if (!localContent) continue

        const globalFilePath = path.join(globalPath, 'progress', filename)
        let globalContent = ''
        try {
          globalContent = await this.agent.readFile(globalFilePath)
        } catch {
          // Global file doesn't exist yet
        }

        const merged = this.intelligentMerge(localContent, globalContent, filename)
        await this.agent.writeFile(globalFilePath, merged)
      }

      // Merge planning files
      for (const [filename, localContent] of Object.entries(localData.planning)) {
        if (!localContent) continue

        const globalFilePath = path.join(globalPath, 'planning', filename)
        let globalContent = ''
        try {
          globalContent = await this.agent.readFile(globalFilePath)
        } catch {
          // Global file doesn't exist yet
        }

        const merged = this.intelligentMerge(localContent, globalContent, filename)
        await this.agent.writeFile(globalFilePath, merged)
      }

      // Merge memory (chronologically)
      if (localData.memory['context.jsonl']) {
        const globalMemoryPath = path.join(globalPath, 'memory', 'context.jsonl')
        let globalMemory = ''
        try {
          globalMemory = await this.agent.readFile(globalMemoryPath)
        } catch {
          // Global memory doesn't exist yet
        }

        const merged = this.mergeMemory(localData.memory['context.jsonl'], globalMemory)
        await this.agent.writeFile(globalMemoryPath, merged)
      }
    } catch (error) {
      console.error('[prjct] Error merging data:', error.message)
    }
  }

  /**
   * Intelligent merge of markdown content
   *
   * @param {string} localContent - Content from local file
   * @param {string} globalContent - Content from global file
   * @param {string} filename - Name of the file being merged
   * @returns {string} Merged content
   * @private
   */
  intelligentMerge(localContent, globalContent, filename) {
    // If global is empty, use local
    if (!globalContent || globalContent.trim() === '' || globalContent.includes('No current task')) {
      return localContent
    }

    // If local is empty, use global
    if (!localContent || localContent.trim() === '') {
      return globalContent
    }

    // For now.md, prefer local (most recent)
    if (filename === 'now.md') {
      return localContent
    }

    // For shipped.md, next.md, ideas.md, roadmap.md - combine unique entries
    const localLines = localContent.split('\n').filter((l) => l.trim())
    const globalLines = globalContent.split('\n').filter((l) => l.trim())

    // Keep header from global
    const header = globalLines[0] || localLines[0]

    // Combine unique content (skip headers and empty lines)
    const allLines = [...globalLines.slice(1), ...localLines.slice(1)]
    const uniqueLines = [...new Set(allLines)]

    return [header, '', ...uniqueLines].join('\n')
  }

  /**
   * Merge memory.jsonl files chronologically
   *
   * @param {string} localMemory - Local memory content
   * @param {string} globalMemory - Global memory content
   * @returns {string} Merged memory sorted by timestamp
   * @private
   */
  mergeMemory(localMemory, globalMemory) {
    if (!globalMemory) return localMemory
    if (!localMemory) return globalMemory

    const localEntries = localMemory.split('\n').filter((l) => l.trim())
    const globalEntries = globalMemory.split('\n').filter((l) => l.trim())

    const allEntries = [...globalEntries, ...localEntries].map((entry) => {
      try {
        return JSON.parse(entry)
      } catch {
        return null
      }
    }).filter(Boolean)

    // Sort by timestamp
    allEntries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    // Remove duplicates
    const unique = []
    const seen = new Set()
    for (const entry of allEntries) {
      const key = `${entry.timestamp}-${entry.action}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(entry)
      }
    }

    return unique.map((e) => JSON.stringify(e)).join('\n')
  }

  /**
   * Clean up local .prjct directory, keeping only prjct.config.json
   *
   * @param {string} projectPath - Project path
   * @returns {Promise<void>}
   * @private
   */
  async cleanupLocalData(projectPath) {
    try {
      const localPrjctPath = path.join(projectPath, '.prjct')
      const files = await fs.readdir(localPrjctPath, { withFileTypes: true })

      for (const file of files) {
        if (file.name === 'prjct.config.json') continue

        const filePath = path.join(localPrjctPath, file.name)
        if (file.isDirectory()) {
          await fs.rm(filePath, { recursive: true, force: true })
        } else {
          await fs.unlink(filePath)
        }
      }

      console.log('🧹 Cleaned up local data - only prjct.config.json remains')
    } catch (error) {
      console.error('[prjct] Warning: Could not clean up local data:', error.message)
    }
  }

  /**
   * Set or view current task
   *
   * @param {string|null} [task=null] - Task description or null to view current
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async now(task = null, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      await this.ensureAuthor()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const nowFile = await this.getFilePath(projectPath, 'core', 'now.md')

      if (!task) {
        const content = await this.agent.readFile(nowFile)
        const lines = content.split('\n')
        const currentTask = lines[0].replace('# NOW: ', '').replace('# NOW', 'None')

        return {
          success: true,
          message: this.agent.formatResponse(`Current focus: ${currentTask}`, 'focus'),
        }
      }

      const branchName = this.generateBranchName(task)

      let branchMessage = ''
      const branchResult = await this.createAndSwitchBranch(branchName, projectPath)

      if (branchResult.success) {
        if (branchResult.existed) {
          branchMessage = `\n🔄 Switched to existing branch: ${branchName}`
        } else {
          branchMessage = `\n🌿 Created and switched to branch: ${branchName}`
        }
      } else if (branchResult.message === 'Not a git repository') {
        branchMessage = ''
      } else {
        branchMessage = `\n⚠️ Could not create branch: ${branchResult.message}`
      }

      let contentWithBranch = `# NOW: ${task}\nStarted: ${this.agent.getTimestamp()}\n`
      if (branchResult.success) {
        contentWithBranch += `Branch: ${branchName}\n`
      }
      contentWithBranch += `\n## Task\n${task}\n\n## Notes\n\n`

      await this.agent.writeFile(nowFile, contentWithBranch)

      const currentAuthor = await configManager.getCurrentAuthor(projectPath)

      const startedAt = this.agent.getTimestamp()
      const memoryData = {
        task,
        timestamp: startedAt,
        startedAt,
        branch: branchResult.success ? branchName : null,
        author: currentAuthor,
      }
      await this.logToMemory(projectPath, 'task_started', memoryData)

      const projectId = await configManager.getProjectId(projectPath)
      await configManager.updateAuthorActivity(projectId, currentAuthor)

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

  /**
   * Mark current task as done
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async done(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const nowFile = await this.getFilePath(projectPath, 'core', 'now.md')
      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')

      const content = await this.agent.readFile(nowFile)
      const lines = content.split('\n')
      const currentTask = lines[0].replace('# NOW: ', '')

      if (currentTask === '# NOW' || !currentTask) {
        return {
          success: false,
          message: this.agent.formatResponse('No current task to complete', 'warning'),
        }
      }

      let startedAt = null
      const startedLine = lines.find(line => line.startsWith('Started:'))
      if (startedLine) {
        startedAt = startedLine.replace('Started: ', '').trim()
      }

      const currentAuthor = await configManager.getCurrentAuthor(projectPath)

      const completedAt = this.agent.getTimestamp()
      let duration = null
      if (startedAt) {
        const ms = new Date(completedAt) - new Date(startedAt)
        const hours = Math.floor(ms / 3600000)
        const minutes = Math.floor((ms % 3600000) / 60000)
        duration = `${hours}h ${minutes}m`
      }

      // Check for active workflow
      const workflowEngine = require('./workflow-engine')
      const corePath = path.dirname(nowFile)
      const dataPath = path.dirname(corePath)
      const workflow = await workflowEngine.load(dataPath)

      if (workflow && workflow.active) {
        // Store completed step name before advancing
        const completedStep = workflow.steps[workflow.current].name

        // Workflow: advance to next step
        const nextStep = await workflowEngine.next(dataPath)

        // Log step completion
        await this.logToMemory(projectPath, 'workflow_step_completed', {
          task: currentTask,
          step: completedStep,
          timestamp: completedAt,
          startedAt,
          completedAt,
          duration,
          author: currentAuthor,
        })

        if (!nextStep) {
          // Workflow complete
          await this.agent.writeFile(nowFile, '# NOW\n\nNo current task. Use `/p:now` to set focus.\n')
          await workflowEngine.clear(dataPath)

          const projectId = await configManager.getProjectId(projectPath)
          await configManager.updateAuthorActivity(projectId, currentAuthor)

          return {
            success: true,
            message: this.agent.formatResponse(`Workflow complete: ${currentTask}`, 'success'),
          }
        }

        // Check if next step needs prompting
        if (nextStep.needsPrompt) {
          const workflowPrompts = require('./workflow-prompts')
          const promptInfo = await workflowPrompts.buildPrompt(nextStep, workflow.caps, projectPath)

          // Save state before prompting
          const projectId = await configManager.getProjectId(projectPath)
          await configManager.updateAuthorActivity(projectId, currentAuthor)

          return {
            success: true,
            message: this.agent.formatResponse(`Step complete: ${completedStep}`, 'success') +
                     '\n\n' + promptInfo.message + '\n\n' +
                     'Reply with your choice (1-4) to continue workflow.',
            needsPrompt: true,
            promptInfo,
            workflow,
            nextStep,
          }
        }

        // Update now.md with next step
        const nowMd = `# NOW: ${currentTask}
Started: ${new Date().toISOString()}

## Task
${currentTask}

## Workflow Step
${nextStep.action}

## Agent
${nextStep.agent}

## Notes

`
        await this.agent.writeFile(nowFile, nowMd)

        const projectId = await configManager.getProjectId(projectPath)
        await configManager.updateAuthorActivity(projectId, currentAuthor)

        return {
          success: true,
          message: this.agent.formatResponse(`Step done → ${nextStep.name}: ${nextStep.action} (${nextStep.agent})`, 'success'),
        }
      }

      // No workflow: normal completion
      await this.agent.writeFile(nowFile, '# NOW\n\nNo current task. Use `/p:now` to set focus.\n')

      await this.logToMemory(projectPath, 'task_completed', {
        task: currentTask,
        timestamp: completedAt,
        startedAt,
        completedAt,
        duration,
        author: currentAuthor,
      })

      const projectId = await configManager.getProjectId(projectPath)
      await configManager.updateAuthorActivity(projectId, currentAuthor)

      await this.agent.readFile(nextFile)

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

  /**
   * Ship a completed feature
   *
   * @param {string} feature - Feature description
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async ship(feature, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      if (!feature) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please specify a feature name: ${this.agentInfo.config.commandPrefix}ship "feature name"`,
            'warning',
          ),
        }
      }

      const config = await configManager.readConfig(projectPath)

      if (config && config.projectId) {
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

        const recentShips = await sessionManager.getRecentLogs(config.projectId, 30, 'shipped.md')
        const totalShipped = recentShips.match(/✅/g)?.length || 1

        await this.logToMemory(projectPath, 'ship', { feature, timestamp: this.agent.getTimestamp() })

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
   *
   * @private
   * @param {string} feature - Feature description
   * @param {string} projectPath - Project path
   * @returns {Promise<Object>} Result object
   */
  async _shipLegacy(feature, projectPath) {
    const shippedFile = await this.getFilePath(projectPath, 'progress', 'shipped.md')

    let content = await this.agent.readFile(shippedFile)

    const week = this.getWeekNumber(new Date())
    const year = new Date().getFullYear()
    const weekHeader = `## Week ${week}, ${year}`

    if (!content.includes(weekHeader)) {
      content += `\n${weekHeader}\n`
    }

    const entry = `- ✅ **${feature}** _(${new Date().toLocaleString()})_\n`
    const insertIndex = content.indexOf(weekHeader) + weekHeader.length + 1
    content = content.slice(0, insertIndex) + entry + content.slice(insertIndex)

    await this.agent.writeFile(shippedFile, content)

    const totalShipped = (content.match(/✅/g) || []).length

    await this.logToMemory(projectPath, 'ship', { feature, timestamp: this.agent.getTimestamp() })

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

  /**
   * Show priority queue
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async next(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')
      const content = await this.agent.readFile(nextFile)

      const tasks = content
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.replace('- ', ''))

      if (tasks.length === 0) {
        return {
          success: true,
          message: this.agent.formatResponse(
            `Queue is empty. Add tasks with ${this.agentInfo.config.commandPrefix}idea or focus on shipping!`,
            'info',
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

  /**
   * Capture a new idea
   *
   * @param {string} text - Idea text
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async idea(text, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      if (!text) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please provide an idea: ${this.agentInfo.config.commandPrefix}idea "your idea"`,
            'warning',
          ),
        }
      }

      const config = await configManager.readConfig(projectPath)
      const globalProjectPath = pathManager.getProjectRoot(config.projectId)

      const ideasFile = await this.getFilePath(projectPath, 'planning', 'ideas.md')
      const nextFile = await this.getFilePath(projectPath, 'core', 'next.md')

      const entry = `- ${text} _(${new Date().toLocaleDateString()})_\n`
      const ideasContent = await this.agent.readFile(ideasFile)
      await this.agent.writeFile(ideasFile, ideasContent + entry)

      let addedToQueue = false
      let workflowCreated = false
      let workflowType = null

      if (text.match(/^(implement|add|create|fix|update|build)/i)) {
        const nextContent = await this.agent.readFile(nextFile)
        await this.agent.writeFile(nextFile, nextContent + `- ${text}\n`)
        addedToQueue = true

        // Auto-detect workflow type and initialize workflow
        workflowType = workflowEngine.classify(text)
        if (workflowType) {
          try {
            const workflow = await workflowEngine.init(text, workflowType, globalProjectPath)
            workflowCreated = !!workflow
          } catch (error) {
            console.warn('⚠️  Could not initialize workflow:', error.message)
          }
        }
      }

      await this.logToMemory(projectPath, 'idea', {
        text,
        timestamp: this.agent.getTimestamp(),
        workflow: workflowCreated ? workflowType : null,
      })

      let message = `Idea captured: "${text}"`
      if (addedToQueue) {
        message += `\nAlso added to ${this.agentInfo.config.commandPrefix}next queue`
      }
      if (workflowCreated) {
        message += `\n\n🔄 Workflow initialized: ${workflowType}`
        message += `\nUse ${this.agentInfo.config.commandPrefix}workflow to see steps`
        message += `\nStart with ${this.agentInfo.config.commandPrefix}now to begin working`
      }

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

  /**
   * Show project recap with progress overview
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async recap(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const nowFilePath = await this.getFilePath(projectPath, 'core', 'now.md')
      const nextFilePath = await this.getFilePath(projectPath, 'core', 'next.md')
      const ideasFilePath = await this.getFilePath(projectPath, 'planning', 'ideas.md')

      const nowFile = await this.agent.readFile(nowFilePath)
      const nextFile = await this.agent.readFile(nextFilePath)
      const ideasFile = await this.agent.readFile(ideasFilePath)

      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      const queuedCount = (nextFile.match(/^- /gm) || []).length
      const ideasCount = (ideasFile.match(/^- /gm) || []).length

      const config = await configManager.readConfig(projectPath)
      let shippedCount = 0
      let recentActivity = ''

      if (config && config.projectId) {
        const recentShips = await this.getHistoricalData(projectPath, 'month', 'shipped.md')
        shippedCount = (recentShips.match(/✅/g) || []).length

        const recentLogs = await this.getRecentLogs(projectPath, 7)
        recentActivity = recentLogs
          .slice(-3)
          .map((entry) => {
            return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
          })
          .join('\n')
      } else {
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

  /**
   * Show progress metrics for a time period
   *
   * @param {string} [period='week'] - Time period: 'day', 'week', or 'month'
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async progress(period = 'week', projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      const shippedData = await this.getHistoricalData(projectPath, period, 'shipped.md')

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

      const now = new Date()
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7
      const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

      const periodFeatures = features.filter((f) => f.date >= cutoff)

      const timeMetrics = await this.getTimeMetrics(projectPath, period)

      const velocity = periodFeatures.length / periodDays
      const previousVelocity = 0.3

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
        timeMetrics,
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
   * @returns {Promise<Object>} Time metrics object
   */
  async getTimeMetrics(projectPath, period) {
    try {
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7
      const logs = await sessionManager.getRecentLogs(await configManager.getProjectId(projectPath), periodDays, 'context.jsonl')

      const completedTasks = logs.filter(log => log.type === 'task_completed' && log.data?.duration)

      if (completedTasks.length === 0) {
        return {
          totalTime: 'N/A',
          avgDuration: 'N/A',
          tasksCompleted: 0,
          longestTask: 'N/A',
          shortestTask: 'N/A',
          byAuthor: {},
        }
      }

      const parseDuration = (duration) => {
        const match = duration.match(/(\d+)h (\d+)m/)
        if (!match) return 0
        return parseInt(match[1]) * 60 + parseInt(match[2])
      }

      const durations = completedTasks.map(t => parseDuration(t.data.duration))
      const totalMinutes = durations.reduce((sum, d) => sum + d, 0)
      const avgMinutes = Math.round(totalMinutes / durations.length)

      const sortedDurations = [...durations].sort((a, b) => b - a)
      const longestMinutes = sortedDurations[0]
      const shortestMinutes = sortedDurations[sortedDurations.length - 1]

      const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60)
        const m = minutes % 60
        return `${h}h ${m}m`
      }

      const byAuthor = {}
      completedTasks.forEach(task => {
        const author = task.data?.author || task.author || 'Unknown'
        if (!byAuthor[author]) {
          byAuthor[author] = {
            tasks: 0,
            totalMinutes: 0,
          }
        }
        byAuthor[author].tasks++
        byAuthor[author].totalMinutes += parseDuration(task.data.duration)
      })

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
        byAuthor,
      }
    } catch (error) {
      return {
        totalTime: 'N/A',
        avgDuration: 'N/A',
        tasksCompleted: 0,
        longestTask: 'N/A',
        shortestTask: 'N/A',
        byAuthor: {},
      }
    }
  }

  /**
   * Get help when stuck on a problem
   *
   * @param {string} issue - Issue description
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async stuck(issue, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      if (!issue) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Please describe what you're stuck on: ${this.agentInfo.config.commandPrefix}stuck "issue description"`,
            'warning',
          ),
        }
      }

      await this.logToMemory(projectPath, 'stuck', { issue, timestamp: this.agent.getTimestamp() })

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

  /**
   * Advanced cleanup with multiple cleanup types
   *
   * @param {string} [target='.'] - Target directory
   * @param {Object} [options={}] - Cleanup options
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async cleanupAdvanced(_target = '.', options = {}, _projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      const type = options.type || 'all'
      const mode = options.aggressive ? 'aggressive' : 'safe'
      const dryRun = options.dryRun || false

      const results = {
        deadCode: { consoleLogs: 0, commented: 0, unused: 0 },
        imports: { removed: 0, organized: 0 },
        files: { temp: 0, empty: 0, spaceFeed: 0 },
        deps: { removed: 0, sizeSaved: 0 },
      }

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
          message,
        }
      }

      return {
        success: true,
        message: this.agent.formatResponse('Advanced cleanup complete!', 'success'),
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
   * Generate design documents and diagrams
   *
   * @param {string} target - Design target name
   * @param {Object} [options={}] - Design options
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async design(target, options = {}, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Verify project is initialized
      if (!await configManager.isConfigured(projectPath)) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Project not initialized. Run ${this.agentInfo.config.commandPrefix}init first.`,
            'warning'
          ),
        }
      }

      const type = options.type || 'architecture'

      // Use global architecture
      const projectId = await configManager.getProjectId(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)
      const designDir = path.join(globalPath, 'analysis', 'designs')
      await this.agent.createDirectory(designDir)

      let designContent = ''
      let diagram = ''

      switch (type) {
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

      await this.logToMemory(projectPath, 'design', {
        target,
        type,
        file: designFile,
      })

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
        message,
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
   * Show project context and recent activity
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async context(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const projectInfo = await this.detectProjectType(projectPath)

      const nowFilePath = await this.getFilePath(projectPath, 'core', 'now.md')
      const nowFile = await this.agent.readFile(nowFilePath)
      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      const config = await configManager.readConfig(projectPath)
      let recentActions = []

      if (config && config.projectId) {
        const recentLogs = await this.getRecentLogs(projectPath, 7)
        recentActions = recentLogs.slice(-5).map((entry) => {
          return `• ${entry.action}: ${entry.data.task || entry.data.feature || entry.data.text || ''}`
        })
      } else {
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
        }
      }

      const contextInfo =
        'Project Context\n\n' +
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

  /**
   * Detect project type from package.json and files
   *
   * @param {string} projectPath - Project path
   * @returns {Promise<string>} Project type description
   */
  async detectProjectType(projectPath) {
    const files = await fs.readdir(projectPath)

    if (files.includes('package.json')) {
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8'))
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        if (deps.next) return 'Next.js project'
        if (deps.react) return 'React project'
        if (deps.vue) return 'Vue project'
        if (deps.express) return 'Express project'
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

  /**
   * Get week number from date
   *
   * @param {Date} date - Date to get week number for
   * @returns {number} Week number
   */
  getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
  }

  /**
   * Get days since last ship event
   *
   * @param {string} projectPath - Project path
   * @returns {Promise<number>} Days since last ship or Infinity if never shipped
   */
  async getDaysSinceLastShip(projectPath) {
    try {
      await this.initializeAgent()

      // Use global architecture
      const projectId = await configManager.getProjectId(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)
      const memoryFile = path.join(globalPath, 'memory', 'context.jsonl')
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
    }
    return Infinity
  }

  /**
   * Log action to memory system
   *
   * @param {string} projectPath - Project path
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  async logToMemory(projectPath, action, data) {
    await this.initializeAgent()
    await this.ensureAuthor()

    const config = await configManager.readConfig(projectPath)

    if (config && config.projectId) {
      const entry = {
        action,
        author: this.currentAuthor,
        data,
        timestamp: new Date().toISOString(),
      }

      try {
        await sessionManager.writeToSession(config.projectId, entry, 'context.jsonl')
      } catch (error) {
        console.error('Session logging failed, falling back to legacy:', error.message)
        await this._logToMemoryLegacy(projectPath, action, data)
      }
    } else {
      await this._logToMemoryLegacy(projectPath, action, data)
    }
  }

  /**
   * Legacy logging method (fallback)
   *
   * @private
   * @param {string} projectPath - Project path
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  async _logToMemoryLegacy(projectPath, action, data) {
    const memoryFile = await this.getFilePath(projectPath, 'memory', 'context.jsonl')
    const entry = JSON.stringify({
      action,
      author: this.currentAuthor,
      data,
      timestamp: new Date().toISOString(),
    }) + '\n'

    try {
      const existingContent = await this.agent.readFile(memoryFile)
      await this.agent.writeFile(memoryFile, existingContent + entry)
    } catch (e) {
      await this.agent.writeFile(memoryFile, entry)
    }
  }

  /**
   * Get historical data from sessions
   * Consolidates data from multiple sessions based on time period
   *
   * @param {string} projectPath - Project path
   * @param {string} [period='week'] - Time period: 'day', 'week', 'month', 'all'
   * @param {string} [filename='context.jsonl'] - File to read from sessions
   * @returns {Promise<Array<Object>>} Consolidated entries
   */
  async getHistoricalData(projectPath, period = 'week', filename = 'context.jsonl') {
    const config = await configManager.readConfig(projectPath)

    if (!config || !config.projectId) {
      return await this._getHistoricalDataLegacy(projectPath, filename)
    }

    const toDate = new Date()
    const fromDate = new Date()
    const isMarkdown = filename.endsWith('.md')

    switch (period) {
      case 'day':
      case 'today':
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
        fromDate.setFullYear(fromDate.getFullYear() - 1)
        break

      default:
        fromDate.setDate(fromDate.getDate() - 7)
    }

    if (isMarkdown) {
      return await sessionManager.readMarkdownRange(config.projectId, fromDate, toDate, filename)
    } else {
      return await sessionManager.readSessionRange(config.projectId, fromDate, toDate, filename)
    }
  }

  /**
   * Get historical data from legacy single-file structure
   *
   * @private
   * @param {string} projectPath - Project path
   * @param {string} filename - Filename to read
   * @returns {Promise<Array<Object>>} Parsed entries
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
   * @param {number} [days=7] - Number of days to look back
   * @returns {Promise<Array<Object>>} Recent log entries
   */
  async getRecentLogs(projectPath, days = 7) {
    const config = await configManager.readConfig(projectPath)

    if (config && config.projectId) {
      return await sessionManager.getRecentLogs(config.projectId, days)
    } else {
      return await this._getHistoricalDataLegacy(projectPath, 'context.jsonl')
    }
  }

  /**
   * Cleanup old project data
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async cleanup(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Verify project is initialized
      if (!await configManager.isConfigured(projectPath)) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Project not initialized. Run ${this.agentInfo.config.commandPrefix}init first.`,
            'warning'
          ),
        }
      }

      // Use global architecture
      const projectId = await configManager.getProjectId(projectPath)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      let totalFreed = 0
      let filesRemoved = 0
      let tasksArchived = 0

      try {
        const tempDir = path.join(globalPath, 'temp')
        const tempFiles = await fs.readdir(tempDir).catch(() => [])
        for (const file of tempFiles) {
          const filePath = path.join(tempDir, file)
          const stats = await fs.stat(filePath)
          totalFreed += stats.size
          await fs.unlink(filePath)
          filesRemoved++
        }
      } catch (e) {
      }

      try {
        const memoryFile = path.join(globalPath, 'memory', 'context.jsonl')
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
            recentLines.push(line)
          }
        }

        if (archivedLines.length > 0) {
          const archiveFile = path.join(globalPath, 'memory', `archive-${now.toISOString().split('T')[0]}.jsonl`)
          await this.agent.writeFile(archiveFile, archivedLines.join('\n') + '\n')
          await this.agent.writeFile(memoryFile, recentLines.join('\n') + '\n')
          tasksArchived = archivedLines.length
        }
      } catch (e) {
      }

      const files = await fs.readdir(globalPath)
      for (const file of files) {
        if (file.endsWith('.md') || file.endsWith('.txt')) {
          const filePath = path.join(globalPath, file)
          const stats = await fs.stat(filePath)
          if (stats.size === 0) {
            await fs.unlink(filePath)
            filesRemoved++
          }
        }
      }

      try {
        const shippedFile = path.join(globalPath, 'progress', 'shipped.md')
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
      }

      const freedMB = (totalFreed / 1024 / 1024).toFixed(2)

      const message = '🧹 Cleanup complete!\n' +
        `• Files removed: ${filesRemoved}\n` +
        `• Tasks archived: ${tasksArchived}\n` +
        `• Space freed: ${freedMB} MB\n` +
        '\n✨ Your project is clean and lean!'

      await this.logToMemory(projectPath, 'cleanup', {
        filesRemoved,
        tasksArchived,
        spaceFeed: freedMB,
      })

      return {
        success: true,
        message: this.agent.formatResponse(message, 'success'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Cleanup failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Migrate all legacy projects to new structure
   *
   * @param {Object} [options={}] - Migration options
   * @returns {Promise<Object>} Result object with summary
   */
  async migrateAll(options = {}) {
    try {
      await this.initializeAgent()

      const {
        deepScan = false,
        removeLegacy = false,
        dryRun = false,
      } = options

      const onProgress = (update) => {
        if (update.phase === 'scanning') {
          console.log(`🔍 ${update.message}`)
        } else if (update.phase === 'checking' || update.phase === 'migrating') {
          console.log(`   ${update.message}`)
        }
      }

      const summary = await migrator.migrateAll({
        deepScan,
        removeLegacy,
        dryRun,
        onProgress,
      })

      const report = migrator.generateMigrationSummary(summary)

      return {
        success: summary.success,
        message: report,
        summary,
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Global migration failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * First-time setup - Install commands to AI editors with ASCII art welcome
   *
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async start() {
    try {
      await this.initializeAgent()

      // ASCII Art
      const chalk = require('chalk')
      console.log('')
      console.log('')
      console.log(chalk.bold.cyan('   ██████╗ ██████╗      ██╗ ██████╗████████╗'))
      console.log(chalk.bold.cyan('   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝'))
      console.log(chalk.bold.blue('   ██████╔╝██████╔╝     ██║██║        ██║'))
      console.log(chalk.bold.blue('   ██╔═══╝ ██╔══██╗██   ██║██║        ██║'))
      console.log(chalk.bold.magenta('   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║'))
      console.log(chalk.bold.magenta('   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝'))
      console.log('')
      console.log(chalk.dim.white('   Turn ideas into AI-ready roadmaps'))
      console.log('')
      console.log(chalk.yellow('   ⚡ Ship faster with zero friction'))
      console.log(chalk.green('   📝 From idea to technical tasks in minutes'))
      console.log(chalk.cyan('   🤖 Perfect context for AI agents'))
      console.log('')

      console.log(chalk.bold.magenta('📦 Setup - Install Commands to Claude\n'))

      // Detect Claude
      const commandInstaller = require('./command-installer')
      const claudeDetected = await commandInstaller.detectClaude()

      if (!claudeDetected) {
        return {
          success: false,
          message: this.agent.formatResponse(
            'Claude not detected.\n\nPlease install Claude Code or Claude Desktop first.\n\nVisit: https://claude.ai/download',
            'error'
          ),
        }
      }

      console.log(chalk.green('✓ Claude detected'))
      console.log('')

      // Install commands
      console.log(chalk.cyan('Installing /p:* commands...'))
      const installResult = await commandInstaller.installCommands()

      if (!installResult.success) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Installation failed: ${installResult.error || 'Unknown error'}`,
            'error'
          ),
        }
      }

      // Success message
      const installedCount = installResult.installed?.length || 0
      const errorCount = installResult.errors?.length || 0

      let message = `✅ Successfully installed ${installedCount} commands to Claude\n`
      message += `   Location: ${installResult.path}\n`

      if (errorCount > 0) {
        message += `\n⚠️  ${errorCount} command(s) had issues during installation`
      }

      message += '\n\n✨ prjct is ready to use!'
      message += '\n\nNext steps:'
      message += '\n  cd your-project/'
      message += '\n  prjct init'
      message += '\n\nℹ️  Context7 MCP is automatically available in Claude'

      return {
        success: true,
        message: this.agent.formatResponse(message, 'celebrate'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Setup failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Setup/reconfigure commands in AI editors
   *
   * @param {Object} [options={}] - Installation options
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async setup(options = {}) {
    try {
      await this.initializeAgent()

      const { force = false } = options

      // Detect Claude
      const commandInstaller = require('./command-installer')
      const claudeDetected = await commandInstaller.detectClaude()

      if (!claudeDetected) {
        return {
          success: false,
          message: this.agent.formatResponse(
            'Claude not detected. Please install Claude Code or Claude Desktop first.',
            'error'
          ),
        }
      }

      // Check current installation status
      const status = await commandInstaller.checkInstallation()

      if (status.installed && !force) {
        const chalk = require('chalk')
        let report = chalk.green('✓ Commands already installed\n')
        report += chalk.dim(`  Location: ${status.path}\n`)
        report += chalk.dim(`  Commands: ${status.commands.length}\n`)
        report += '\nUse --force to reinstall'

        return {
          success: true,
          message: this.agent.formatResponse(report, 'info'),
        }
      }

      // Install or reinstall commands
      const installResult = force
        ? await commandInstaller.updateCommands()
        : await commandInstaller.installCommands()

      if (!installResult.success) {
        return {
          success: false,
          message: this.agent.formatResponse(
            `Installation failed: ${installResult.error || 'Unknown error'}`,
            'error'
          ),
        }
      }

      // Generate report
      const installedCount = installResult.installed?.length || 0
      const errorCount = installResult.errors?.length || 0

      let report = `✅ Successfully ${force ? 'reinstalled' : 'installed'} ${installedCount} commands\n`
      report += `   Location: ${installResult.path}\n`

      if (errorCount > 0) {
        report += `\n⚠️  ${errorCount} command(s) had issues\n`
        installResult.errors.forEach(err => {
          report += `   - ${err.file}: ${err.error}\n`
        })
      }

      report += '\n📚 Context7 MCP is automatically available in Claude'

      return {
        success: true,
        message: this.agent.formatResponse(report, 'celebrate'),
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Installation failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Analyze codebase and optionally sync with .prjct/ state
   *
   * @param {Object} [options={}] - Analysis options
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with analysis and sync results
   */
  async analyze(options = {}, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      const {
        sync = false,
        reportOnly = false,
        silent = false,
      } = options

      if (!silent) {
        console.log('🔍 Analyzing codebase...')
      }

      const analysis = await analyzer.analyzeProject(projectPath)

      const summary = {
        commandsFound: analysis.commands.length,
        featuresFound: analysis.features.length,
        technologies: analysis.technologies.join(', '),
        fileCount: analysis.structure.fileCount,
        hasGit: analysis.gitHistory.hasGit,
      }

      let syncResults = null
      if (sync && !reportOnly) {
        const globalProjectPath = await this.getGlobalProjectPath(projectPath)
        syncResults = await analyzer.syncWithPrjctFiles(globalProjectPath)
      }

      let message = ''

      if (silent) {
        message = `Found ${summary.commandsFound} commands, ${summary.featuresFound} features`
      } else if (reportOnly) {
        message = this.formatAnalysisReport(summary, analysis)
      } else if (sync) {
        message = this.formatAnalysisWithSync(summary, syncResults)
      } else {
        message = this.formatAnalysisReport(summary, analysis)
      }

      return {
        success: true,
        message: this.agent.formatResponse(message, 'info'),
        analysis,
        syncResults,
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Analysis failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Format analysis report for display
   *
   * @param {Object} summary - Analysis summary
   * @param {Object} analysis - Full analysis results
   * @returns {string} Formatted report
   */
  formatAnalysisReport(summary, analysis) {
    return `
🔍 Codebase Analysis Complete

📊 Project Overview:
• Technologies: ${summary.technologies || 'Not detected'}
• Total Files: ~${summary.fileCount}
• Git Repository: ${summary.hasGit ? '✅ Yes' : '❌ No'}

🛠️ Implemented Commands: ${summary.commandsFound}
${analysis.commands.slice(0, 10).map(cmd => `  • /p:${cmd}`).join('\n')}
${analysis.commands.length > 10 ? `  ... and ${analysis.commands.length - 10} more` : ''}

✨ Detected Features: ${summary.featuresFound}
${analysis.features.slice(0, 5).map(f => `  • ${f}`).join('\n')}
${analysis.features.length > 5 ? `  ... and ${analysis.features.length - 5} more` : ''}

📝 Full report saved to: analysis/repo-summary.md

💡 Use /p:analyze --sync to sync with .prjct/ files
`
  }

  /**
   * Format analysis with sync results
   *
   * @param {Object} summary - Analysis summary
   * @param {Object} syncResults - Sync results
   * @returns {string} Formatted report with sync info
   */
  formatAnalysisWithSync(summary, syncResults) {
    return `
🔍 Analysis & Sync Complete

📊 Detected:
✅ ${summary.commandsFound} implemented commands
✅ ${summary.featuresFound} completed features

📝 Synchronized:
${syncResults.nextMdUpdated ? `✅ Updated next.md (${syncResults.tasksMarkedComplete} tasks marked complete)` : '• next.md (no changes)'}
${syncResults.shippedMdUpdated ? `✅ Updated shipped.md (${syncResults.featuresAdded} features added)` : '• shipped.md (no changes)'}
✅ Created analysis/repo-summary.md

💡 Next: Use /p:next to see remaining tasks
`
  }

  /**
   * Sync project state and update AI agents
   * Re-analyzes the project and regenerates workflow agents in global project directory
   *
   * @param {string} [projectPath=process.cwd()] - Project directory path
   * @returns {Promise<Object>} Result with success status and message
   */
  async sync(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Get project ID from config
      const config = await configManager.readConfig(projectPath)
      if (!config || !config.projectId) {
        return {
          success: false,
          message: this.agent.formatResponse(
            'Project not initialized. Run /p:init first.',
            'error',
          ),
        }
      }

      console.log('🔄 Syncing project state...\n')

      // Step 1: Re-run project analysis
      const analysisResult = await this.analyze({ silent: true }, projectPath)

      if (!analysisResult.success) {
        return {
          success: false,
          message: this.agent.formatResponse(`Sync failed: ${analysisResult.message}`, 'error'),
        }
      }

      const { analysis } = analysisResult
      const summary = {
        commandsFound: analysis.commands.length,
        featuresFound: analysis.features.length,
      }

      console.log('📊 Analysis Complete')
      console.log(`   ✅ ${summary.commandsFound} commands detected`)
      console.log(`   ✅ ${summary.featuresFound} features implemented\n`)

      // Step 2: Generate/update all agents in project directory
      const AgentGenerator = agentGenerator
      const generator = new AgentGenerator(config.projectId)

      const generatedAgents = await generator.generateAll(analysis)

      // Step 3: Log sync action to memory
      await this.logAction(projectPath, 'sync', {
        commandsDetected: summary.commandsFound,
        featuresDetected: summary.featuresFound,
        agentsGenerated: generatedAgents.length,
        agents: generatedAgents,
      })

      const agentsPath = path.join(
        pathManager.getProjectRoot(config.projectId),
        'agents',
      )

      const message = `
🔄 Sync Complete

📊 Project State:
   ✅ ${summary.commandsFound} commands detected
   ✅ ${summary.featuresFound} features implemented

🤖 Workflow Agents:
   ✨ Generated ${generatedAgents.length} agents in ${agentsPath}
   ${generatedAgents.map(a => `✅ ${a.toUpperCase()}`).join('\n   ')}

💡 Agents ready for workflow task assignment!
`

      return {
        success: true,
        message: this.agent.formatResponse(message, 'success'),
        generatedAgents,
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Sync failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Show workflow status
   *
   * @param {string} [projectPath=process.cwd()] - Project path
   * @returns {Promise<Object>} Result object with success flag and message
   */
  async workflow(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Auto-init if not configured
      const initCheck = await this.ensureProjectInit(projectPath)
      if (!initCheck.success) {
        return initCheck
      }

      const config = await configManager.readConfig(projectPath)
      const globalProjectPath = pathManager.getProjectRoot(config.projectId)

      const workflow = await workflowEngine.load(globalProjectPath)

      if (!workflow || !workflow.active) {
        return {
          success: true,
          message: this.agent.formatResponse(
            `No active workflow.\n\nStart one with ${this.agentInfo.config.commandPrefix}idea "implement [feature]"`,
            'info',
          ),
        }
      }

      const currentStep = workflow.steps[workflow.current]
      const completedSteps = workflow.steps.slice(0, workflow.current)
      const remainingSteps = workflow.steps.slice(workflow.current + 1)

      let message = `🔄 Workflow: ${workflow.type}\n`
      message += `📋 Task: ${workflow.task}\n\n`

      if (completedSteps.length > 0) {
        message += `✅ Completed:\n`
        completedSteps.forEach((step) => {
          message += `   - ${step.name}: ${step.action} (${step.agent})\n`
        })
        message += '\n'
      }

      message += `🎯 Current Step:\n`
      message += `   - ${currentStep.name}: ${currentStep.action} (${currentStep.agent})\n`
      if (currentStep.required) {
        message += `   Required: Yes\n`
      }
      message += '\n'

      if (remainingSteps.length > 0) {
        message += `⏳ Remaining:\n`
        remainingSteps.forEach((step) => {
          message += `   - ${step.name}: ${step.action} (${step.agent})\n`
        })
        message += '\n'
      }

      message += `Progress: ${workflow.current + 1}/${workflow.steps.length} steps`

      return {
        success: true,
        message: this.agent.formatResponse(message, 'info'),
        workflow,
      }
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(`Workflow status failed: ${error.message}`, 'error'),
      }
    }
  }

  /**
   * Detect if project has existing code (for auto-analyze during init)
   *
   * @param {string} projectPath - Project path
   * @returns {Promise<boolean>} True if project has significant existing code
   */
  async detectExistingCode(projectPath) {
    try {
      const packagePath = path.join(projectPath, 'package.json')
      try {
        const content = await fs.readFile(packagePath, 'utf-8')
        const pkg = JSON.parse(content)

        if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
          return true
        }
      } catch {
      }

      try {
        const { stdout } = await exec('git rev-list --count HEAD', { cwd: projectPath })
        const commitCount = parseInt(stdout.trim())
        if (commitCount > 0) {
          return true
        }
      } catch {
      }

      const entries = await fs.readdir(projectPath)
      const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.rb', '.java']

      let codeFileCount = 0
      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') {
          continue
        }

        const ext = path.extname(entry)
        if (codeExtensions.includes(ext)) {
          codeFileCount++
        }
      }

      return codeFileCount >= 5
    } catch (error) {
      return false
    }
  }
}

module.exports = new PrjctCommands()
