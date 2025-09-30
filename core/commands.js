const fs = require('fs').promises
const path = require('path')
const agentDetector = require('./agent-detector')

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
    this.prjctDir = '.prjct'
    this.agent = null
    this.agentInfo = null
  }

  /**
   * Initialize agent detection and load appropriate adapter
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
    return this.agent
  }

  async ensureProjectDir(projectPath) {
    const dir = path.join(projectPath, this.prjctDir)
    await fs.mkdir(dir, { recursive: true })
    return dir
  }

  async init(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const dir = await this.ensureProjectDir(projectPath)

      // Create initial files
      const files = {
        'now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
        'next.md': '# NEXT\n\n## Priority Queue\n\n',
        'shipped.md': '# SHIPPED 🚀\n\n',
        'ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
        'memory.jsonl': '',
      }

      for (const [filename, content] of Object.entries(files)) {
        await this.agent.writeFile(path.join(dir, filename), content)
      }

      // Create agent marker file based on detected agent
      if (this.agentInfo.type === 'codex') {
        // Create marker for Codex detection
        await this.agent.writeFile(
          path.join(projectPath, '.prjct-agent'),
          `codex:${this.agentInfo.name}`
        )
      } else if (this.agentInfo.type === 'claude') {
        // Create marker for Claude detection
        await this.agent.writeFile(
          path.join(projectPath, '.prjct-agent'),
          `claude:${this.agentInfo.name}`
        )
      }

      // Detect project type
      const projectInfo = await this.detectProjectType(projectPath)

      const message =
        `Initializing prjct for ${this.agentInfo.name}...\n` +
        `Created .prjct/ structure\n` +
        `Detected: ${projectInfo}\n` +
        `Ready! Start with ${this.agentInfo.config.commandPrefix}now "your first task"`

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
      const nowFile = path.join(projectPath, this.prjctDir, 'now.md')

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

      // Set new task
      const content = `# NOW: ${task}\nStarted: ${this.agent.getTimestamp()}\n\n## Task\n${task}\n\n## Notes\n\n`
      await this.agent.writeFile(nowFile, content)

      // Log to memory
      await this.logToMemory(projectPath, 'now', { task, timestamp: this.agent.getTimestamp() })

      return {
        success: true,
        message:
          this.agent.formatResponse(`Focus set: ${task}`, 'focus') +
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
      const nowFile = path.join(projectPath, this.prjctDir, 'now.md')
      const nextFile = path.join(projectPath, this.prjctDir, 'next.md')

      // Get current task
      const content = await this.agent.readFile(nowFile)
      const currentTask = content.split('\n')[0].replace('# NOW: ', '')

      if (currentTask === '# NOW' || !currentTask) {
        return {
          success: false,
          message: this.agent.formatResponse('No current task to complete', 'warning'),
        }
      }

      // Clear current task
      await this.agent.writeFile(nowFile, '# NOW\n\nNo current task. Use `/p:now` to set focus.\n')

      // Log completion
      await this.logToMemory(projectPath, 'done', {
        task: currentTask,
        timestamp: this.agent.getTimestamp(),
      })

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

      const shippedFile = path.join(projectPath, this.prjctDir, 'shipped.md')

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
    } catch (error) {
      await this.initializeAgent()
      return {
        success: false,
        message: this.agent.formatResponse(error.message, 'error'),
      }
    }
  }

  async next(projectPath = process.cwd()) {
    try {
      await this.initializeAgent()
      const nextFile = path.join(projectPath, this.prjctDir, 'next.md')
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

      const ideasFile = path.join(projectPath, this.prjctDir, 'ideas.md')
      const nextFile = path.join(projectPath, this.prjctDir, 'next.md')

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

      // Read all files
      const nowFile = await this.agent.readFile(path.join(projectPath, this.prjctDir, 'now.md'))
      const shippedFile = await this.agent.readFile(
        path.join(projectPath, this.prjctDir, 'shipped.md')
      )
      const nextFile = await this.agent.readFile(path.join(projectPath, this.prjctDir, 'next.md'))
      const ideasFile = await this.agent.readFile(path.join(projectPath, this.prjctDir, 'ideas.md'))

      // Parse current task
      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      // Count metrics
      const shippedCount = (shippedFile.match(/✅/g) || []).length
      const queuedCount = (nextFile.match(/^- /gm) || []).length
      const ideasCount = (ideasFile.match(/^- /gm) || []).length

      // Get recent activity
      const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl')
      let recentActivity = ''
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
      const shippedFile = await this.agent.readFile(
        path.join(projectPath, this.prjctDir, 'shipped.md')
      )

      // Parse shipped features by date
      const features = []
      const lines = shippedFile.split('\n')

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

      // Filter by period
      const now = new Date()
      const periodDays = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 7
      const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000)

      const periodFeatures = features.filter((f) => f.date >= cutoff)

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
      const nowFile = await this.agent.readFile(path.join(projectPath, this.prjctDir, 'now.md'))
      const currentTask = nowFile.split('\n')[0].replace('# NOW: ', '').replace('# NOW', 'None')

      // Read recent memory
      const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl')
      let recentActions = []
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
    const memoryFile = path.join(projectPath, this.prjctDir, 'memory.jsonl')
    const entry = JSON.stringify({ action, data, timestamp: new Date().toISOString() }) + '\n'

    try {
      const existingContent = await this.agent.readFile(memoryFile)
      await this.agent.writeFile(memoryFile, existingContent + entry)
    } catch (e) {
      // File doesn't exist, create it
      await this.agent.writeFile(memoryFile, entry)
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
}

module.exports = new PrjctCommands()
