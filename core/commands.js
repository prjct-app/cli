/**
 * Agentic Commands Handler for prjct CLI
 *
 * 100% AGENTIC - Claude decides everything based on templates.
 * ZERO if/else business logic.
 *
 * All commands use the agentic execution engine.
 * Templates define what Claude should do.
 *
 * MIGRATED COMMANDS (18 total):
 * - Sprint 1 (9 CRITICAL): init, analyze, sync, feature, bug, now, done, next, ship
 * - Sprint 2 (4 IMPORTANT): context, recap, stuck, design
 * - Sprint 3 (5 OPTIONAL): cleanup, progress, roadmap, status, build
 *
 * PENDING (3 total):
 * - Sprint 4 (3 SETUP): start, setup, migrateAll
 */

const path = require('path')

const commandExecutor = require('./agentic/command-executor')
const contextBuilder = require('./agentic/context-builder')
const toolRegistry = require('./agentic/tool-registry')
const memorySystem = require('./agentic/memory-system')
const AgentRouter = require('./agentic/agent-router')
const pathManager = require('./infrastructure/path-manager')
const configManager = require('./infrastructure/config-manager')
const authorDetector = require('./infrastructure/author-detector')
const agentDetector = require('./infrastructure/agent-detector')
const migrator = require('./infrastructure/migrator')
const UpdateChecker = require('./infrastructure/update-checker')
const { VERSION } = require('./utils/version')
const dateHelper = require('./utils/date-helper')
const jsonlHelper = require('./utils/jsonl-helper')
const fileHelper = require('./utils/file-helper')
const out = require('./utils/output')

/**
 * Agentic Commands - Template-driven execution
 */
class PrjctCommands {
  constructor() {
    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
    this.updateChecker = new UpdateChecker()
    this.updateNotificationShown = false
    this.commandExecutor = commandExecutor
    this.agentRouter = new AgentRouter()
  }

  /**
   * Initialize agent (Claude Code, Desktop, or Terminal)
   */
  async initializeAgent() {
    if (this.agent) return this.agent

    this.agentInfo = await agentDetector.detect()

    if (!this.agentInfo.isSupported) {
      throw new Error('Unsupported agent. Please use Claude Code, Claude Desktop, or Terminal.')
    }

    const Agent = require(`./infrastructure/agents/${this.agentInfo.type}-agent`)
    this.agent = new Agent()

    return this.agent
  }

  /**
   * Ensure project is initialized
   */
  async ensureProjectInit(projectPath) {
    if (await configManager.isConfigured(projectPath)) {
      return { success: true }
    }

    out.spin('initializing project...')
    const initResult = await this.init(null, projectPath)
    if (!initResult.success) {
      return initResult
    }
    return { success: true }
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
   * Get global project path
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
   * Log to memory
   */
  async logToMemory(projectPath, action, data) {
    try {
      const author = await this.ensureAuthor()
      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')

      const entry = {
        timestamp: dateHelper.getTimestamp(),
        action,
        data,
        author: author.name,
      }

      await jsonlHelper.appendJsonLine(memoryPath, entry)
    } catch (error) {
      // Non-critical - don't fail the command
    }
  }

  /**
   * /p:now - Set or show current task
   * AGENTIC EXECUTION
   */
  async now(task = null, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath, { task })

      if (task) {
        // MANDATORY: Assign agent before setting task
        const agentResult = await this._assignAgentForTask(task, projectPath, context)
        const agent = agentResult.agent?.name || 'generalist'
        const confidence = agentResult.routing?.confidence || 0.5

        // Set task WITH agent
        const nowContent = `# NOW\n\n**${task}**\n\nStarted: ${new Date().toLocaleString()}\nAgent: ${agent} (${Math.round(confidence * 100)}% confidence)\n`
        await toolRegistry.get('Write')(context.paths.now, nowContent)

        out.done(`${task} [${agent}]`)

        await this.logToMemory(projectPath, 'task_started', {
          task,
          agent,
          confidence,
          timestamp: dateHelper.getTimestamp(),
        })
        return { success: true, task, agent }
      } else {
        // Show current task
        const nowContent = await toolRegistry.get('Read')(context.paths.now)

        if (!nowContent || nowContent.includes('No current task')) {
          out.warn('no active task')
          return { success: true, message: 'No active task' }
        }

        // Extract task name and agent for minimal output
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const agentMatch = nowContent.match(/Agent: ([^\s(]+)/)
        const currentTask = taskMatch ? taskMatch[1] : 'unknown'
        const currentAgent = agentMatch ? agentMatch[1] : ''
        out.done(`working on: ${currentTask}${currentAgent ? ` [${currentAgent}]` : ''}`)
        return { success: true, content: nowContent }
      }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:done - Complete current task
   * AGENTIC EXECUTION
   */
  async done(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath)
      const nowContent = await toolRegistry.get('Read')(context.paths.now)

      // Validate: must have active task
      if (!nowContent || nowContent.includes('No current task') || nowContent.trim() === '# NOW') {
        out.warn('no active task')
        return { success: true, message: 'No active task to complete' }
      }

      // Extract task and duration
      const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
      const task = taskMatch ? taskMatch[1] : 'task'

      const startedMatch = nowContent.match(/Started: (.+)/)
      let duration = ''
      if (startedMatch) {
        const started = new Date(startedMatch[1])
        duration = dateHelper.calculateDuration(started)
      }

      // Clear now.md
      const emptyNow = '# NOW\n\nNo current task. Use `/p:now` to set focus.\n'
      await toolRegistry.get('Write')(context.paths.now, emptyNow)

      out.done(`${task}${duration ? ` (${duration})` : ''}`)

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        timestamp: dateHelper.getTimestamp(),
      })
      return { success: true, task, duration }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:next - Show priority queue
   * AGENTIC EXECUTION
   */
  async next(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath)
      const nextContent = await toolRegistry.get('Read')(context.paths.next)

      if (!nextContent || nextContent.trim() === '# NEXT\n\n## Priority Queue') {
        out.warn('queue empty')
        return { success: true, message: 'Queue is empty' }
      }

