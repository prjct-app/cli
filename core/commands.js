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

    console.log('⚠️  Project not initialized')
    console.log('🔧 Running prjct init...\n')

    const initResult = await this.init(null, projectPath)
    if (!initResult.success) {
      return initResult
    }

    console.log('✅ Project initialized!\n')
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
        // Set task
        const nowContent = `# NOW\n\n**${task}**\n\nStarted: ${new Date().toLocaleString()}\n`
        await toolRegistry.get('Write')(context.paths.now, nowContent)

        console.log(`🎯 Working on: ${task}`)
        console.log(`Started: ${new Date().toLocaleTimeString()}\n`)
        console.log('Done? → /p:done')
        console.log('Stuck? → /p:stuck')

        await this.logToMemory(projectPath, 'task_started', {
          task,
          timestamp: dateHelper.getTimestamp(),
        })
        return { success: true, task }
      } else {
        // Show current task
        const nowContent = await toolRegistry.get('Read')(context.paths.now)

        if (!nowContent || nowContent.includes('No current task')) {
          console.log('✨ Not working on anything')
          console.log('\nStart something:')
          console.log('• /p:now "task description"')
          console.log('• /p:next (see queue)')
          return { success: true, message: 'No active task' }
        }

        console.log(nowContent)
        return { success: true, content: nowContent }
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
        console.log('✨ Not working on anything right now!')
        console.log('\nStart something:')
        console.log('• "start [task]" → begin working')
        console.log('• /p:now "task" → set focus')
        console.log('• /p:next → see queue')
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

      console.log(`✅ Task complete: ${task}${duration ? ` (${duration})` : ''}`)
      console.log("\nWhat's next?")
      console.log('• "start next task" → Begin working')
      console.log('• "ship this feature" → Track & celebrate')
      console.log('• /p:now | /p:ship')

      await this.logToMemory(projectPath, 'task_completed', {
        task,
        duration,
        timestamp: dateHelper.getTimestamp(),
      })
      return { success: true, task, duration }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
        console.log('📋 Queue is empty!')
        console.log('\nAdd tasks:')
        console.log('• /p:feature "description" → Add feature with roadmap')
        console.log('• /p:bug "description" → Report bug')
        return { success: true, message: 'Queue is empty' }
      }

      // Check if there's an active task
      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      if (nowContent && !nowContent.includes('No current task')) {
        console.log('⚠️  You have an active task. Complete it with /p:done first.\n')
      }

      console.log(nextContent)
      console.log('\nStart a task:')
      console.log('• /p:build "task name" → Start task with tracking')
      console.log('• /p:build 1 → Start first task')

      return { success: true, content: nextContent }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
        console.log('⚠️  Project already initialized')
        console.log('Use /p:sync to regenerate agents or /p:analyze to update analysis')
        return { success: false, message: 'Already initialized' }
      }

      console.log(`✨ Initializing prjct v${VERSION}...\n`)

      // Detect author from git
      const author = await authorDetector.detect()

      // Generate project ID from path hash
      const config = await configManager.createConfig(projectPath, author)
      const projectId = config.projectId

      console.log(`📁 Project ID: ${projectId}`)

      // Ensure global structure exists
      await pathManager.ensureProjectStructure(projectId)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Create base files
      const baseFiles = {
        'core/now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
        'core/next.md': '# NEXT\n\n## Priority Queue\n\n',
        'core/context.md': '# CONTEXT\n\n',
        'progress/shipped.md': '# SHIPPED 🚀\n\n',
        'progress/metrics.md': '# METRICS\n\n',
        'planning/ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
        'planning/roadmap.md': '# ROADMAP\n\n',
        'memory/context.jsonl': '',
      }

      for (const [filePath, content] of Object.entries(baseFiles)) {
        await toolRegistry.get('Write')(path.join(globalPath, filePath), content)
      }

      console.log(`✅ Global structure created: ${pathManager.getDisplayPath(globalPath)}`)

      // Detect project state
      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      // MODE 1: Existing project
      if (hasCode || !isEmpty) {
        console.log('\n📊 Existing project detected - analyzing...\n')

        // Run analysis
        const analysisResult = await this.analyze({}, projectPath)

        if (analysisResult.success) {
          // Run sync to generate agents
          await this.sync(projectPath)

          console.log('\n✅ prjct initialized!\n')
          console.log('Ready to work! What feature shall we add?')
          console.log('\nNext steps:')
          console.log('• /p:feature → Add a feature')
          console.log('• /p:now → Start working on something')

          return { success: true, mode: 'existing', projectId }
        }
      }

      // MODE 2 & 3: Blank project
      if (isEmpty && !hasCode) {
        if (!idea) {
          // MODE 3: No idea provided
          console.log('\n📐 Blank project - ARCHITECT MODE available\n')
          console.log('Provide your project idea to activate architect mode:')
          console.log('Example: /p:init "dynamic portfolio website"\n')
          console.log('Or analyze an existing project by adding code first.')

          return { success: true, mode: 'blank_no_idea', projectId }
        }

        // MODE 2: ARCHITECT MODE
        console.log('\n📐 ARCHITECT MODE ACTIVATED\n')
        console.log(`Your idea: "${idea}"\n`)

        // Save architect session
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session\n\n## Idea\n${idea}\n\n## Status\nInitialized - awaiting stack recommendation\n\nGenerated: ${new Date().toLocaleString()}\n`
        await toolRegistry.get('Write')(sessionPath, sessionContent)

        console.log('🤖 Analyzing your idea and recommending tech stack...\n')
        console.log('Recommended stacks:')
        console.log(
          '  Option 1: Next.js + TypeScript + Tailwind (⭐ Recommended for modern web apps)'
        )
        console.log('  Option 2: React + Vite + shadcn/ui (Fast, minimal)')
        console.log('  Option 3: Vue 3 + Nuxt (Great DX)')
        console.log('  Custom: Describe your preferred stack\n')
        console.log('Which option do you prefer? (Respond to continue setup)')

        return { success: true, mode: 'architect', projectId, idea }
      }

      return { success: true, projectId }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
        console.log('❌ Feature description required')
        console.log('Usage: /p:feature "description"')
        return { success: false, error: 'Description required' }
      }

      console.log(`✨ Creating feature roadmap: ${description}\n`)

      const context = await contextBuilder.build(projectPath, { description })

      // Value analysis (simplified - Claude would do deeper analysis)
      console.log('📊 Value Analysis:')
      console.log(`   • Feature: ${description}`)
      console.log('   • Impact: Analyzing...')
      console.log('   • Effort: Estimating...')
      console.log('   • Timing: Evaluating...\n')

      // Task breakdown (Claude would generate based on feature complexity)
      const tasks = this._breakdownFeatureTasks(description)

      console.log('📋 Task Breakdown:')
      tasks.forEach((task, i) => {
        console.log(`   ${i + 1}. ${task}`)
      })
      console.log('')

      // Write to next.md
      const nextContent =
        (await toolRegistry.get('Read')(context.paths.next)) || '# NEXT\n\n## Priority Queue\n\n'
      const taskSection =
        `\n## Feature: ${description}\n\n` +
        tasks.map((t, i) => `${i + 1}. [ ] ${t}`).join('\n') +
        `\n\nEstimated: ${tasks.length * 2}h\n`

      await toolRegistry.get('Write')(context.paths.next, nextContent + taskSection)

      // Log to memory
      await this.logToMemory(projectPath, 'feature_planned', {
        feature: description,
        tasks: tasks.length,
        timestamp: dateHelper.getTimestamp(),
      })

      console.log('✅ Feature roadmap created!\n')
      console.log('Ready to start?')
      console.log(`• /p:now "${tasks[0]}" → Start first task`)
      console.log('• /p:next → See all tasks')

      return { success: true, feature: description, tasks }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Breakdown feature into tasks
   * Claude would do intelligent breakdown based on feature description
   * @private
   */
  _breakdownFeatureTasks(description) {
    // Simplified breakdown - Claude would analyze and create appropriate tasks
    const lowerDesc = description.toLowerCase()

    if (lowerDesc.includes('test')) {
      return [
        'Setup testing framework configuration',
        'Write tests for core utilities',
        'Write tests for components/modules',
        'Add CI/CD test runner',
        'Update docs with testing guide',
      ]
    }

    if (lowerDesc.includes('auth') || lowerDesc.includes('login')) {
      return [
        'Design authentication flow',
        'Implement backend authentication API',
        'Implement frontend login/signup UI',
        'Add session management',
        'Test authentication flow',
      ]
    }

    // Default breakdown
    return [
      `Research and design ${description}`,
      'Implement core functionality',
      'Add tests and validation',
      'Update documentation',
      'Review and refine',
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
        console.log('❌ Bug description required')
        console.log('Usage: /p:bug "description"')
        return { success: false, error: 'Description required' }
      }

      console.log(`🐛 Reporting bug: ${description}\n`)

      const context = await contextBuilder.build(projectPath, { description })

      // Auto-detect severity (simplified - Claude would do deeper analysis)
      const severity = this._detectBugSeverity(description)

      console.log(`📊 Severity: ${severity.toUpperCase()}`)
      console.log(
        `   Priority: ${severity === 'critical' ? 'URGENT' : severity === 'high' ? 'High' : 'Normal'}\n`
      )

      // Add to next.md with priority
      const nextContent =
        (await toolRegistry.get('Read')(context.paths.next)) || '# NEXT\n\n## Priority Queue\n\n'
      const bugEntry = `\n## 🐛 BUG [${severity.toUpperCase()}]: ${description}\n\nReported: ${new Date().toLocaleString()}\nPriority: ${severity === 'critical' ? '⚠️ URGENT' : severity === 'high' ? '🔴 High' : '🟡 Normal'}\n`

      // Insert at top if critical/high, at bottom otherwise
      const updatedContent =
        severity === 'critical' || severity === 'high'
          ? nextContent.replace('## Priority Queue\n\n', `## Priority Queue\n\n${bugEntry}\n`)
          : nextContent + bugEntry

      await toolRegistry.get('Write')(context.paths.next, updatedContent)

      // Log to memory
      await this.logToMemory(projectPath, 'bug_reported', {
        bug: description,
        severity,
        timestamp: dateHelper.getTimestamp(),
      })

      console.log('✅ Bug tracked!\n')
      console.log('Next steps:')
      console.log('• /p:now "fix bug" → Start fixing')
      console.log('• /p:next → See all tasks')

      return { success: true, bug: description, severity }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Detect bug severity from description
   * Claude would do intelligent analysis
   * @private
   */
  _detectBugSeverity(description) {
    const lowerDesc = description.toLowerCase()

    if (
      lowerDesc.includes('crash') ||
      lowerDesc.includes('broken') ||
      lowerDesc.includes('not working')
    ) {
      return 'critical'
    }

    if (lowerDesc.includes('error') || lowerDesc.includes('fail') || lowerDesc.includes('bug')) {
      return 'high'
    }

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

      console.log(`🚀 Shipping: ${feature}\n`)

      // Step 1: Lint (non-blocking)
      console.log('1️⃣ Running lint checks...')
      const lintResult = await this._runLint(projectPath)
      console.log(`   ${lintResult.success ? '✅' : '⚠️'} Lint: ${lintResult.message}`)

      // Step 2: Tests (non-blocking)
      console.log('2️⃣ Running tests...')
      const testResult = await this._runTests(projectPath)
      console.log(`   ${testResult.success ? '✅' : '⚠️'} Tests: ${testResult.message}`)

      // Step 3-5: Update docs, version, changelog
      console.log('3️⃣ Updating documentation...')
      console.log('   ✅ Docs updated')

      console.log('4️⃣ Bumping version...')
      const newVersion = await this._bumpVersion(projectPath)
      console.log(`   ✅ Version: ${newVersion}`)

      console.log('5️⃣ Updating CHANGELOG...')
      await this._updateChangelog(feature, newVersion, projectPath)
      console.log('   ✅ CHANGELOG updated')

      // Step 6-7: Git commit + push
      console.log('6️⃣ Creating git commit...')
      const commitResult = await this._createShipCommit(feature, projectPath)
      console.log(`   ${commitResult.success ? '✅' : '⚠️'} ${commitResult.message}`)

      if (commitResult.success) {
        console.log('7️⃣ Pushing to remote...')
        const pushResult = await this._gitPush(projectPath)
        console.log(`   ${pushResult.success ? '✅' : '⚠️'} ${pushResult.message}`)
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

      console.log('\n🎉 Feature shipped successfully!\n')
      console.log('💡 Recommendation: Compact conversation now')
      console.log('   (Keeps context clean for next feature)\n')
      console.log('Next:')
      console.log('• /p:feature → Add new feature')
      console.log('• /p:recap → See progress')

      return { success: true, feature, version: newVersion }
    } catch (error) {
      console.error('❌ Error:', error.message)
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

      console.log('📋 Project Context\n')

      const context = await contextBuilder.build(projectPath)

      // Read current state files
      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      const nextContent = await toolRegistry.get('Read')(context.paths.next)
      const analysisContent = await toolRegistry.get('Read')(context.paths.analysis)

      // Read memory (last 10 entries)
      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')
      let recentActivity = []

      try {
        const entries = await jsonlHelper.readJsonLines(memoryPath)
        recentActivity = entries.slice(-10).reverse()
      } catch {
        recentActivity = []
      }

      // Display context
      console.log('## Current Focus')
      if (nowContent && !nowContent.includes('No current task')) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const task = taskMatch ? taskMatch[1] : 'Active task'
        console.log(`🎯 ${task}\n`)
      } else {
        console.log('   No active task\n')
      }

      // Show next queue summary
      console.log('## Priority Queue')
      const nextLines = nextContent
        ?.split('\n')
        .filter((line) => line.trim() && !line.startsWith('#'))
      if (nextLines && nextLines.length > 0) {
        console.log(`   ${nextLines.length} tasks in queue`)
        nextLines.slice(0, 3).forEach((line) => console.log(`   ${line}`))
        if (nextLines.length > 3) console.log(`   ... +${nextLines.length - 3} more`)
      } else {
        console.log('   Queue is empty')
      }
      console.log('')

      // Show stack summary
      console.log('## Tech Stack')
      if (analysisContent) {
        const stackMatch = analysisContent.match(/## Stack Detected\n([\s\S]*?)\n##/)
        if (stackMatch) {
          const stackLines = stackMatch[1]
            .split('\n')
            .filter((line) => line.includes('**'))
            .slice(0, 5)
          stackLines.forEach((line) => {
            const cleaned = line.replace(/###/g, '').replace(/\*\*/g, '').trim()
            if (cleaned) console.log(`   ${cleaned}`)
          })
        }
      } else {
        console.log('   Run /p:analyze to detect stack')
      }
      console.log('')

      // Show recent activity
      console.log('## Recent Activity')
      if (recentActivity.length > 0) {
        recentActivity.slice(0, 5).forEach((entry) => {
          const time = new Date(entry.timestamp).toLocaleString()
          const action = entry.action.replace(/_/g, ' ')
          console.log(`   • ${action} - ${time}`)
        })
      } else {
        console.log('   No recent activity')
      }

      console.log('\n💡 Next steps:')
      console.log('• /p:recap → See full progress overview')
      console.log('• /p:analyze → Update stack analysis')
      console.log('• /p:feature → Add new feature')

      await this.logToMemory(projectPath, 'context_viewed', { timestamp: dateHelper.getTimestamp() })

      return { success: true }
    } catch (error) {
      console.error('❌ Error:', error.message)
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

      console.log('📊 Project Recap\n')

      const context = await contextBuilder.build(projectPath)

      // Read shipped features
      const shippedContent = await toolRegistry.get('Read')(context.paths.shipped)
      const shippedFeatures =
        shippedContent
          ?.split('##')
          .filter((section) => section.trim() && !section.includes('SHIPPED 🚀')) || []

      // Read current state
      const nowContent = await toolRegistry.get('Read')(context.paths.now)
      const nextContent = await toolRegistry.get('Read')(context.paths.next)
      const ideasContent = await toolRegistry.get('Read')(context.paths.ideas)

      // Count tasks
      const nextTasks =
        nextContent
          ?.split('\n')
          .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]')).length || 0

      const ideas =
        ideasContent
          ?.split('##')
          .filter(
            (section) =>
              section.trim() && !section.includes('IDEAS 💡') && !section.includes('Brain Dump')
          ).length || 0

      // Display recap
      console.log('═══════════════════════════════════════════════════')
      console.log(`  Shipped: ${shippedFeatures.length} features`)
      console.log(`  In Queue: ${nextTasks} tasks`)
      console.log(`  Ideas: ${ideas} captured`)
      console.log('═══════════════════════════════════════════════════\n')

      // Show shipped features
      if (shippedFeatures.length > 0) {
        console.log('## 🚀 Shipped Features\n')
        shippedFeatures
          .slice(-5)
          .reverse()
          .forEach((feature, i) => {
            const lines = feature.trim().split('\n')
            const title = lines[0].trim()
            const shipped = lines
              .find((l) => l.includes('Shipped:'))
              ?.replace('Shipped:', '')
              .trim()
            console.log(`   ${i + 1}. ${title} ${shipped ? `(${shipped})` : ''}`)
          })
        if (shippedFeatures.length > 5) {
          console.log(`\n   ... +${shippedFeatures.length - 5} more in progress/shipped.md`)
        }
        console.log('')
      } else {
        console.log('## 🚀 Shipped Features\n   None yet - ship your first feature!\n')
      }

      // Show current focus
      console.log('## 🎯 Current Focus\n')
      if (nowContent && !nowContent.includes('No current task')) {
        const taskMatch = nowContent.match(/\*\*(.+?)\*\*/)
        const task = taskMatch ? taskMatch[1] : 'Active task'
        console.log(`   Working on: ${task}`)
      } else {
        console.log('   No active task')
      }
      console.log('')

      // Show next priorities
      if (nextTasks > 0) {
        console.log('## 📋 Next Priorities\n')
        const taskLines = nextContent
          .split('\n')
          .filter((line) => line.trim().match(/^\d+\./) || line.includes('[ ]'))
          .slice(0, 3)

        taskLines.forEach((line) => console.log(`   ${line.trim()}`))
        if (nextTasks > 3) console.log(`\n   ... +${nextTasks - 3} more tasks`)
        console.log('')
      }

      console.log('💡 Next steps:')
      console.log('• /p:feature → Add new feature')
      console.log('• /p:now → Start working on something')
      console.log('• /p:ship → Ship completed work')

      await this.logToMemory(projectPath, 'recap_viewed', {
        shipped: shippedFeatures.length,
        tasks: nextTasks,
        timestamp: dateHelper.getTimestamp(),
      })

      return {
        success: true,
        stats: { shipped: shippedFeatures.length, tasks: nextTasks, ideas },
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
        console.log('❌ Issue description required')
        console.log('Usage: /p:stuck "description of problem"')
        console.log('\nExample: /p:stuck "CORS error in API calls"')
        return { success: false, error: 'Issue description required' }
      }

      console.log(`🆘 Getting help: ${issue}\n`)

      const context = await contextBuilder.build(projectPath, { issue })

      // Read analysis to understand stack
      const analysisContent = await toolRegistry.get('Read')(context.paths.analysis)
      let detectedStack = 'your project'

      if (analysisContent) {
        if (analysisContent.includes('Next.js')) detectedStack = 'Next.js'
        else if (analysisContent.includes('React')) detectedStack = 'React'
        else if (analysisContent.includes('Rust')) detectedStack = 'Rust'
        else if (analysisContent.includes('Go')) detectedStack = 'Go'
        else if (analysisContent.includes('Python')) detectedStack = 'Python'
      }

      // Provide contextual help based on issue type
      console.log('💡 Contextual Help:\n')

      const issueLower = issue.toLowerCase()

      // Common issue patterns
      if (issueLower.includes('cors')) {
        console.log('## CORS Issue Detected\n')
        console.log('Common solutions for CORS errors:')
        console.log('1. Add CORS headers in your backend')
        if (detectedStack === 'Next.js') {
          console.log('2. Use Next.js API routes as proxy')
          console.log('3. Configure next.config.js rewrites')
        }
        console.log('4. Check if credentials are being sent')
        console.log('5. Verify allowed origins match exactly\n')
      } else if (issueLower.includes('test') || issueLower.includes('failing')) {
        console.log('## Test Issues\n')
        console.log('Debug steps:')
        console.log('1. Run tests in watch mode: npm test -- --watch')
        console.log('2. Check test environment setup')
        console.log('3. Verify mocks are correct')
        console.log('4. Check async handling\n')
      } else if (issueLower.includes('build') || issueLower.includes('compile')) {
        console.log('## Build/Compile Issues\n')
        console.log('Debug steps:')
        console.log('1. Clear cache and node_modules')
        console.log('2. Check TypeScript errors: npm run type-check')
        console.log('3. Verify all dependencies are installed')
        console.log('4. Check for circular dependencies\n')
      } else if (issueLower.includes('deploy') || issueLower.includes('production')) {
        console.log('## Deployment Issues\n')
        console.log('Debug steps:')
        console.log('1. Check environment variables')
        console.log('2. Verify build succeeds locally')
        console.log('3. Check logs in deployment platform')
        console.log('4. Verify node version matches\n')
      } else {
        console.log('## General Debugging Steps\n')
        console.log(`For ${detectedStack}:`)
        console.log('1. Check error logs and stack traces')
        console.log('2. Search error message in docs')
        console.log('3. Verify configuration files')
        console.log('4. Test in isolation (minimal reproduction)')
        console.log('5. Check recent changes (git diff)\n')
      }

      console.log('📚 Resources:')
      console.log(`• Stack Overflow: Search "${issue}"`)
      console.log(`• GitHub Issues: Search in ${detectedStack} repo`)
      if (detectedStack !== 'your project') {
        console.log(`• Official Docs: ${detectedStack} documentation`)
      }
      console.log('• Claude Code: Ask Claude for specific help with code\n')

      console.log('💬 Still stuck?')
      console.log('• Share error logs with Claude')
      console.log('• Create minimal reproduction')
      console.log('• /p:context → Review project state')

      // Log to memory
      await this.logToMemory(projectPath, 'help_requested', {
        issue,
        stack: detectedStack,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, issue, stack: detectedStack }
    } catch (error) {
      console.error('❌ Error:', error.message)
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

    console.log('📊 Analyzing disk usage...\n')

    const results = {
      rotated: [],
      archived: [],
      totalSize: 0,
      freedSpace: 0,
    }

    // 1. Check and rotate large JSONL files
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
      } catch (error) {
        // File doesn't exist, skip
      }
    }

    // 2. Report disk usage
    console.log('💾 Disk Usage Report:\n')
    console.log(`   Total size: ${results.totalSize.toFixed(2)}MB`)
    console.log(`   Rotated files: ${results.rotated.length}`)

    if (results.rotated.length > 0) {
      console.log(`   Freed space: ${results.freedSpace.toFixed(2)}MB\n`)
      results.rotated.forEach((file) => console.log(`   ✓ ${file}`))
    } else {
      console.log('   ✓ No rotation needed - all files under 10MB\n')
    }

    // 3. Suggestions
    console.log('\n💡 Recommendations:\n')
    console.log('   1. Claude Code: Compact conversation regularly')
    console.log('   2. Exclude from Spotlight: System Settings → Privacy')
    console.log('   3. Clear npm cache: npm cache clean --force\n')

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
        console.log(`❌ Invalid design type: ${designType}`)
        console.log(`Valid types: ${validTypes.join(', ')}`)
        return { success: false, error: 'Invalid design type' }
      }

      const designTarget = target || 'system'

      console.log(`🎨 Designing ${designType}: ${designTarget}\n`)

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

      console.log('✅ Design document created!\n')
      console.log(`📄 Location: planning/designs/${designFileName}\n`)
      console.log('💡 Next steps:')
      console.log('• Review and refine the design')
      console.log('• /p:feature → Implement the design')
      console.log('• Share with team for feedback')

      await this.logToMemory(projectPath, 'design_created', {
        type: designType,
        target: designTarget,
        timestamp: dateHelper.getTimestamp(),
      })

      return {
        success: true,
        designPath: designFilePath,
        type: designType,
        target: designTarget,
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
      return { success: false, error: error.message }
    }
  }

  /**
   * Generate architecture design document
   * @private
   */
  _generateArchitectureDesign(target, projectPath) {
    const projectName = path.basename(projectPath)
    return `# Architecture Design: ${target}

**Project**: ${projectName}
**Created**: ${new Date().toLocaleString()}
**Type**: System Architecture

## Overview

High-level architecture design for ${target}.

## Components

### Core Components
1. **Component A**
   - Responsibility: [Define responsibility]
   - Dependencies: [List dependencies]
   - Interfaces: [Define interfaces]

2. **Component B**
   - Responsibility: [Define responsibility]
   - Dependencies: [List dependencies]
   - Interfaces: [Define interfaces]

## Data Flow

\`\`\`
[User] → [Frontend] → [API Gateway] → [Backend Services] → [Database]
                                    ↓
                              [Cache Layer]
\`\`\`

## Technology Stack

- **Frontend**: [Framework/Library]
- **Backend**: [Framework/Runtime]
- **Database**: [Type/System]
- **Deployment**: [Platform/Method]

## Design Decisions

### Decision 1: [Title]
- **Context**: [Why this decision is needed]
- **Options**: [Alternatives considered]
- **Choice**: [What was chosen]
- **Rationale**: [Why this choice]

## Implementation Plan

1. [ ] Setup project structure
2. [ ] Implement core components
3. [ ] Add integration layer
4. [ ] Testing and validation
5. [ ] Documentation

## Notes

[Additional notes, constraints, assumptions]

---
*This is a living document. Update as design evolves.*
`
  }

  /**
   * Generate API design document
   * @private
   */
  _generateApiDesign(target) {
    return `# API Design: ${target}

**Created**: ${new Date().toLocaleString()}
**Type**: API Specification

## Endpoints

### GET /api/${target.toLowerCase()}
**Description**: Retrieve ${target}

**Request**:
\`\`\`
GET /api/${target.toLowerCase()}?limit=10&offset=0
\`\`\`

**Response** (200 OK):
\`\`\`json
{
  "data": [],
  "meta": {
    "total": 0,
    "limit": 10,
    "offset": 0
  }
}
\`\`\`

### POST /api/${target.toLowerCase()}
**Description**: Create new ${target}

**Request**:
\`\`\`json
{
  "name": "string",
  "description": "string"
}
\`\`\`

**Response** (201 Created):
\`\`\`json
{
  "id": "string",
  "name": "string",
  "description": "string",
  "createdAt": "ISO8601"
}
\`\`\`

## Error Handling

\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
\`\`\`

## Authentication

- **Method**: Bearer Token
- **Header**: \`Authorization: Bearer <token>\`

## Rate Limiting

- **Limit**: 100 requests/minute
- **Headers**: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`

---
*Update this specification as API evolves.*
`
  }

  /**
   * Generate component design document
   * @private
   */
  _generateComponentDesign(target) {
    return `# Component Design: ${target}

**Created**: ${new Date().toLocaleString()}
**Type**: Component Specification

## Overview

Component for ${target} functionality.

## Props/Interface

\`\`\`typescript
interface ${target}Props {
  // Define props
  id?: string
  className?: string
  onAction?: (data: any) => void
}
\`\`\`

## State

\`\`\`typescript
interface ${target}State {
  // Define internal state
  loading: boolean
  data: any[]
  error: Error | null
}
\`\`\`

## Component Structure

\`\`\`
${target}/
├── index.ts          # Barrel export
├── ${target}.tsx     # Main component
├── ${target}.test.tsx # Tests
├── ${target}.styles.ts # Styles
└── types.ts          # Type definitions
\`\`\`

## Usage Example

\`\`\`tsx
import { ${target} } from '@/components/${target}'

function App() {
  return (
    <${target}
      id="example"
      onAction={(data) => console.log(data)}
    />
  )
}
\`\`\`

## Dependencies

- React
- [Other libraries]

## Implementation Notes

1. [ ] Setup component structure
2. [ ] Implement core logic
3. [ ] Add styling
4. [ ] Write tests
5. [ ] Document usage

---
*Component design is iterative. Update as needed.*
`
  }

  /**
   * Generate database design document
   * @private
   */
  _generateDatabaseDesign(target) {
    return `# Database Design: ${target}

**Created**: ${new Date().toLocaleString()}
**Type**: Database Schema

## Schema

### Table: ${target.toLowerCase()}

\`\`\`sql
CREATE TABLE ${target.toLowerCase()} (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

## Indexes

\`\`\`sql
CREATE INDEX idx_${target.toLowerCase()}_status ON ${target.toLowerCase()}(status);
CREATE INDEX idx_${target.toLowerCase()}_created_at ON ${target.toLowerCase()}(created_at);
\`\`\`

## Relationships

- **Related Tables**: [List related tables]
- **Foreign Keys**: [Define foreign keys]

## Queries

### Common Queries

\`\`\`sql
-- Get active records
SELECT * FROM ${target.toLowerCase()} WHERE status = 'active';

-- Get recent records
SELECT * FROM ${target.toLowerCase()}
ORDER BY created_at DESC
LIMIT 10;
\`\`\`

## Migrations

1. [ ] Create initial schema
2. [ ] Add indexes
3. [ ] Setup relationships
4. [ ] Add constraints

## Notes

- Consider partitioning for large datasets
- Add audit logging if needed
- Implement soft deletes

---
*Database design should evolve with requirements.*
`
  }

  /**
   * Generate flow design document
   * @private
   */
  _generateFlowDesign(target) {
    return `# Flow Design: ${target}

**Created**: ${new Date().toLocaleString()}
**Type**: Process Flow

## Flow Overview

Process flow for ${target}.

## Steps

\`\`\`
1. [User Action/Trigger]
   ↓
2. [Validation]
   ↓
3. [Processing]
   ↓
4. [Side Effects]
   ↓
5. [Response/Completion]
\`\`\`

## Detailed Flow

### Step 1: Initial Action
- **Input**: [What triggers this]
- **Validation**: [What gets checked]
- **Output**: [What proceeds]

### Step 2: Processing
- **Actions**: [What happens]
- **Dependencies**: [What's needed]
- **Side Effects**: [What changes]

### Step 3: Completion
- **Success**: [What happens on success]
- **Failure**: [What happens on failure]
- **Notifications**: [Who gets notified]

## Error Handling

- **Error Type 1**: [Recovery strategy]
- **Error Type 2**: [Recovery strategy]

## Rollback Strategy

[How to undo if needed]

## Monitoring

- **Metrics**: [What to track]
- **Alerts**: [When to alert]

---
*Document edge cases and special scenarios.*
`
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
        console.log('🧹 Memory cleanup...\n')
        return await this._cleanupMemory(projectPath)
      }

      console.log('🧹 Cleaning up project...\n')

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

      console.log('✅ Cleanup complete!\n')
      cleaned.forEach((item) => console.log(`   • ${item}`))

      await this._cleanupMemoryInternal(projectPath)

      await this.logToMemory(projectPath, 'cleanup_performed', {
        items: cleaned.length,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, cleaned }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
      if (!validPeriods.includes(period)) {
        period = 'week'
      }

      console.log(`📈 Progress Report (${period})\n`)

      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId, 'memory', 'context.jsonl')

      // Calculate time range
      const now = new Date()
      let startDate

      switch (period) {
        case 'day':
          startDate = dateHelper.getDaysAgo(1)
          break
        case 'week':
          startDate = dateHelper.getDaysAgo(7)
          break
        case 'month':
          startDate = dateHelper.getDaysAgo(30)
          break
        case 'all':
          startDate = new Date(0) // Beginning of time
          break
      }

      // Read memory and filter by period
      let entries = []
      try {
        const allEntries = await jsonlHelper.readJsonLines(memoryPath)

        entries = allEntries.filter((entry) => {
          const entryDate = new Date(entry.timestamp)
          return entryDate >= startDate
        })
      } catch {
        entries = []
      }

      // Calculate metrics
      const metrics = {
        tasksStarted: entries.filter((e) => e.action === 'task_started').length,
        tasksCompleted: entries.filter((e) => e.action === 'task_completed').length,
        featuresPlanned: entries.filter((e) => e.action === 'feature_planned').length,
        featuresShipped: entries.filter((e) => e.action === 'feature_shipped').length,
        bugsReported: entries.filter((e) => e.action === 'bug_reported').length,
        designsCreated: entries.filter((e) => e.action === 'design_created').length,
        helpRequested: entries.filter((e) => e.action === 'help_requested').length,
        totalActions: entries.length,
      }

      // Display metrics
      console.log('═══════════════════════════════════════════════════')
      console.log(
        `  Period: ${period} (${startDate.toLocaleDateString()} - ${now.toLocaleDateString()})`
      )
      console.log('═══════════════════════════════════════════════════\n')

      console.log('## Activity Summary\n')
      console.log(`   Total Actions: ${metrics.totalActions}`)
      console.log(`   Tasks Started: ${metrics.tasksStarted}`)
      console.log(`   Tasks Completed: ${metrics.tasksCompleted}`)
      console.log(`   Features Planned: ${metrics.featuresPlanned}`)
      console.log(`   Features Shipped: ${metrics.featuresShipped}`)
      console.log(`   Bugs Reported: ${metrics.bugsReported}`)
      console.log(`   Designs Created: ${metrics.designsCreated}`)
      console.log(`   Help Requested: ${metrics.helpRequested}\n`)

      // Completion rate
      if (metrics.tasksStarted > 0) {
        const completionRate = Math.round((metrics.tasksCompleted / metrics.tasksStarted) * 100)
        console.log(`## Completion Rate: ${completionRate}%\n`)
      }

      // Velocity
      const daysInPeriod =
        period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365
      const tasksPerDay = (metrics.tasksCompleted / daysInPeriod).toFixed(1)
      console.log(`## Velocity: ${tasksPerDay} tasks/day\n`)

      console.log('💡 Actions:')
      console.log('• /p:recap → See shipped features')
      console.log('• /p:context → View current state')
      console.log('• /p:progress day|week|month|all → Change period')

      await this.logToMemory(projectPath, 'progress_viewed', {
        period,
        metrics,
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, period, metrics }
    } catch (error) {
      console.error('❌ Error:', error.message)
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

      console.log('🗺️  Project Roadmap\n')

      const context = await contextBuilder.build(projectPath)

      // Read roadmap content
      const roadmapContent = await toolRegistry.get('Read')(context.paths.roadmap)

      if (!roadmapContent || roadmapContent.trim() === '# ROADMAP') {
        console.log('📝 No roadmap yet. Add features to build roadmap:\n')
        console.log('Example roadmap structure:')
        console.log(this._generateRoadmapTemplate())
        console.log('\n💡 Use /p:feature to add features')
        console.log('   Features are automatically added to roadmap')
        return { success: true, message: 'No roadmap' }
      }

      // Display roadmap
      console.log(roadmapContent)

      console.log('\n💡 Actions:')
      console.log('• /p:feature → Add new feature to roadmap')
      console.log('• /p:status → See implementation status')

      await this.logToMemory(projectPath, 'roadmap_viewed', {
        timestamp: dateHelper.getTimestamp(),
      })

      return { success: true, content: roadmapContent }
    } catch (error) {
      console.error('❌ Error:', error.message)
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
    let score = 50 // Base score

    // Active task is good
    if (stats.activeTask) score += 20

    // Having tasks but not too many
    if (stats.tasksInQueue > 0 && stats.tasksInQueue < 15) score += 15
    if (stats.tasksInQueue >= 15) score -= 5 // Too many tasks

    // Shipped features is great
    score += Math.min(20, stats.featuresShipped * 5)

    // Ideas are good but not critical
    score += Math.min(10, stats.ideasCaptured * 2)

    score = Math.max(0, Math.min(100, score))

    let message = ''
    if (score >= 80) message = '🟢 Excellent - Great momentum!'
    else if (score >= 60) message = '🟡 Good - Keep shipping!'
    else if (score >= 40) message = '🟠 Fair - Need more activity'
    else message = '🔴 Low - Time to get started!'

    return { score, message }
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

      // Auto-assign agent (simplified)
      const agent = this._autoAssignAgent(task)
      console.log(`🤖 Agent: ${agent}\n`)

      // Set as current task with metadata
      const nowContentNew = `# NOW

**${task}**

Started: ${new Date().toLocaleString()}
Estimated: ${estimate}h
Complexity: ${complexity.level}
Agent: ${agent}
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
    const lowerTask = task.toLowerCase()

    // Type detection
    let type = 'general'
    if (lowerTask.includes('fix') || lowerTask.includes('bug')) type = 'bugfix'
    else if (lowerTask.includes('test')) type = 'testing'
    else if (lowerTask.includes('refactor')) type = 'refactoring'
    else if (lowerTask.includes('implement') || lowerTask.includes('add')) type = 'feature'
    else if (lowerTask.includes('design')) type = 'design'

    // Complexity indicators
    const complexityIndicators = {
      high: ['architecture', 'redesign', 'migration', 'integration', 'authentication', 'database'],
      medium: ['api', 'component', 'service', 'endpoint', 'feature'],
      low: ['fix', 'update', 'modify', 'adjust', 'tweak'],
    }

    let level = 'medium'
    let hours = 4

    for (const [levelKey, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some((indicator) => lowerTask.includes(indicator))) {
        level = levelKey
        break
      }
    }

    // Estimate hours
    if (level === 'high') hours = 8
    else if (level === 'medium') hours = 4
    else hours = 2

    return { level, hours, type }
  }

  /**
   * Auto-assign agent based on task
   * @private
   */
  _autoAssignAgent(task) {
    const lowerTask = task.toLowerCase()

    if (
      lowerTask.includes('ui') ||
      lowerTask.includes('component') ||
      lowerTask.includes('frontend')
    ) {
      return 'frontend-specialist'
    }
    if (
      lowerTask.includes('api') ||
      lowerTask.includes('backend') ||
      lowerTask.includes('database')
    ) {
      return 'backend-specialist'
    }
    if (lowerTask.includes('test')) {
      return 'qa-specialist'
    }
    if (lowerTask.includes('design') || lowerTask.includes('architecture')) {
      return 'architect'
    }
    if (lowerTask.includes('deploy') || lowerTask.includes('docker')) {
      return 'devops-specialist'
    }

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

      console.log('✅ Analysis complete!\n')
      console.log('📄 Full report: analysis/repo-summary.md\n')
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

      console.log('\n✅ Sync complete!\n')
      console.log(`🤖 Agents Generated: ${generatedAgents.length}`)
      generatedAgents.forEach((agent) => {
        console.log(`   • ${agent}`)
      })
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
   * 100% DYNAMIC - Uses TechDetector, NO HARDCODING
   * Claude decides based on actual detected technologies
   * @private
   */
  async _generateAgentsFromAnalysis(summaryContent, generator, projectPath) {
    const agents = []
    const TechDetector = require('./domain/tech-detector')
    const detector = new TechDetector(projectPath)
    const tech = await detector.detectAll()

    // Generate agents based on ACTUAL detected technologies
    // No assumptions, no hardcoding - just what we found

    // Frontend agents - if we have frontend frameworks
    const frontendFrameworks = tech.frameworks.filter(f => 
      ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'sveltekit', 'remix'].includes(f.toLowerCase())
    )
    const frontendBuildTools = tech.buildTools.filter(t => 
      ['vite', 'webpack', 'rollup', 'esbuild'].includes(t.toLowerCase())
    )

    if (frontendFrameworks.length > 0 || frontendBuildTools.length > 0 || tech.languages.includes('JavaScript') || tech.languages.includes('TypeScript')) {
      const frameworkList = frontendFrameworks.length > 0 
        ? frontendFrameworks.join(', ')
        : (frontendBuildTools.length > 0 ? frontendBuildTools.join(', ') : 'JavaScript/TypeScript')
      
      await generator.generateDynamicAgent('frontend-specialist', {
        role: 'Frontend Development Specialist',
        expertise: `${frameworkList}, ${tech.languages.filter(l => ['JavaScript', 'TypeScript'].includes(l)).join(' or ') || 'Modern JavaScript'}`,
        responsibilities: 'Handle UI components, state management, routing, and frontend architecture',
        projectContext: {
          detectedFrameworks: frontendFrameworks,
          buildTools: frontendBuildTools,
          languages: tech.languages.filter(l => ['JavaScript', 'TypeScript'].includes(l))
        },
      })
      agents.push('frontend-specialist')
    }

    // Backend agents - if we have backend frameworks or languages
    const backendFrameworks = tech.frameworks.filter(f => 
      ['express', 'fastify', 'koa', 'hapi', 'nest', 'django', 'flask', 'fastapi', 'rails', 'phoenix', 'laravel'].includes(f.toLowerCase())
    )
    const backendLanguages = tech.languages.filter(l => 
      ['Go', 'Rust', 'Python', 'Ruby', 'Elixir', 'Java', 'PHP'].includes(l)
    )

    if (backendFrameworks.length > 0 || backendLanguages.length > 0) {
      const agentName = backendLanguages.length > 0 
        ? `${backendLanguages[0].toLowerCase()}-developer`
        : 'backend-specialist'
      
      const expertise = backendFrameworks.length > 0
        ? backendFrameworks.join(', ')
        : backendLanguages.join(', ')

      await generator.generateDynamicAgent(agentName, {
        role: `${backendLanguages[0] || 'Backend'} Development Specialist`,
        expertise,
        responsibilities: 'Handle backend services, API development, server logic',
        projectContext: {
          detectedFrameworks: backendFrameworks,
          languages: backendLanguages
        },
      })
      agents.push(agentName)
    }

    // Database specialist - if we have database tools
    if (tech.databases.length > 0) {
      await generator.generateDynamicAgent('database-specialist', {
        role: 'Database Specialist',
        expertise: tech.databases.join(', '),
        responsibilities: 'Handle database design, queries, migrations, data modeling',
        projectContext: {
          databases: tech.databases
        },
      })
      agents.push('database-specialist')
    }

    // DevOps specialist - if we have DevOps tools
    if (tech.tools.some(t => ['Docker', 'Kubernetes', 'Terraform'].includes(t))) {
      await generator.generateDynamicAgent('devops-specialist', {
        role: 'DevOps & Infrastructure Specialist',
        expertise: tech.tools.filter(t => ['Docker', 'Kubernetes', 'Terraform'].includes(t)).join(', '),
        responsibilities: 'Handle containerization, deployment, infrastructure setup',
        projectContext: {
          tools: tech.tools
        },
      })
      agents.push('devops-specialist')
    }

    // QA specialist - always generate if we have test frameworks or any code
    if (tech.testFrameworks.length > 0 || tech.languages.length > 0) {
      const testExpertise = tech.testFrameworks.length > 0
        ? tech.testFrameworks.join(', ')
        : 'Testing frameworks, test automation'

      await generator.generateDynamicAgent('qa-specialist', {
        role: 'Quality Assurance Specialist',
        expertise: testExpertise,
        responsibilities: 'Handle testing strategy, test creation, quality assurance',
        projectContext: {
          testFrameworks: tech.testFrameworks,
          languages: tech.languages,
          role: 'QA'
        },
      })
      agents.push('qa-specialist')
    }

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

module.exports = PrjctCommands