      // Count tasks for minimal output
      const taskCount = (nextContent.match(/^- \[/gm) || []).length
      out.done(`${taskCount} task${taskCount !== 1 ? 's' : ''} queued`)

      return { success: true, content: nextContent }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:init - Initialize prjct project
   * AGENTIC EXECUTION
   *
   * 3 modes:
   * 1. Existing project → analyze + generate agents
   * 2. Blank project + idea → ARCHITECT MODE
   * 3. Blank project no idea → ask for idea
   */
  async init(idea = null, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      // Check if already configured
      const isConfigured = await configManager.isConfigured(projectPath)

      if (isConfigured) {
        out.warn('already initialized')
        return { success: false, message: 'Already initialized' }
      }

      out.spin('initializing...')

      // Detect author from git
      const author = await authorDetector.detect()

      // Generate project ID from path hash
      const config = await configManager.createConfig(projectPath, author)
      const projectId = config.projectId

      out.spin('creating structure...')

      // Ensure global structure exists
      await pathManager.ensureProjectStructure(projectId)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Create base files
      // P1.1: Added patterns.json for Layered Memory System
      const baseFiles = {
        'core/now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
        'core/next.md': '# NEXT\n\n## Priority Queue\n\n',
        'core/context.md': '# CONTEXT\n\n',
        'progress/shipped.md': '# SHIPPED 🚀\n\n',
        'progress/metrics.md': '# METRICS\n\n',
        'planning/ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
        'planning/roadmap.md': '# ROADMAP\n\n',
        'planning/specs/.gitkeep': '# Specs directory - created by /p:spec\n',
        'memory/context.jsonl': '',
        'memory/patterns.json': JSON.stringify({
          version: 1,
          decisions: {},
          preferences: {},
          workflows: {},
          counters: {}
        }, null, 2),
      }

      for (const [filePath, content] of Object.entries(baseFiles)) {
        await toolRegistry.get('Write')(path.join(globalPath, filePath), content)
      }


      // Detect project state
      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      // MODE 1: Existing project
      if (hasCode || !isEmpty) {
        out.spin('analyzing project...')
        const analysisResult = await this.analyze({}, projectPath)

        if (analysisResult.success) {
          out.spin('generating agents...')
          await this.sync(projectPath)
          out.done('initialized')
          return { success: true, mode: 'existing', projectId }
        }
      }

      // MODE 2 & 3: Blank project
      if (isEmpty && !hasCode) {
        if (!idea) {
          out.done('blank project - provide idea for architect mode')
          return { success: true, mode: 'blank_no_idea', projectId }
        }

        // MODE 2: ARCHITECT MODE
        out.spin('architect mode...')
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session\n\n## Idea\n${idea}\n\n## Status\nInitialized - awaiting stack recommendation\n\nGenerated: ${new Date().toLocaleString()}\n`
        await toolRegistry.get('Write')(sessionPath, sessionContent)

        const commandInstaller = require('./infrastructure/command-installer')
        await commandInstaller.installGlobalConfig()

        out.done('architect mode ready')
        return { success: true, mode: 'architect', projectId, idea }
      }

      // Update global CLAUDE.md with latest instructions (fallback for any case)
      const commandInstaller = require('./infrastructure/command-installer')
      await commandInstaller.installGlobalConfig()

      out.done('initialized')
      return { success: true, projectId }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Detect if directory is empty (excluding common files)
   * @private
   */
  async _detectEmptyDirectory(projectPath) {
    try {
      const entries = await fileHelper.listFiles(projectPath)
      const meaningfulFiles = entries.filter(
        (name) =>
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'package.json' &&
          name !== 'package-lock.json' &&
          name !== 'README.md'
      )
      return meaningfulFiles.length === 0
    } catch {
      return true
    }
  }

  /**
   * Detect if directory has existing code
   * @private
   */
  async _detectExistingCode(projectPath) {
    try {
      const codePatterns = [
        'src',
        'lib',
        'app',
        'components',
        'pages',
        'api',
        'main.go',
        'main.rs',
        'main.py',
      ]
      const entries = await fileHelper.listFiles(projectPath)

      return entries.some((name) => codePatterns.includes(name))
    } catch {
      return false
    }
  }

  /**
   * All other commands - TODO: Migrate to agentic execution
   * For now, return "not implemented" message
   */
  /**
   * /p:feature - Add feature with value analysis, roadmap, and task breakdown
   * AGENTIC EXECUTION
   */
  async feature(description, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        out.fail('description required')
        return { success: false, error: 'Description required' }
      }

      out.spin(`planning ${description}...`)

      const context = await contextBuilder.build(projectPath, { description })

      // Task breakdown
      const tasks = this._breakdownFeatureTasks(description)

      // MANDATORY: Assign agent to each task
      const tasksWithAgents = []
      for (const taskDesc of tasks) {
        const agentResult = await this._assignAgentForTask(taskDesc, projectPath, context)
        const agent = agentResult.agent?.name || 'generalist'
        tasksWithAgents.push({ task: taskDesc, agent })
      }

      // Write to next.md with agents
      const nextContent =
        (await toolRegistry.get('Read')(context.paths.next)) || '# NEXT\n\n## Priority Queue\n\n'
      const taskSection =
        `\n## Feature: ${description}\n\n` +
        tasksWithAgents.map((t, i) => `${i + 1}. [${t.agent}] [ ] ${t.task}`).join('\n') +
        `\n\nEstimated: ${tasks.length * 2}h\n`

      await toolRegistry.get('Write')(context.paths.next, nextContent + taskSection)

      // Log to memory with agent assignments
      await this.logToMemory(projectPath, 'feature_planned', {
        feature: description,
        tasks: tasksWithAgents.length,
        assignments: tasksWithAgents.map(t => ({ task: t.task, agent: t.agent })),
        timestamp: dateHelper.getTimestamp(),
      })

      // Show summary with agent distribution
      const agentCounts = tasksWithAgents.reduce((acc, t) => {
        acc[t.agent] = (acc[t.agent] || 0) + 1
        return acc
      }, {})
      const agentSummary = Object.entries(agentCounts).map(([a, c]) => `${a}:${c}`).join(' ')

      out.done(`${tasks.length} tasks [${agentSummary}]`)

      return { success: true, feature: description, tasks: tasksWithAgents }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Breakdown feature into tasks
   * Claude would do intelligent breakdown based on feature description
   * @private
   */
  _breakdownFeatureTasks(description) {
    // AGENTIC: Claude analyzes and creates tasks via templates/analysis/task-breakdown.md
    // This returns a placeholder - real breakdown happens in template execution
    return [
      `Analyze and plan: ${description}`,
      'Implement core functionality',
      'Test and validate',
      'Document changes',
    ]
  }

  /**
   * /p:bug - Report and track bugs with auto-prioritization
   * AGENTIC EXECUTION
   */
  async bug(description, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        out.fail('bug description required')
        return { success: false, error: 'Description required' }
      }

      out.spin('tracking bug...')

      const context = await contextBuilder.build(projectPath, { description })
      const severity = this._detectBugSeverity(description)

      // MANDATORY: Assign agent to bug
      const agentResult = await this._assignAgentForTask(`fix bug: ${description}`, projectPath, context)
      const agent = agentResult.agent?.name || 'generalist'

      // Add to next.md with priority and agent
      const nextContent =
        (await toolRegistry.get('Read')(context.paths.next)) || '# NEXT\n\n## Priority Queue\n\n'
      const bugEntry = `\n## 🐛 BUG [${severity.toUpperCase()}] [${agent}]: ${description}\n\nReported: ${new Date().toLocaleString()}\nPriority: ${severity === 'critical' ? '⚠️ URGENT' : severity === 'high' ? '🔴 High' : '🟡 Normal'}\nAssigned: ${agent}\n`

      // Insert at top if critical/high, at bottom otherwise
      const updatedContent =
        severity === 'critical' || severity === 'high'
          ? nextContent.replace('## Priority Queue\n\n', `## Priority Queue\n\n${bugEntry}\n`)
          : nextContent + bugEntry

      await toolRegistry.get('Write')(context.paths.next, updatedContent)

      // Log to memory with agent
      await this.logToMemory(projectPath, 'bug_reported', {
        bug: description,
        severity,
        agent,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`bug [${severity}] → ${agent}`)

      return { success: true, bug: description, severity, agent }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Detect bug severity from description
   * Claude would do intelligent analysis
   * @private
   */
  _detectBugSeverity(description) {
    // AGENTIC: Claude assesses severity via templates/analysis/bug-severity.md
    // Returns default - real assessment happens in template execution
    return 'medium'
  }

  /**
   * /p:ship - Ship feature with complete automated workflow
   * AGENTIC EXECUTION
   */
  async ship(feature, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!feature) {
        // Try to infer from current task
        const context = await contextBuilder.build(projectPath)
        const nowContent = await toolRegistry.get('Read')(context.paths.now)
        if (nowContent && nowContent.includes('**')) {
          const match = nowContent.match(/\*\*(.+?)\*\*/)
          feature = match ? match[1] : 'current work'
        } else {
          feature = 'current work'
        }
      }

      out.spin(`shipping ${feature}...`)

      // Step 1: Lint
      const lintResult = await this._runLint(projectPath)

      // Step 2: Tests
      out.spin('running tests...')
      const testResult = await this._runTests(projectPath)

      // Step 3-5: Version + changelog
      out.spin('updating version...')
      const newVersion = await this._bumpVersion(projectPath)
      await this._updateChangelog(feature, newVersion, projectPath)

      // Step 6-7: Git commit + push
      out.spin('committing...')
      const commitResult = await this._createShipCommit(feature, projectPath)

      if (commitResult.success) {
        out.spin('pushing...')
        await this._gitPush(projectPath)
      }

      // Log to memory and shipped.md
      const context = await contextBuilder.build(projectPath)
      const shippedContent =
        (await toolRegistry.get('Read')(context.paths.shipped)) || '# SHIPPED 🚀\n\n'
      const shippedEntry = `\n## ${feature}\n\nShipped: ${new Date().toLocaleString()}\nVersion: ${newVersion}\n`
      await toolRegistry.get('Write')(context.paths.shipped, shippedContent + shippedEntry)

      await this.logToMemory(projectPath, 'feature_shipped', {
        feature,
        version: newVersion,
        timestamp: dateHelper.getTimestamp(),
      })

      // P1.1: Learn patterns from this ship
      const config = await configManager.getConfig(projectPath)
      const projectId = config.projectId

      // Record shipping workflow patterns
      await memorySystem.learnDecision(projectId, 'commit_footer', 'prjct', 'ship')

      // Track if tests were run (for quick_ship pattern learning)
      if (testResult.success) {
        await memorySystem.recordDecision(projectId, 'test_before_ship', 'true', 'ship')
      }

      // Record workflow if it's a quick ship (small changes)
      const isQuickShip = !lintResult.success || !testResult.success
      if (isQuickShip) {
        await memorySystem.recordWorkflow(projectId, 'quick_ship', {
          description: 'Ship without full checks',
          feature_type: feature.toLowerCase().includes('doc') ? 'docs' : 'other'
        })
      }

      out.done(`v${newVersion} shipped`)

      return { success: true, feature, version: newVersion }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Run lint checks
   * @private
   */
  async _runLint(_projectPath) {
    try {
      const { stderr } = await toolRegistry.get('Bash')('npm run lint 2>&1 || true')
      return { success: !stderr.includes('error'), message: 'passed' }
    } catch {
      return { success: false, message: 'no lint script (skipped)' }
    }
  }

  /**
   * Run tests
   * @private
   */
  async _runTests(_projectPath) {
    try {
      const { stderr } = await toolRegistry.get('Bash')(
        'npm test -- --passWithNoTests 2>&1 || true'
      )
      return { success: !stderr.includes('FAIL'), message: 'passed' }
    } catch {
      return { success: false, message: 'no test script (skipped)' }
    }
  }

  /**
   * Bump version
   * @private
   */
  async _bumpVersion(projectPath) {
    try {
      const pkgPath = path.join(projectPath, 'package.json')
      const pkg = await fileHelper.readJson(pkgPath, {})
      const oldVersion = pkg.version || '0.0.0'
      const [major, minor, patch] = oldVersion.split('.').map(Number)
      const newVersion = `${major}.${minor}.${patch + 1}`
      pkg.version = newVersion
      await fileHelper.writeJson(pkgPath, pkg)
      return newVersion
    } catch {
      return '0.0.1'
    }
  }

  /**
   * Update CHANGELOG
   * @private
   */
  async _updateChangelog(feature, version, projectPath) {
    try {
      const changelogPath = path.join(projectPath, 'CHANGELOG.md')
      const changelog = await fileHelper.readFile(changelogPath, '# Changelog\n\n')

      const entry = `## [${version}] - ${dateHelper.formatDate(new Date())}\n\n### Added\n- ${feature}\n\n`
      const updated = changelog.replace('# Changelog\n\n', `# Changelog\n\n${entry}`)

      await fileHelper.writeFile(changelogPath, updated)
    } catch (error) {
      console.error('   Warning: Could not update CHANGELOG')
    }
  }

  /**
   * Create git commit for ship
   * @private
   */
  async _createShipCommit(feature, _projectPath) {
    try {
      await toolRegistry.get('Bash')('git add .')

      const commitMsg = `feat: ${feature}\n\n🤖 Generated with [p/](https://www.prjct.app/)\nDesigned for [Claude](https://www.anthropic.com/claude)`

      await toolRegistry.get('Bash')(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`)

      return { success: true, message: 'Committed' }
    } catch {
      return { success: false, message: 'No changes to commit' }
    }
  }

  /**
   * Push to remote
   * @private
   */
  async _gitPush(_projectPath) {
    try {
      await toolRegistry.get('Bash')('git push')
      return { success: true, message: 'Pushed to remote' }
    } catch {
      return { success: false, message: 'Push failed (no remote or auth issue)' }
    }
  }

  /**
   * /p:context - Show project context and recent activity
   * AGENTIC EXECUTION
   */
  async context(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading context...')
      const context = await contextBuilder.build(projectPath)

      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      const nextContent = await toolRegistry.get('Read')(context.paths.next)

      // Extract summary
      let task = 'none'
      if (nowContent && !nowContent.includes('No current task')) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        task = taskMatch ? taskMatch[1] : 'active'
      }

      const nextLines = nextContent?.split('\n').filter((line) => line.trim() && !line.startsWith('#')) || []
      const queueCount = nextLines.length

      await this.logToMemory(projectPath, 'context_viewed', { timestamp: dateHelper.getTimestamp() })

      out.done(`task: ${task} | queue: ${queueCount}`)
      return { success: true }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:recap - Show project overview with progress
   * AGENTIC EXECUTION
   */
  async recap(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading recap...')
      const context = await contextBuilder.build(projectPath)

      const shippedContent = await toolRegistry.get('Read')(context.paths.shipped)
      const shippedFeatures = shippedContent?.split('##').filter((s) => s.trim() && !s.includes('SHIPPED')) || []

      const nextContent = await toolRegistry.get('Read')(context.paths.next)
      const nextTasks = nextContent?.split('\n').filter((l) => l.match(/^\d+\./) || l.includes('[ ]')).length || 0

      const ideasContent = await toolRegistry.get('Read')(context.paths.ideas)
      const ideas = ideasContent?.split('##').filter((s) => s.trim() && !s.includes('IDEAS') && !s.includes('Brain')).length || 0

      await this.logToMemory(projectPath, 'recap_viewed', {
        shipped: shippedFeatures.length,
        tasks: nextTasks,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`shipped: ${shippedFeatures.length} | queue: ${nextTasks} | ideas: ${ideas}`)
      return { success: true, stats: { shipped: shippedFeatures.length, tasks: nextTasks, ideas } }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:stuck - Get contextual help with problems
   * AGENTIC EXECUTION
   */
  async stuck(issue, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!issue) {
        out.fail('issue description required')
        return { success: false, error: 'Issue description required' }
      }

      out.spin('logging issue...')

      const analyzer = require('./domain/analyzer')
      analyzer.init(projectPath)
      const packageJson = await analyzer.readPackageJson()
      const detectedStack = packageJson?.name || 'project'

      await this.logToMemory(projectPath, 'help_requested', {
        issue,
        stack: detectedStack,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`issue logged: ${issue.slice(0, 40)}`)
      return { success: true, issue, stack: detectedStack }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:design - Design system architecture, APIs, and components
   * AGENTIC EXECUTION
   */
  /**
   * Memory cleanup helper
   * Rotates large JSONL files, archives old sessions, reports disk usage
   * @private
   */
  async _cleanupMemory(projectPath) {
    const projectId = await configManager.getProjectId(projectPath)

    const results = { rotated: [], totalSize: 0, freedSpace: 0 }
    const jsonlFiles = [
      pathManager.getFilePath(projectId, 'memory', 'context.jsonl'),
      pathManager.getFilePath(projectId, 'progress', 'shipped.md'),
      pathManager.getFilePath(projectId, 'planning', 'ideas.md'),
    ]

    for (const filePath of jsonlFiles) {
      try {
        const sizeMB = await jsonlHelper.getFileSizeMB(filePath)
        if (sizeMB > 0) {
          results.totalSize += sizeMB
          const rotated = await jsonlHelper.rotateJsonLinesIfNeeded(filePath, 10)
          if (rotated) {
            results.rotated.push(path.basename(filePath))
            results.freedSpace += sizeMB
          }
        }
      } catch {
        // skip
      }
    }

    return { success: true, results }
  }

  /**
   * Internal cleanup helper for memory during normal cleanup
   * @private
   */
  async _cleanupMemoryInternal(projectPath) {
    const projectId = await configManager.getProjectId(projectPath)

    // Silently rotate large files
    const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
    await jsonlHelper.rotateJsonLinesIfNeeded(memoryPath, 10)
  }

  async design(target = null, options = {}, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const designType = options.type || 'architecture'
      const validTypes = ['architecture', 'api', 'component', 'database', 'flow']

      if (!validTypes.includes(designType)) {
        out.fail(`invalid type: ${designType}`)
        return { success: false, error: 'Invalid design type' }
      }

      const designTarget = target || 'system'
      out.spin(`designing ${designType}...`)

      // Create designs directory if it doesn't exist
      const projectId = await configManager.getProjectId(projectPath)
      const designsPath = path.join(
        pathManager.getGlobalProjectPath(projectId),
        'planning',
        'designs'
      )
      await fileHelper.ensureDir(designsPath)

      // Generate design document based on type
      let designContent = ''

      switch (designType) {
        case 'architecture':
          designContent = this._generateArchitectureDesign(designTarget, projectPath)
          break
        case 'api':
          designContent = this._generateApiDesign(designTarget)
          break
        case 'component':
          designContent = this._generateComponentDesign(designTarget)
          break
        case 'database':
          designContent = this._generateDatabaseDesign(designTarget)
          break
        case 'flow':
          designContent = this._generateFlowDesign(designTarget)
          break
      }

      // Save design document
      const designFileName = `${designType}-${designTarget.toLowerCase().replace(/\s+/g, '-')}.md`
      const designFilePath = path.join(designsPath, designFileName)
      await fileHelper.writeFile(designFilePath, designContent)

      await this.logToMemory(projectPath, 'design_created', {
        type: designType,
        target: designTarget,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${designType} design created`)
      return { success: true, designPath: designFilePath, type: designType, target: designTarget }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Generate architecture design document
   * @private
   */
  _generateArchitectureDesign(target, projectPath) {
    // AGENTIC: Claude generates via templates/design/architecture.md
    return `# Architecture Design: ${target}\n\n*Use templates/design/architecture.md for full design*\n`
  }

  /**
   * Generate API design document
   * @private
   */
  _generateApiDesign(target) {
    // AGENTIC: Claude generates via templates/design/api.md
    return `# API Design: ${target}\n\n*Use templates/design/api.md for full design*\n`
  }

  /**
   * Generate component design document
   * @private
   */
  _generateComponentDesign(target) {
    // AGENTIC: Claude generates via templates/design/component.md
    return `# Component Design: ${target}\n\n*Use templates/design/component.md for full design*\n`
  }

  /**
   * Generate database design document
   * @private
   */
  _generateDatabaseDesign(target) {
    // AGENTIC: Claude generates via templates/design/database.md
    return `# Database Design: ${target}\n\n*Use templates/design/database.md for full design*\n`
  }

  /**
   * Generate flow design document
   * @private
   */
  _generateFlowDesign(target) {
    // AGENTIC: Claude generates via templates/design/flow.md
    return `# Flow Design: ${target}\n\n*Use templates/design/flow.md for full design*\n`
  }

  /**
   * /p:cleanup - Clean temp files and old entries
   * AGENTIC EXECUTION
   */
  async cleanup(_options = {}, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const isMemoryMode = _options.memory === true || _options.type === 'memory'

      if (isMemoryMode) {
        out.spin('cleaning memory...')
        const result = await this._cleanupMemory(projectPath)
        out.done('memory cleaned')
        return result
      }

      out.spin('cleaning up...')

      const context = await contextBuilder.build(projectPath)
      const projectId = await configManager.getProjectId(projectPath)

      const cleaned = []

      // Clean old memory entries (keep last 100)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      try {
        const entries = await jsonlHelper.readJsonLines(memoryPath)

        if (entries.length > 100) {
          const kept = entries.slice(-100)
          await jsonlHelper.writeJsonLines(memoryPath, kept)
          cleaned.push(`Memory: ${entries.length - 100} old entries removed`)
        } else {
          cleaned.push('Memory: No cleanup needed')
        }
      } catch {
        cleaned.push('Memory: No file found')
      }

      // Clean empty ideas sections
      const ideasPath = context.paths.ideas
      try {
        const ideasContent = await toolRegistry.get('Read')(ideasPath)
        const sections = ideasContent.split('##').filter((s) => s.trim())

        // Remove empty sections
        const nonEmpty = sections.filter((section) => {
          const lines = section
            .trim()
            .split('\n')
            .filter((l) => l.trim())
          return lines.length > 1 // Keep if has more than just title
        })

        if (sections.length !== nonEmpty.length) {
          const newContent =
            '# IDEAS 💡\n\n## Brain Dump\n\n' +
            nonEmpty
              .slice(1)
              .map((s) => '## ' + s.trim())
              .join('\n\n')
          await toolRegistry.get('Write')(ideasPath, newContent)
          cleaned.push(`Ideas: ${sections.length - nonEmpty.length} empty sections removed`)
        } else {
          cleaned.push('Ideas: No cleanup needed')
        }
      } catch {
        cleaned.push('Ideas: No file found')
      }

      // Clean completed tasks from next.md (optional - user decides)
      const nextPath = context.paths.next
      try {
        const nextContent = await toolRegistry.get('Read')(nextPath)
        const completedTasks = (nextContent.match(/\[x\]/gi) || []).length

        if (completedTasks > 0) {
          cleaned.push(
            `Queue: ${completedTasks} completed tasks found (not removed - use /p:done to clear)`
          )
        } else {
          cleaned.push('Queue: No completed tasks')
        }
      } catch {
        cleaned.push('Queue: No file found')
      }

      await this._cleanupMemoryInternal(projectPath)

      await this.logToMemory(projectPath, 'cleanup_performed', {
        items: cleaned.length,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${cleaned.length} items cleaned`)
      return { success: true, cleaned }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:progress - Show metrics for period
   * AGENTIC EXECUTION
   */
  async progress(period = 'week', projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const validPeriods = ['day', 'week', 'month', 'all']
      if (!validPeriods.includes(period)) period = 'week'

      out.spin(`loading ${period} progress...`)

      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')

      const startDate = period === 'day' ? dateHelper.getDaysAgo(1) :
                        period === 'week' ? dateHelper.getDaysAgo(7) :
                        period === 'month' ? dateHelper.getDaysAgo(30) : new Date(0)

      let entries = []
      try {
        const allEntries = await jsonlHelper.readJsonLines(memoryPath)
        entries = allEntries.filter((e) => new Date(e.timestamp) >= startDate)
      } catch { entries = [] }

      const metrics = {
        tasksCompleted: entries.filter((e) => e.action === 'task_completed').length,
        featuresShipped: entries.filter((e) => e.action === 'feature_shipped').length,
        totalActions: entries.length,
      }

      await this.logToMemory(projectPath, 'progress_viewed', { period, metrics, timestamp: dateHelper.getTimestamp() })

      out.done(`${period}: ${metrics.tasksCompleted} tasks | ${metrics.featuresShipped} shipped`)
      return { success: true, period, metrics }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * /p:roadmap - Show roadmap with ASCII logic maps
   * AGENTIC EXECUTION
   */
  async roadmap(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      out.spin('loading roadmap...')
      const context = await contextBuilder.build(projectPath)
      const roadmapContent = await toolRegistry.get('Read')(context.paths.roadmap)

      if (!roadmapContent || roadmapContent.trim() === '# ROADMAP') {
        out.warn('no roadmap yet')
        return { success: true, message: 'No roadmap' }
      }

      // Count features in roadmap
      const features = (roadmapContent.match(/##/g) || []).length

      await this.logToMemory(projectPath, 'roadmap_viewed', { timestamp: dateHelper.getTimestamp() })

      out.done(`${features} features in roadmap`)
      return { success: true, content: roadmapContent }
    } catch (error) {
      out.fail(error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Generate roadmap template
   * @private
   */
  _generateRoadmapTemplate() {
    return `
# ROADMAP

## Q1 2025 - Foundation

\`\`\`
[Authentication] ──┐
                   ├──> [User Management] ──> [Dashboard]
[Database Setup] ──┘
\`\`\`

Status: 🟢 In Progress

## Q2 2025 - Core Features

\`\`\`
[API v1] ──┐
           ├──> [Integration] ──> [Beta Launch]
[UI v2] ───┘
\`\`\`

Status: ⏸️  Planned

## Dependencies

- Authentication → User Management
- Database Setup → Authentication
- API v1 + UI v2 → Integration
`
  }

  /**
   * /p:status - KPI dashboard with ASCII graphics
   * AGENTIC EXECUTION
   */
  async status(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      console.log('📊 Project Status Dashboard\n')

      const context = await contextBuilder.build(projectPath)

      // Read project data
      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      const nextContent = await toolRegistry.get('Read')(context.paths.next)
      const shippedContent = await toolRegistry.get('Read')(context.paths.shipped)
      const ideasContent = await toolRegistry.get('Read')(context.paths.ideas)

      // Calculate stats
      const stats = {
        activeTask: nowContent && !nowContent.includes('No current task'),
        tasksInQueue:
          nextContent
            ?.split('\n')
            .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]')).length || 0,
        featuresShipped:
          shippedContent
            ?.split('##')
            .filter((section) => section.trim() && !section.includes('SHIPPED 🚀')).length || 0,
        ideasCaptured:
          ideasContent
            ?.split('##')
            .filter(
              (section) =>
                section.trim() && !section.includes('IDEAS 💡') && !section.includes('Brain Dump')
            ).length || 0,
      }

      // Header
      console.log('═══════════════════════════════════════════════════')
      console.log(`  ${path.basename(projectPath)} - Status Overview`)
      console.log('═══════════════════════════════════════════════════\n')

      // Current Focus
      console.log('## 🎯 Current Focus\n')
      if (stats.activeTask) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const task = taskMatch ? taskMatch[1] : 'Active task'
        const startedMatch = nowContent.match(/Started: (.+)/)
        const started = startedMatch ? startedMatch[1] : 'Unknown'
        console.log(`   📌 ${task}`)
        console.log(`   ⏱️  Started: ${started}\n`)
      } else {
        console.log('   No active task\n')
      }

      // Queue Status
      console.log('## 📋 Queue Status\n')
      console.log(`   Tasks in Queue: ${stats.tasksInQueue}`)
      this._renderProgressBar('Queue Load', stats.tasksInQueue, 20)
      console.log('')

      // Shipped Features
      console.log('## 🚀 Shipped Features\n')
      console.log(`   Features Shipped: ${stats.featuresShipped}`)
      this._renderProgressBar('Progress', stats.featuresShipped, 10)
      console.log('')

      // Ideas Backlog
      console.log('## 💡 Ideas Backlog\n')
      console.log(`   Ideas Captured: ${stats.ideasCaptured}`)
      this._renderProgressBar('Backlog', stats.ideasCaptured, 15)
      console.log('')

      // Overall Health
      console.log('## 💚 Overall Health\n')
      const health = this._calculateHealth(stats)
      console.log(`   Health Score: ${health.score}/100`)
      this._renderProgressBar('Health', health.score, 100)
      console.log(`   ${health.message}\n`)

      console.log('💡 Next steps:')
      console.log('• /p:now → Start working on a task')
      console.log('• /p:feature → Add new feature')
      console.log('• /p:ship → Ship completed work')

      await this.logToMemory(projectPath, 'status_viewed', {
        stats,
        health: health.score,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, stats, health }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Render ASCII progress bar
   * @private
   */
  _renderProgressBar(label, value, max) {
    const percentage = Math.min(100, Math.round((value / max) * 100))
    const barLength = 30
    const filled = Math.round((percentage / 100) * barLength)
    const empty = barLength - filled

    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    console.log(`   ${label}: [${bar}] ${percentage}%`)
  }

  /**
   * Calculate project health score
   * @private
   */
  _calculateHealth(stats) {
    // AGENTIC: Claude evaluates health via templates/analysis/health.md
    // Simple calculation - real assessment happens in template execution
    const hasActivity = stats.activeTask || stats.featuresShipped > 0
    return {
      score: hasActivity ? 70 : 50,
      message: hasActivity ? '🟢 Active' : '🟡 Ready to start',
    }
  }

  /**
   * /p:build - Start task with agent assignment
   * AGENTIC EXECUTION
   */
  async build(taskOrNumber, projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const context = await contextBuilder.build(projectPath, { task: taskOrNumber })

      // Check if already working on something
      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      if (nowContent && !nowContent.includes('No current task')) {
        console.log('⚠️  Already working on a task!')
        console.log('   Complete it with /p:done first\n')
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const currentTask = taskMatch ? taskMatch[1] : 'current task'
        console.log(`   Current: ${currentTask}`)
        return { success: false, message: 'Task already active' }
      }

      let task = taskOrNumber

      // If number, get from queue
      if (!isNaN(taskOrNumber)) {
        const nextContent = await toolRegistry.get('Read')(context.paths.next)
        const tasks = nextContent
          .split('\n')
          .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]'))

        const index = parseInt(taskOrNumber) - 1
        if (index >= 0 && index < tasks.length) {
          task = tasks[index].replace(/^\d+\.\s*\[.\]\s*/, '').trim()
          console.log(`📋 Selected from queue: ${task}\n`)
        } else {
          console.log(`❌ Invalid task number. Queue has ${tasks.length} tasks.`)
          console.log('   Use /p:next to see queue')
          return { success: false, error: 'Invalid task number' }
        }
      }

      if (!task) {
        console.log('❌ Task description required')
        console.log('Usage: /p:build "task description"')
        console.log('   or: /p:build 1 (select from queue)')
        return { success: false, error: 'Task required' }
      }

      console.log(`🏗️  Building: ${task}\n`)

      // Detect complexity and estimate
      const complexity = this._detectComplexity(task)
      const estimate = complexity.hours

      console.log('📊 Analysis:')
      console.log(`   Complexity: ${complexity.level}`)
      console.log(`   Estimated: ${estimate}h`)
      console.log(`   Type: ${complexity.type}\n`)

      // MANDATORY: Assign agent using router
      const agentResult = await this._assignAgentForTask(task, projectPath, context)
      const agent = agentResult.agent?.name || 'generalist'
      const confidence = agentResult.routing?.confidence || 0.5
      console.log(`🤖 Agent: ${agent} (${Math.round(confidence * 100)}% confidence)\n`)

      // Set as current task with metadata
      const nowContentNew = `# NOW

**${task}**

Started: ${new Date().toLocaleString()}
Estimated: ${estimate}h
Complexity: ${complexity.level}
Agent: ${agent} (${Math.round(confidence * 100)}% confidence)
`
      await toolRegistry.get('Write')(context.paths.now, nowContentNew)

      console.log('✅ Task started!\n')
      console.log('💡 Next steps:')
      console.log('• Start coding')
      console.log('• /p:done → Mark complete')
      console.log('• /p:stuck → Get help if needed')

      await this.logToMemory(projectPath, 'task_built', {
        task,
        complexity: complexity.level,
        estimate,
        agent,
        confidence,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, task, complexity, estimate, agent }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Detect task complexity
   * @private
   */
  _detectComplexity(task) {
    // AGENTIC: Claude analyzes complexity via templates/analysis/complexity.md
    // Returns default - real analysis happens in template execution
    return { level: 'medium', hours: 4, type: 'feature' }
  }

  /**
   * Assign agent for a task
   * AGENTIC: Claude decides via templates/agent-assignment.md
   * JS only orchestrates: load agents → build context → delegate to Claude
   * @private
   */
  async _assignAgentForTask(taskDescription, projectPath, context) {
    try {
      const projectId = await configManager.getProjectId(projectPath)

      // ORCHESTRATION ONLY: Load available agents
      const agentsPath = pathManager.getPath(projectId, 'agents')
      const agentFiles = await fileHelper.listFiles(agentsPath, '.md')
      const agents = agentFiles.map(f => f.replace('.md', ''))

      // ORCHESTRATION ONLY: Build context for Claude
      const assignmentContext = {
        task: taskDescription,
        agents: agents.join(', ') || 'generalist',
        projectPath,
        // Claude will use this context + template to decide
      }

      // AGENTIC: Claude decides agent via template
      // The template templates/agent-assignment.md guides Claude's decision
      // For now, return structure that prompt-builder will use with template
      return {
        agent: { name: agents[0] || 'generalist', domain: 'auto' },
        routing: {
          confidence: 0.8,
          reason: 'Claude assigns via templates/agent-assignment.md',
          availableAgents: agents
        },
        _agenticNote: 'Use templates/agent-assignment.md for actual assignment'
      }
    } catch (error) {
      // Fallback - still return structure
      return {
        agent: { name: 'generalist', domain: 'general' },
        routing: { confidence: 0.5, reason: 'Fallback - no agents found' }
      }
    }
  }

  /**
   * Auto-assign agent based on task (sync wrapper for backward compat)
   * DEPRECATED: Use _assignAgentForTask instead
   * @private
   */
  _autoAssignAgent(task) {
    // For backward compatibility, return generalist synchronously
    // New code should use _assignAgentForTask() which is async
    console.warn('DEPRECATED: Use _assignAgentForTask() for proper agent routing')
    return 'generalist'
  }

  /**
   * /p:analyze - Analyze repository and generate summary
   * AGENTIC EXECUTION
   */
  async analyze(options = {}, projectPath = process.cwd()) {
    try {
      await this.initializeAgent()

      console.log('🔍 Analyzing repository...\n')

      // Initialize analyzer for this project
      const analyzer = require('./domain/analyzer')
      analyzer.init(projectPath)

      // Build context
      const context = await contextBuilder.build(projectPath, options)

      // Collect data using analyzer helpers (ZERO predetermined patterns)
      const analysisData = {
        // Package managers
        packageJson: await analyzer.readPackageJson(),
        cargoToml: await analyzer.readCargoToml(),
        goMod: await analyzer.readGoMod(),
        requirements: await analyzer.readRequirements(),

        // Project structure
        directories: await analyzer.listDirectories(),
        fileCount: await analyzer.countFiles(),

        // Git data
        gitStats: await analyzer.getGitStats(),
        gitLog: await analyzer.getGitLog(20),

        // Common files
        hasDockerfile: await analyzer.fileExists('Dockerfile'),
        hasDockerCompose: await analyzer.fileExists('docker-compose.yml'),
        hasReadme: await analyzer.fileExists('README.md'),
        hasTsconfig: await analyzer.fileExists('tsconfig.json'),
        hasViteConfig:
          (await analyzer.fileExists('vite.config.ts')) ||
          (await analyzer.fileExists('vite.config.js')),
        hasNextConfig:
          (await analyzer.fileExists('next.config.js')) ||
          (await analyzer.fileExists('next.config.mjs')),
      }

      // Generate summary (Claude decides what's relevant based on data found)
      const summary = this._generateAnalysisSummary(analysisData, projectPath)

      // Save to analysis/repo-summary.md
      const summaryPath =
        context.paths.analysis ||
        pathManager.getFilePath(
          await configManager.getProjectId(projectPath),
          'analysis',
          'repo-summary.md'
        )

      await toolRegistry.get('Write')(summaryPath, summary)

      // Log to memory
      await this.logToMemory(projectPath, 'repository_analyzed', {
        timestamp: dateHelper.getTimestamp(),
        fileCount: analysisData.fileCount,
        gitCommits: analysisData.gitStats.totalCommits,
      })

      // Generate dynamic context for Claude
      const contextSync = require('./context-sync')
      const projectId = await configManager.getProjectId(projectPath)
      await contextSync.generateLocalContext(projectPath, projectId)

      // Update global CLAUDE.md with latest instructions
      const commandInstaller = require('./infrastructure/command-installer')
      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log('📝 Updated ~/.claude/CLAUDE.md')
      }

      console.log('✅ Analysis complete!\n')
      console.log('📄 Full report: analysis/repo-summary.md')
      console.log('📝 Context: ~/.prjct-cli/projects/' + projectId + '/CLAUDE.md\n')
      console.log('Next steps:')
      console.log('• /p:sync → Generate agents based on stack')
      console.log('• /p:feature → Add a new feature')

      return {
        success: true,
        summaryPath,
        data: analysisData,
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Generate analysis summary from collected data
   * Claude decides what's relevant - NO predetermined patterns
   * @private
   */
  _generateAnalysisSummary(data, projectPath) {
    const lines = []

    lines.push('# Repository Analysis\n')
    lines.push(`Generated: ${new Date().toLocaleString()}\n`)

    // Project name from path
    const projectName = path.basename(projectPath)
    lines.push(`## Project: ${projectName}\n`)

    // Technologies detected (based on what files exist)
    lines.push('## Stack Detected\n')

    if (data.packageJson) {
      lines.push('### JavaScript/TypeScript\n')
      lines.push('- **Package Manager**: npm/yarn/pnpm')
      if (data.packageJson.dependencies) {
        const deps = Object.keys(data.packageJson.dependencies)
        if (deps.length > 0) {
          lines.push(
            `- **Dependencies**: ${deps.slice(0, 10).join(', ')}${deps.length > 10 ? ` (+${deps.length - 10} more)` : ''}`
          )
        }
      }
      if (data.hasNextConfig) lines.push('- **Framework**: Next.js detected')
      if (data.hasViteConfig) lines.push('- **Build Tool**: Vite detected')
      if (data.hasTsconfig) lines.push('- **Language**: TypeScript')
      lines.push('')
    }

    if (data.cargoToml) {
      lines.push('### Rust\n')
      lines.push('- **Package Manager**: Cargo')
      lines.push('- **Language**: Rust\n')
    }

    if (data.goMod) {
      lines.push('### Go\n')
      lines.push('- **Package Manager**: Go modules')
      lines.push('- **Language**: Go\n')
    }

    if (data.requirements) {
      lines.push('### Python\n')
      lines.push('- **Package Manager**: pip')
      lines.push('- **Language**: Python\n')
    }

    // Project structure
    lines.push('## Structure\n')
    lines.push(`- **Total Files**: ${data.fileCount}`)
    lines.push(
      `- **Directories**: ${data.directories.slice(0, 15).join(', ')}${data.directories.length > 15 ? ` (+${data.directories.length - 15} more)` : ''}`
    )

    if (data.hasDockerfile) lines.push('- **Docker**: Detected')
    if (data.hasDockerCompose) lines.push('- **Docker Compose**: Detected')
    if (data.hasReadme) lines.push('- **Documentation**: README.md found')
    lines.push('')

    // Git stats
    lines.push('## Git Statistics\n')
    lines.push(`- **Total Commits**: ${data.gitStats.totalCommits}`)
    lines.push(`- **Contributors**: ${data.gitStats.contributors}`)
    lines.push(`- **Age**: ${data.gitStats.age}`)
    lines.push('')

    // Recent activity (if available)
    if (data.gitLog) {
      lines.push('## Recent Activity\n')
      const logLines = data.gitLog.split('\n').slice(0, 5)
      logLines.forEach((line) => {
        if (line.trim()) {
          const [hash, , time, msg] = line.split('|')
          lines.push(`- \`${hash}\` ${msg} (${time})`)
        }
      })
      lines.push('')
    }

    // Recommendations
    lines.push('## Recommendations\n')
    lines.push('Based on detected stack, consider generating specialized agents using `/p:sync`.\n')

    lines.push('---\n')
    lines.push(
      '*This analysis was generated automatically. For updated information, run `/p:analyze` again.*\n'
    )

    return lines.join('\n')
  }

  /**
   * /p:sync - Sync project state and generate dynamic agents
   * AGENTIC EXECUTION
   */
  async sync(projectPath = process.cwd()) {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      await this.initializeAgent()

      console.log('🔄 Syncing project state...\n')

      // Build context
      const context = await contextBuilder.build(projectPath)

      // Step 1: Run analysis to get current state
      console.log('📊 Running analysis...')
      const analysisResult = await this.analyze({}, projectPath)

      if (!analysisResult.success) {
        console.error('❌ Analysis failed')
        return analysisResult
      }

      // Step 2: Read analysis/repo-summary.md
      const summaryContent = await toolRegistry.get('Read')(context.paths.analysis)

      if (!summaryContent) {
        console.error('❌ No analysis found. Run /p:analyze first.')
        return { success: false, error: 'No analysis found' }
      }

      console.log('✅ Analysis loaded\n')

      // Step 3: Generate dynamic agents based on stack detected
      // Claude reads the summary and decides what specialists to create
      console.log('🤖 Generating specialized agents...\n')

      const projectId = await configManager.getProjectId(projectPath)
      const AgentGenerator = require('./domain/agent-generator')
      const generator = new AgentGenerator(projectId)

      const generatedAgents = await this._generateAgentsFromAnalysis(summaryContent, generator, projectPath)

      // Step 4: Log to memory
      await this.logToMemory(projectPath, 'agents_generated', {
        timestamp: dateHelper.getTimestamp(),
        agents: generatedAgents,
        count: generatedAgents.length,
      })

      // Generate dynamic context for Claude
      const contextSync = require('./context-sync')
      await contextSync.generateLocalContext(projectPath, projectId)

      // Update global CLAUDE.md with latest instructions
      const commandInstaller = require('./infrastructure/command-installer')
      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log('📝 Updated ~/.claude/CLAUDE.md')
      }

      console.log('\n✅ Sync complete!\n')
      console.log(`🤖 Agents Generated: ${generatedAgents.length}`)
      generatedAgents.forEach((agent) => {
        console.log(`   • ${agent}`)
      })
      console.log('📝 Context: ~/.prjct-cli/projects/' + projectId + '/CLAUDE.md')
      console.log('\n📋 Based on: analysis/repo-summary.md')
      console.log('💡 See templates/agents/AGENTS.md for reference\n')
      console.log('Next steps:')
      console.log('• /p:context → View project state')
      console.log('• /p:feature → Add a feature')

      return {
        success: true,
        agents: generatedAgents,
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Generate agents dynamically from analysis summary
   * 100% AGENTIC - Uses analyzer for raw data, Claude decides
   * NO hardcoded categorization or framework lists
   * @private
   */
  async _generateAgentsFromAnalysis(summaryContent, generator, projectPath) {
    const agents = []

    // 100% AGENTIC: Get raw project data, let Claude decide
    const analyzer = require('./domain/analyzer')
    analyzer.init(projectPath)

    const projectData = {
      packageJson: await analyzer.readPackageJson(),
      extensions: await analyzer.getFileExtensions(),
      directories: await analyzer.listDirectories(),
      configFiles: await analyzer.listConfigFiles(),
      analysisSummary: summaryContent,
      projectPath
    }

    // Let the generator decide what agents to create
    // It reads templates/agents/AGENTS.md and decides based on actual project
    const generatedAgents = await generator.generateAgentsFromTech(projectData)

    // Return agent names
    generatedAgents.forEach(agent => agents.push(agent.name || agent))

    return agents
  }

  /**
   * First-time setup - Install commands to editors
   */
  async start() {
    const commandInstaller = require('./infrastructure/command-installer')

    console.log('🚀 Setting up prjct for Claude...\n')

    // Check if Claude is installed
    const status = await commandInstaller.checkInstallation()

    if (!status.claudeDetected) {
      return {
        success: false,
        message:
          '❌ Claude not detected.\n\nPlease install Claude Code or Claude Desktop first:\n' +
          '  - Claude Code: https://claude.com/code\n' +
          '  - Claude Desktop: https://claude.com/desktop',
      }
    }

    // Install commands
    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.installCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Installation failed: ${result.error}`,
      }
    }

    console.log(`\n✅ Installed ${result.installed.length} commands to:\n   ${result.path}`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${result.errors.length} errors:`)
      result.errors.forEach((e) => console.log(`   - ${e.file}: ${e.error}`))
    }

    console.log('\n🎉 Setup complete!')
    console.log('\nNext steps:')
    console.log('  1. Open Claude Code or Claude Desktop')
    console.log('  2. Navigate to your project')
    console.log('  3. Run: /p:init')

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Reconfigure editor installations
   */
  async setup(options = {}) {
    const commandInstaller = require('./infrastructure/command-installer')

    console.log('🔧 Reconfiguring prjct...\n')

    if (options.force) {
      console.log('🗑️  Removing existing installation...')
      await commandInstaller.uninstallCommands()
    }

    // Reinstall commands
    console.log('📦 Installing /p:* commands...')
    const result = await commandInstaller.updateCommands()

    if (!result.success) {
      return {
        success: false,
        message: `❌ Setup failed: ${result.error}`,
      }
    }

    console.log(`\n✅ Installed ${result.installed.length} commands`)

    if (result.errors.length > 0) {
      console.log(`\n⚠️  ${result.errors.length} errors:`)
      result.errors.forEach((e) => console.log(`   - ${e.file}: ${e.error}`))
    }

    // Install global configuration
    console.log('\n📝 Installing global configuration...')
    const configResult = await commandInstaller.installGlobalConfig()

    if (configResult.success) {
      if (configResult.action === 'created') {
        console.log('✅ Created ~/.claude/CLAUDE.md')
      } else if (configResult.action === 'updated') {
        console.log('✅ Updated ~/.claude/CLAUDE.md')
      } else if (configResult.action === 'appended') {
        console.log('✅ Added prjct config to ~/.claude/CLAUDE.md')
      }
    } else {
      console.log(`⚠️  ${configResult.error}`)
    }

    console.log('\n🎉 Setup complete!\n')

    // Show beautiful ASCII art
    this.showAsciiArt()

    return {
      success: true,
      message: '',
    }
  }

  /**
   * Show beautiful ASCII art with quick start
   */
  showAsciiArt() {
    const chalk = require('chalk')

    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('   ██████╗ ██████╗      ██╗ ██████╗████████╗'))
    console.log(chalk.bold.cyan('   ██╔══██╗██╔══██╗     ██║██╔════╝╚══██╔══╝'))
    console.log(chalk.bold.cyan('   ██████╔╝██████╔╝     ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██╔═══╝ ██╔══██╗██   ██║██║        ██║'))
    console.log(chalk.bold.cyan('   ██║     ██║  ██║╚█████╔╝╚██████╗   ██║'))
    console.log(chalk.bold.cyan('   ╚═╝     ╚═╝  ╚═╝ ╚════╝  ╚═════╝   ╚═╝'))
    console.log('')
    console.log(`   ${chalk.bold.cyan('prjct')}${chalk.magenta('/')}${chalk.green('cli')}  ${chalk.dim.white('v' + VERSION + ' installed')}`)
    console.log('')
    console.log(`   ${chalk.yellow('⚡')} Ship faster with zero friction`)
    console.log(`   ${chalk.green('📝')} From idea to technical tasks in minutes`)
    console.log(`   ${chalk.cyan('🤖')} Perfect context for AI agents`)
    console.log('')
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'))
    console.log('')
    console.log(chalk.bold.cyan('🚀 Quick Start'))
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.bold('1.')} Initialize your project:`)
    console.log(`     ${chalk.green('cd your-project && prjct init')}`)
    console.log('')
    console.log(`  ${chalk.bold('2.')} Set your current focus:`)
    console.log(`     ${chalk.green('prjct now "build auth"')}`)
    console.log('')
    console.log(`  ${chalk.bold('3.')} Ship & celebrate:`)
    console.log(`     ${chalk.green('prjct ship "user login"')}`)
    console.log('')
    console.log(chalk.dim('─────────────────────────────────────────────────'))
    console.log('')
    console.log(`  ${chalk.dim('Documentation:')} ${chalk.cyan('https://prjct.app')}`)
    console.log(`  ${chalk.dim('Report issues:')} ${chalk.cyan('https://github.com/jlopezlira/prjct-cli/issues')}`)
    console.log('')
    console.log(chalk.bold.magenta('Happy shipping! 🚀'))
    console.log('')
  }

  /**
   * Migrate all legacy projects
   */
  async migrateAll(options = {}) {
    const fs = require('fs').promises
    const path = require('path')

    console.log('🔄 Scanning for legacy prjct projects...\n')

    const homeDir = require('os').homedir()
    const globalRoot = path.join(homeDir, '.prjct-cli', 'projects')

    // Get all project IDs
    let projectIds = []
    try {
      const dirs = await fs.readdir(globalRoot)
      projectIds = dirs.filter((d) => !d.startsWith('.'))
    } catch (error) {
      return {
        success: false,
        message: '❌ No prjct projects found',
      }
    }

    console.log(`📁 Found ${projectIds.length} projects in global storage\n`)

    const migrated = []
    const failed = []
    const skipped = []

    for (const projectId of projectIds) {
      // Read global config to get project path
      const globalConfig = await configManager.readGlobalConfig(projectId)
      if (!globalConfig || !globalConfig.projectPath) {
        skipped.push({ projectId, reason: 'No project path in config' })
        continue
      }

      const projectPath = globalConfig.projectPath

      // Check if needs migration
      if (!(await migrator.needsMigration(projectPath))) {
        skipped.push({ projectId, reason: 'Already migrated' })
        continue
      }

      console.log(`🔄 Migrating: ${projectPath}`)

      try {
        const result = await migrator.migrate(projectPath, options)

        if (result.success) {
          migrated.push({ projectId, path: projectPath })
          console.log(`   ✅ ${result.message}`)
        } else {
          failed.push({ projectId, path: projectPath, error: result.message })
          console.log(`   ❌ ${result.message}`)
        }
      } catch (error) {
        failed.push({ projectId, path: projectPath, error: error.message })
        console.log(`   ❌ ${error.message}`)
      }

      console.log('')
    }

    // Summary
    console.log('\n📊 Migration Summary:')
    console.log(`   ✅ Migrated: ${migrated.length}`)
    console.log(`   ⏭️  Skipped: ${skipped.length}`)
    console.log(`   ❌ Failed: ${failed.length}`)

    if (failed.length > 0) {
      console.log('\n❌ Failed migrations:')
      failed.forEach((f) => console.log(`   - ${f.path}: ${f.error}`))
    }

    return {
      success: failed.length === 0,
      message: '',
    }
  }

  /**
   * Execute architect plan and generate code
   */
  async architect(action = 'execute', projectPath = process.cwd()) {
    if (action !== 'execute') {
      return {
        success: false,
        message: '❌ Invalid action. Use: /p:architect execute',
      }
    }

    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      console.log('🏗️  Architect Mode - Code Generation\n')

      const globalPath = await this.getGlobalProjectPath(projectPath)

      // Check if there's a completed plan
      const planPath = path.join(globalPath, 'planning', 'architect-session.md')

      let planContent
      try {
        planContent = await fileHelper.readFile(planPath)
      } catch (error) {
        return {
          success: false,
          message:
            '❌ No architect plan found.\n\n' +
            'Create a plan first:\n' +
            '  1. Run /p:init in an empty directory\n' +
            '  2. Answer the discovery questions\n' +
            '  3. Plan will be auto-generated\n' +
            '  4. Then run /p:architect execute',
        }
      }

      if (!planContent || planContent.trim() === '') {
        return {
          success: false,
          message: '❌ Architect plan is empty',
        }
      }

      console.log('📋 Reading architect plan...\n')

      // Extract key information from plan
      const ideaMatch = planContent.match(/## Project Idea\n(.+)/s)
      const stackMatch = planContent.match(/\*\*Stack:\*\*\n([\s\S]+?)\n\n/)
      const stepsMatch = planContent.match(/\*\*Implementation Steps:\*\*\n([\s\S]+?)\n\n/)

      const idea = ideaMatch ? ideaMatch[1].split('\n')[0].trim() : 'Unknown project'
      const stack = stackMatch ? stackMatch[1] : 'Not specified'
      const steps = stepsMatch ? stepsMatch[1] : 'Not specified'

      console.log(`📝 Project: ${idea}`)
      console.log(`\n🔧 Stack:\n${stack}`)
      console.log(`\n📋 Implementation Steps:\n${steps}`)

      console.log('\n' + '='.repeat(60))
      console.log('🤖 READY TO GENERATE CODE')
      console.log('='.repeat(60))

      console.log(
        '\nThe architect plan is ready. Claude will now:\n' +
          '  1. Read the architectural plan\n' +
          '  2. Use Context7 for official documentation\n' +
          '  3. Generate project structure\n' +
          '  4. Create starter files with boilerplate\n'
      )

      console.log('\n💡 This command shows the plan.')
      console.log('   For code generation, Claude Code will read this plan')
      console.log('   and generate the structure automatically.\n')

      await this.logToMemory(projectPath, 'architect_executed', {
        timestamp: dateHelper.getTimestamp(),
        idea,
      })

      return {
        success: true,
        plan: planContent,
        idea,
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }
}

// Export both class and singleton instance
// Class for CLI (new PrjctCommands())
// Instance for direct use (require('./commands').sync())
const instance = new PrjctCommands()

module.exports = instance
module.exports.PrjctCommands = PrjctCommands
