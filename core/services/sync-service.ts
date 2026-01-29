/**
 * SyncService - Comprehensive Project Sync
 *
 * Handles ALL sync operations in a single TypeScript execution:
 * - Git analysis
 * - Project stats
 * - Context file generation
 * - Agent generation
 * - Skill configuration
 * - State updates
 *
 * This eliminates the need for Claude to make 50+ individual tool calls.
 * Instead, one command does everything.
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'
import pathManager from '../infrastructure/path-manager'
import configManager from '../infrastructure/config-manager'
import dateHelper from '../utils/date-helper'
import { metricsStorage } from '../storage/metrics-storage'
import {
  generateAIToolContexts,
  DEFAULT_AI_TOOLS,
  resolveToolIds,
  detectInstalledTools,
  type ProjectContext,
  type GenerateResult,
} from '../ai-tools'

const execAsync = promisify(exec)

// ============================================================================
// TYPES
// ============================================================================

interface GitData {
  branch: string
  commits: number
  contributors: number
  hasChanges: boolean
  stagedFiles: string[]
  modifiedFiles: string[]
  untrackedFiles: string[]
  recentCommits: { hash: string; message: string; date: string }[]
  weeklyCommits: number
}

interface ProjectStats {
  fileCount: number
  version: string
  name: string
  ecosystem: string
  projectType: string
  languages: string[]
  frameworks: string[]
}

interface Commands {
  install: string
  run: string
  test: string
  build: string
  dev: string
  lint: string
  format: string
}

interface StackDetection {
  hasFrontend: boolean
  hasBackend: boolean
  hasDatabase: boolean
  hasDocker: boolean
  hasTesting: boolean
  frontendType: 'web' | 'mobile' | 'both' | null
  frameworks: string[]
}

interface AgentInfo {
  name: string
  type: 'workflow' | 'domain'
  skill?: string
}

interface AIToolResult {
  toolId: string
  outputFile: string
  success: boolean
}

interface SyncMetrics {
  duration: number           // Sync duration in ms
  originalSize: number       // Estimated tokens before compression
  filteredSize: number       // Actual tokens in context files
  compressionRate: number    // Percentage saved
}

interface SyncResult {
  success: boolean
  projectId: string
  cliVersion: string
  git: GitData
  stats: ProjectStats
  commands: Commands
  stack: StackDetection
  agents: AgentInfo[]
  skills: { agent: string; skill: string }[]
  contextFiles: string[]
  aiTools: AIToolResult[]
  syncMetrics?: SyncMetrics
  error?: string
}

interface SyncOptions {
  aiTools?: string[]  // AI tools to generate context for (default: claude, cursor)
}

// ============================================================================
// SYNC SERVICE
// ============================================================================

class SyncService {
  private projectPath: string
  private projectId: string | null = null
  private globalPath: string = ''
  private cliVersion: string = '0.0.0'

  constructor() {
    this.projectPath = process.cwd()
  }

  /**
   * Main sync method - does everything in one call
   */
  async sync(projectPath: string = process.cwd(), options: SyncOptions = {}): Promise<SyncResult> {
    this.projectPath = projectPath
    const startTime = Date.now()

    // Resolve AI tools: supports 'auto', 'all', or specific list
    let aiToolIds: string[]
    if (!options.aiTools || options.aiTools.length === 0) {
      aiToolIds = DEFAULT_AI_TOOLS
    } else if (options.aiTools[0] === 'auto') {
      aiToolIds = detectInstalledTools(projectPath)
      if (aiToolIds.length === 0) aiToolIds = ['claude'] // fallback
    } else if (options.aiTools[0] === 'all') {
      aiToolIds = resolveToolIds('all', projectPath)
    } else {
      aiToolIds = options.aiTools
    }

    try {
      // 1. Get project config
      this.projectId = await configManager.getProjectId(projectPath)
      if (!this.projectId) {
        return {
          success: false,
          projectId: '',
          cliVersion: '',
          git: this.emptyGitData(),
          stats: this.emptyStats(),
          commands: this.emptyCommands(),
          stack: this.emptyStack(),
          agents: [],
          skills: [],
          contextFiles: [],
          aiTools: [],
          error: 'No prjct project. Run p. init first.',
        }
      }

      this.globalPath = pathManager.getGlobalProjectPath(this.projectId)
      this.cliVersion = await this.getCliVersion()

      // 2. Ensure directories exist (non-blocking)
      const ensureDirsPromise = this.ensureDirectories()

      // 3. Gather all data IN PARALLEL (30-50% speedup)
      // These operations are independent and can run concurrently
      const [git, stats, commands, stack] = await Promise.all([
        this.analyzeGit(),
        this.gatherStats(),
        this.detectCommands(),
        this.detectStack(),
      ])

      // Wait for directories before writing files
      await ensureDirsPromise

      // 4. Generate all files (depends on gathered data)
      const agents = await this.generateAgents(stack, stats)
      const skills = this.configureSkills(agents)
      const contextFiles = await this.generateContextFiles(git, stats, commands, agents)

      // 5. Generate AI tool context files (multi-agent output)
      const projectContext: ProjectContext = {
        projectId: this.projectId,
        name: stats.name,
        version: stats.version,
        ecosystem: stats.ecosystem,
        projectType: stats.projectType,
        languages: stats.languages,
        frameworks: stats.frameworks,
        repoPath: this.projectPath,
        branch: git.branch,
        fileCount: stats.fileCount,
        commits: git.commits,
        hasChanges: git.hasChanges,
        commands,
        agents: {
          workflow: agents.filter(a => a.type === 'workflow').map(a => a.name),
          domain: agents.filter(a => a.type === 'domain').map(a => a.name),
        },
      }

      const aiToolResults = await generateAIToolContexts(
        projectContext,
        this.globalPath,
        this.projectPath,
        aiToolIds
      )

      // 6-8. Update files IN PARALLEL (write to different files)
      await Promise.all([
        this.updateProjectJson(git, stats),
        this.updateStateJson(stats, stack),
        this.logToMemory(git, stats),
      ])

      // 9. Record metrics for value dashboard
      const duration = Date.now() - startTime
      const syncMetrics = await this.recordSyncMetrics(
        stats,
        contextFiles,
        agents,
        duration
      )

      return {
        success: true,
        projectId: this.projectId,
        cliVersion: this.cliVersion,
        git,
        stats,
        commands,
        stack,
        agents,
        skills,
        contextFiles,
        aiTools: aiToolResults.map(r => ({
          toolId: r.toolId,
          outputFile: r.outputFile,
          success: r.success,
        })),
        syncMetrics,
      }
    } catch (error) {
      return {
        success: false,
        projectId: this.projectId || '',
        cliVersion: this.cliVersion,
        git: this.emptyGitData(),
        stats: this.emptyStats(),
        commands: this.emptyCommands(),
        stack: this.emptyStack(),
        agents: [],
        skills: [],
        contextFiles: [],
        aiTools: [],
        error: (error as Error).message,
      }
    }
  }

  // ==========================================================================
  // DIRECTORY SETUP
  // ==========================================================================

  private async ensureDirectories(): Promise<void> {
    const dirs = ['storage', 'context', 'agents', 'memory', 'analysis', 'config', 'sync']
    // Create all directories IN PARALLEL
    await Promise.all(
      dirs.map(dir => fs.mkdir(path.join(this.globalPath, dir), { recursive: true }))
    )
  }

  // ==========================================================================
  // GIT ANALYSIS
  // ==========================================================================

  private async analyzeGit(): Promise<GitData> {
    const data: GitData = {
      branch: 'main',
      commits: 0,
      contributors: 0,
      hasChanges: false,
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      weeklyCommits: 0,
    }

    try {
      // Branch
      const { stdout: branch } = await execAsync('git branch --show-current', {
        cwd: this.projectPath,
      })
      data.branch = branch.trim() || 'main'

      // Total commits
      const { stdout: commits } = await execAsync('git rev-list --count HEAD', {
        cwd: this.projectPath,
      })
      data.commits = parseInt(commits.trim()) || 0

      // Contributors
      const { stdout: contributors } = await execAsync('git shortlog -sn --all | wc -l', {
        cwd: this.projectPath,
      })
      data.contributors = parseInt(contributors.trim()) || 0

      // Status
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: this.projectPath,
      })
      const lines = status.trim().split('\n').filter(Boolean)
      data.hasChanges = lines.length > 0

      for (const line of lines) {
        const code = line.substring(0, 2)
        const file = line.substring(3)
        if (code.startsWith('A') || code.startsWith('M ')) {
          data.stagedFiles.push(file)
        } else if (code.includes('M')) {
          data.modifiedFiles.push(file)
        } else if (code.startsWith('??')) {
          data.untrackedFiles.push(file)
        }
      }

      // Recent commits
      const { stdout: log } = await execAsync(
        'git log --oneline -20 --pretty=format:"%h|%s|%ad" --date=short',
        { cwd: this.projectPath }
      )
      data.recentCommits = log
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [hash, message, date] = line.split('|')
          return { hash, message, date }
        })

      // Weekly commits
      const { stdout: weekly } = await execAsync('git log --oneline --since="1 week ago" | wc -l', {
        cwd: this.projectPath,
      })
      data.weeklyCommits = parseInt(weekly.trim()) || 0
    } catch {
      // Not a git repo - use defaults
    }

    return data
  }

  // ==========================================================================
  // PROJECT STATS
  // ==========================================================================

  private async gatherStats(): Promise<ProjectStats> {
    const stats: ProjectStats = {
      fileCount: 0,
      version: '0.0.0',
      name: path.basename(this.projectPath),
      ecosystem: 'unknown',
      projectType: 'simple',
      languages: [],
      frameworks: [],
    }

    // Count files
    try {
      const { stdout } = await execAsync(
        'find . -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.tsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" \\) -not -path "./node_modules/*" -not -path "./.git/*" | wc -l',
        { cwd: this.projectPath }
      )
      stats.fileCount = parseInt(stdout.trim()) || 0
    } catch {
      stats.fileCount = 0
    }

    // Read package.json
    try {
      const pkgPath = path.join(this.projectPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
      stats.version = pkg.version || '0.0.0'
      stats.name = pkg.name || stats.name
      stats.ecosystem = 'JavaScript'

      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      // Detect frameworks
      if (deps.react || deps['react-dom']) stats.frameworks.push('React')
      if (deps.next) stats.frameworks.push('Next.js')
      if (deps.vue) stats.frameworks.push('Vue')
      if (deps.express) stats.frameworks.push('Express')
      if (deps.hono) stats.frameworks.push('Hono')
      if (deps['@angular/core']) stats.frameworks.push('Angular')
      if (deps.svelte) stats.frameworks.push('Svelte')

      // Detect languages
      if (pkg.devDependencies?.typescript || (await this.fileExists('tsconfig.json'))) {
        stats.languages.push('TypeScript')
      } else {
        stats.languages.push('JavaScript')
      }
    } catch {
      // No package.json
    }

    // Check other ecosystems
    if (await this.fileExists('Cargo.toml')) {
      stats.ecosystem = 'Rust'
      stats.languages.push('Rust')
    }
    if (await this.fileExists('go.mod')) {
      stats.ecosystem = 'Go'
      stats.languages.push('Go')
    }
    if (await this.fileExists('requirements.txt') || await this.fileExists('pyproject.toml')) {
      stats.ecosystem = 'Python'
      stats.languages.push('Python')
    }

    // Determine project type
    if (stats.fileCount > 300 || stats.frameworks.length >= 3) {
      stats.projectType = 'enterprise'
    } else if (stats.fileCount > 50 || stats.frameworks.length >= 2) {
      stats.projectType = 'complex'
    }

    return stats
  }

  // ==========================================================================
  // COMMAND DETECTION
  // ==========================================================================

  private async detectCommands(): Promise<Commands> {
    const commands: Commands = {
      install: 'npm install',
      run: 'npm run',
      test: 'npm test',
      build: 'npm run build',
      dev: 'npm run dev',
      lint: 'npm run lint',
      format: 'npm run format',
    }

    // Detect package manager
    if (await this.fileExists('bun.lockb')) {
      commands.install = 'bun install'
      commands.run = 'bun run'
      commands.test = 'bun test'
      commands.build = 'bun run build'
      commands.dev = 'bun run dev'
      commands.lint = 'bun run lint'
      commands.format = 'bun run format'
    } else if (await this.fileExists('pnpm-lock.yaml')) {
      commands.install = 'pnpm install'
      commands.run = 'pnpm run'
      commands.test = 'pnpm test'
      commands.build = 'pnpm run build'
      commands.dev = 'pnpm run dev'
      commands.lint = 'pnpm run lint'
      commands.format = 'pnpm run format'
    } else if (await this.fileExists('yarn.lock')) {
      commands.install = 'yarn'
      commands.run = 'yarn'
      commands.test = 'yarn test'
      commands.build = 'yarn build'
      commands.dev = 'yarn dev'
      commands.lint = 'yarn lint'
      commands.format = 'yarn format'
    }

    // Non-JS ecosystems
    if (await this.fileExists('Cargo.toml')) {
      commands.install = 'cargo build'
      commands.run = 'cargo run'
      commands.test = 'cargo test'
      commands.build = 'cargo build --release'
      commands.dev = 'cargo run'
      commands.lint = 'cargo clippy'
      commands.format = 'cargo fmt'
    }

    if (await this.fileExists('go.mod')) {
      commands.install = 'go mod download'
      commands.run = 'go run .'
      commands.test = 'go test ./...'
      commands.build = 'go build'
      commands.dev = 'go run .'
      commands.lint = 'golangci-lint run'
      commands.format = 'go fmt ./...'
    }

    return commands
  }

  // ==========================================================================
  // STACK DETECTION
  // ==========================================================================

  private async detectStack(): Promise<StackDetection> {
    const stack: StackDetection = {
      hasFrontend: false,
      hasBackend: false,
      hasDatabase: false,
      hasDocker: false,
      hasTesting: false,
      frontendType: null,
      frameworks: [],
    }

    try {
      const pkgPath = path.join(this.projectPath, 'package.json')
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      // Frontend detection
      if (deps.react || deps.vue || deps.svelte || deps['@angular/core']) {
        stack.hasFrontend = true
        stack.frontendType = 'web'
      }
      if (deps['react-native'] || deps.expo) {
        stack.hasFrontend = true
        stack.frontendType = stack.frontendType === 'web' ? 'both' : 'mobile'
      }

      // Backend detection
      if (deps.express || deps.fastify || deps.hono || deps.koa || deps.nest) {
        stack.hasBackend = true
      }

      // Database detection
      if (deps.prisma || deps.mongoose || deps.pg || deps.mysql2 || deps.sequelize) {
        stack.hasDatabase = true
      }

      // Testing detection
      if (deps.jest || deps.vitest || deps.mocha || pkg.devDependencies?.['bun-types']) {
        stack.hasTesting = true
      }

      // Collect frameworks
      if (deps.react) stack.frameworks.push('React')
      if (deps.next) stack.frameworks.push('Next.js')
      if (deps.express) stack.frameworks.push('Express')
      if (deps.hono) stack.frameworks.push('Hono')
    } catch {
      // No package.json
    }

    // Docker detection
    stack.hasDocker =
      (await this.fileExists('Dockerfile')) || (await this.fileExists('docker-compose.yml'))

    return stack
  }

  // ==========================================================================
  // AGENT GENERATION
  // ==========================================================================

  private async generateAgents(stack: StackDetection, stats: ProjectStats): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = []
    const agentsPath = path.join(this.globalPath, 'agents')

    // Purge old agents
    try {
      const files = await fs.readdir(agentsPath)
      for (const file of files) {
        if (file.endsWith('.md')) {
          await fs.unlink(path.join(agentsPath, file))
        }
      }
    } catch {
      // Directory might not exist yet
    }

    // Workflow agents (always generated) - IN PARALLEL
    const workflowAgents = ['prjct-workflow', 'prjct-planner', 'prjct-shipper']
    await Promise.all(workflowAgents.map(name => this.generateWorkflowAgent(name, agentsPath)))
    for (const name of workflowAgents) {
      agents.push({ name, type: 'workflow' })
    }

    // Domain agents (based on stack) - COLLECT AND GENERATE IN PARALLEL
    const domainAgentsToGenerate: { name: string; skill?: string }[] = []

    if (stack.hasFrontend) {
      domainAgentsToGenerate.push({ name: 'frontend', skill: 'javascript-typescript' })
      domainAgentsToGenerate.push({ name: 'uxui', skill: 'frontend-design' })
    }
    if (stack.hasBackend) {
      domainAgentsToGenerate.push({ name: 'backend', skill: 'javascript-typescript' })
    }
    if (stack.hasDatabase) {
      domainAgentsToGenerate.push({ name: 'database' })
    }
    if (stack.hasTesting) {
      domainAgentsToGenerate.push({ name: 'testing', skill: 'developer-kit' })
    }
    if (stack.hasDocker) {
      domainAgentsToGenerate.push({ name: 'devops', skill: 'developer-kit' })
    }

    // Generate all domain agents IN PARALLEL
    await Promise.all(
      domainAgentsToGenerate.map(agent =>
        this.generateDomainAgent(agent.name, agentsPath, stats, stack)
      )
    )

    // Add to agents list
    for (const agent of domainAgentsToGenerate) {
      agents.push({ name: agent.name, type: 'domain', skill: agent.skill })
    }

    return agents
  }

  private async generateWorkflowAgent(name: string, agentsPath: string): Promise<void> {
    // Try to read template
    let content = ''
    try {
      const templatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'subagents',
        'workflow',
        `${name}.md`
      )
      content = await fs.readFile(templatePath, 'utf-8')
    } catch {
      // Generate minimal agent
      content = this.generateMinimalWorkflowAgent(name)
    }

    await fs.writeFile(path.join(agentsPath, `${name}.md`), content, 'utf-8')
  }

  private async generateDomainAgent(
    name: string,
    agentsPath: string,
    stats: ProjectStats,
    stack: StackDetection
  ): Promise<void> {
    // Try to read template
    let content = ''
    try {
      const templatePath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'subagents',
        'domain',
        `${name}.md`
      )
      content = await fs.readFile(templatePath, 'utf-8')

      // Inject project-specific context
      content = content.replace('{projectName}', stats.name)
      content = content.replace('{frameworks}', stack.frameworks.join(', ') || 'None detected')
      content = content.replace('{ecosystem}', stats.ecosystem)
    } catch {
      // Generate minimal agent
      content = this.generateMinimalDomainAgent(name, stats, stack)
    }

    await fs.writeFile(path.join(agentsPath, `${name}.md`), content, 'utf-8')
  }

  private generateMinimalWorkflowAgent(name: string): string {
    const descriptions: Record<string, string> = {
      'prjct-workflow': 'Task lifecycle: now, done, pause, resume',
      'prjct-planner': 'Planning: task, prd, spec, bug',
      'prjct-shipper': 'Shipping: ship, merge, review',
    }

    return `---
name: ${name}
description: ${descriptions[name] || 'Workflow agent'}
tools: Read, Write, Glob
---

# ${name.toUpperCase()}

Workflow agent for prjct operations.

## Project Context

When invoked:
1. Read \`.prjct/prjct.config.json\` → extract \`projectId\`
2. Read \`~/.prjct-cli/projects/{projectId}/storage/state.json\`
3. Execute requested operation
`
  }

  private generateMinimalDomainAgent(
    name: string,
    stats: ProjectStats,
    stack: StackDetection
  ): string {
    return `---
name: ${name}
description: ${name.charAt(0).toUpperCase() + name.slice(1)} specialist for ${stats.name}
tools: Read, Write, Glob, Grep
skills: []
---

# ${name.toUpperCase()} AGENT

Domain specialist for ${name} tasks.

## Project Context

- **Project**: ${stats.name}
- **Ecosystem**: ${stats.ecosystem}
- **Frameworks**: ${stack.frameworks.join(', ') || 'None detected'}

## Your Role

You are the ${name} expert for this project. Apply best practices for the detected stack.
`
  }

  // ==========================================================================
  // SKILL CONFIGURATION
  // ==========================================================================

  private configureSkills(agents: AgentInfo[]): { agent: string; skill: string }[] {
    const skills: { agent: string; skill: string }[] = []

    for (const agent of agents) {
      if (agent.skill) {
        skills.push({ agent: agent.name, skill: agent.skill })
      }
    }

    // Write skills.json
    const skillsConfig = {
      projectId: this.projectId,
      syncedAt: dateHelper.getTimestamp(),
      skills: skills.map((s) => ({
        name: s.skill,
        linkedAgents: [s.agent],
      })),
      agentSkillMap: Object.fromEntries(skills.map((s) => [s.agent, s.skill])),
    }

    fs.writeFile(
      path.join(this.globalPath, 'config', 'skills.json'),
      JSON.stringify(skillsConfig, null, 2),
      'utf-8'
    ).catch(() => {
      // Best effort
    })

    return skills
  }

  // ==========================================================================
  // CONTEXT FILE GENERATION
  // ==========================================================================

  private async generateContextFiles(
    git: GitData,
    stats: ProjectStats,
    commands: Commands,
    agents: AgentInfo[]
  ): Promise<string[]> {
    const contextPath = path.join(this.globalPath, 'context')

    // Generate all context files IN PARALLEL (write to different files)
    await Promise.all([
      this.generateClaudeMd(contextPath, git, stats, commands, agents),
      this.generateNowMd(contextPath),
      this.generateNextMd(contextPath),
      this.generateIdeasMd(contextPath),
      this.generateShippedMd(contextPath),
    ])

    return [
      'context/CLAUDE.md',
      'context/now.md',
      'context/next.md',
      'context/ideas.md',
      'context/shipped.md',
    ]
  }

  private async generateClaudeMd(
    contextPath: string,
    git: GitData,
    stats: ProjectStats,
    commands: Commands,
    agents: AgentInfo[]
  ): Promise<void> {
    const workflowAgents = agents.filter((a) => a.type === 'workflow').map((a) => a.name)
    const domainAgents = agents.filter((a) => a.type === 'domain').map((a) => a.name)

    const content = `# ${stats.name} - Project Rules
<!-- projectId: ${this.projectId} -->
<!-- Generated: ${dateHelper.getTimestamp()} -->
<!-- Ecosystem: ${stats.ecosystem} | Type: ${stats.projectType} -->

## THIS PROJECT (${stats.ecosystem})

**Type:** ${stats.projectType}
**Path:** ${this.projectPath}

### Commands (USE THESE, NOT OTHERS)

| Action | Command |
|--------|---------|
| Install dependencies | \`${commands.install}\` |
| Run dev server | \`${commands.dev}\` |
| Run tests | \`${commands.test}\` |
| Build | \`${commands.build}\` |
| Lint | \`${commands.lint}\` |
| Format | \`${commands.format}\` |

### Code Conventions

- **Languages**: ${stats.languages.join(', ') || 'Not detected'}
- **Frameworks**: ${stats.frameworks.join(', ') || 'Not detected'}

---

## PRJCT RULES

### Path Resolution
**ALL prjct writes go to**: \`~/.prjct-cli/projects/${this.projectId}/\`
- NEVER write to \`.prjct/\`
- NEVER write to \`./\` for prjct data

### Workflow
\`\`\`
p. sync → p. task "desc" → [work] → p. done → p. ship
\`\`\`

| Command | Action |
|---------|--------|
| \`p. sync\` | Re-analyze project |
| \`p. task X\` | Start task |
| \`p. done\` | Complete subtask |
| \`p. ship X\` | Ship feature |

---

## PROJECT STATE

| Field | Value |
|-------|-------|
| Name | ${stats.name} |
| Version | ${stats.version} |
| Ecosystem | ${stats.ecosystem} |
| Branch | ${git.branch} |
| Files | ~${stats.fileCount} |
| Commits | ${git.commits} |

---

## AGENTS

Load from \`~/.prjct-cli/projects/${this.projectId}/agents/\`:

**Workflow**: ${workflowAgents.join(', ')}
**Domain**: ${domainAgents.join(', ') || 'none'}
`

    await fs.writeFile(path.join(contextPath, 'CLAUDE.md'), content, 'utf-8')
  }

  private async generateNowMd(contextPath: string): Promise<void> {
    // Read current task from state
    let currentTask = null
    try {
      const statePath = path.join(this.globalPath, 'storage', 'state.json')
      const state = JSON.parse(await fs.readFile(statePath, 'utf-8'))
      currentTask = state.currentTask
    } catch {
      // No state file
    }

    const content = currentTask
      ? `# NOW

**${currentTask.description}**

Started: ${currentTask.startedAt}
${currentTask.branch ? `Branch: ${currentTask.branch.name}` : ''}
`
      : `# NOW

_No active task_

Use \`p. task "description"\` to start working.
`

    await fs.writeFile(path.join(contextPath, 'now.md'), content, 'utf-8')
  }

  private async generateNextMd(contextPath: string): Promise<void> {
    let queue: { tasks: { description: string; priority?: string }[] } = { tasks: [] }
    try {
      const queuePath = path.join(this.globalPath, 'storage', 'queue.json')
      queue = JSON.parse(await fs.readFile(queuePath, 'utf-8'))
    } catch {
      // No queue file
    }

    const content = `# NEXT

${
  queue.tasks.length > 0
    ? queue.tasks.map((t, i) => `${i + 1}. ${t.description}${t.priority ? ` [${t.priority}]` : ''}`).join('\n')
    : '_Empty queue_'
}
`

    await fs.writeFile(path.join(contextPath, 'next.md'), content, 'utf-8')
  }

  private async generateIdeasMd(contextPath: string): Promise<void> {
    let ideas: { ideas: { text: string; priority?: string }[] } = { ideas: [] }
    try {
      const ideasPath = path.join(this.globalPath, 'storage', 'ideas.json')
      ideas = JSON.parse(await fs.readFile(ideasPath, 'utf-8'))
    } catch {
      // No ideas file
    }

    const content = `# IDEAS

${
  ideas.ideas.length > 0
    ? ideas.ideas.map((i) => `- ${i.text}${i.priority ? ` [${i.priority}]` : ''}`).join('\n')
    : '_No ideas captured yet_'
}
`

    await fs.writeFile(path.join(contextPath, 'ideas.md'), content, 'utf-8')
  }

  private async generateShippedMd(contextPath: string): Promise<void> {
    let shipped: { shipped: { name: string; version?: string; shippedAt: string }[] } = {
      shipped: [],
    }
    try {
      const shippedPath = path.join(this.globalPath, 'storage', 'shipped.json')
      shipped = JSON.parse(await fs.readFile(shippedPath, 'utf-8'))
    } catch {
      // No shipped file
    }

    const content = `# SHIPPED 🚀

${
  shipped.shipped.length > 0
    ? shipped.shipped
        .slice(-10)
        .map((s) => `- **${s.name}**${s.version ? ` v${s.version}` : ''} - ${s.shippedAt}`)
        .join('\n')
    : '_Nothing shipped yet_'
}

**Total shipped:** ${shipped.shipped.length}
`

    await fs.writeFile(path.join(contextPath, 'shipped.md'), content, 'utf-8')
  }

  // ==========================================================================
  // PROJECT.JSON UPDATE
  // ==========================================================================

  private async updateProjectJson(git: GitData, stats: ProjectStats): Promise<void> {
    const projectJsonPath = path.join(this.globalPath, 'project.json')

    // Read existing
    let existing: Record<string, unknown> = {}
    try {
      existing = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'))
    } catch {
      // No existing file
    }

    const updated = {
      ...existing,
      projectId: this.projectId,
      repoPath: this.projectPath,
      name: stats.name,
      version: stats.version,
      cliVersion: this.cliVersion,
      techStack: stats.frameworks,
      fileCount: stats.fileCount,
      commitCount: git.commits,
      stack: stats.ecosystem,
      currentBranch: git.branch,
      hasUncommittedChanges: git.hasChanges,
      createdAt: existing.createdAt || dateHelper.getTimestamp(),
      lastSync: dateHelper.getTimestamp(),
    }

    await fs.writeFile(projectJsonPath, JSON.stringify(updated, null, 2), 'utf-8')
  }

  // ==========================================================================
  // STATE.JSON UPDATE
  // ==========================================================================

  private async updateStateJson(stats: ProjectStats, stack: StackDetection): Promise<void> {
    const statePath = path.join(this.globalPath, 'storage', 'state.json')

    // Read existing
    let state: Record<string, unknown> = {}
    try {
      state = JSON.parse(await fs.readFile(statePath, 'utf-8'))
    } catch {
      // No existing file
    }

    // Update with enterprise fields
    state.projectId = this.projectId
    state.stack = {
      language: stats.languages[0] || 'Unknown',
      framework: stats.frameworks[0] || null,
    }
    state.domains = {
      hasFrontend: stack.hasFrontend,
      hasBackend: stack.hasBackend,
      hasDatabase: stack.hasDatabase,
      hasTesting: stack.hasTesting,
      hasDocker: stack.hasDocker,
    }
    state.projectType = stats.projectType
    state.metrics = {
      totalFiles: stats.fileCount,
    }
    state.lastSync = dateHelper.getTimestamp()
    state.lastUpdated = dateHelper.getTimestamp()
    state.context = {
      ...(state.context as Record<string, unknown> || {}),
      lastSession: dateHelper.getTimestamp(),
      lastAction: 'Synced project',
      nextAction: 'Run `p. task "description"` to start working',
    }

    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
  }

  // ==========================================================================
  // MEMORY LOGGING
  // ==========================================================================

  private async logToMemory(git: GitData, stats: ProjectStats): Promise<void> {
    const memoryPath = path.join(this.globalPath, 'memory', 'events.jsonl')

    const event = {
      ts: dateHelper.getTimestamp(),
      action: 'sync',
      branch: git.branch,
      uncommitted: git.hasChanges,
      fileCount: stats.fileCount,
      commitCount: git.commits,
    }

    await fs.appendFile(memoryPath, JSON.stringify(event) + '\n', 'utf-8')
  }

  // ==========================================================================
  // METRICS RECORDING
  // ==========================================================================

  /**
   * Record sync metrics for the value dashboard
   *
   * Calculates token savings by comparing:
   * - Original: Estimated tokens if we sent all source files
   * - Filtered: Actual tokens in generated context files
   *
   * Token estimation: ~4 chars per token (industry standard)
   */
  private async recordSyncMetrics(
    stats: ProjectStats,
    contextFiles: string[],
    agents: AgentInfo[],
    duration: number
  ): Promise<SyncMetrics> {
    const CHARS_PER_TOKEN = 4

    // Calculate filtered size (actual context files generated)
    let filteredChars = 0
    for (const file of contextFiles) {
      try {
        const filePath = path.join(this.globalPath, file)
        const content = await fs.readFile(filePath, 'utf-8')
        filteredChars += content.length
      } catch {
        // File might not exist, skip
      }
    }

    // Also count agent files
    for (const agent of agents) {
      try {
        const agentPath = path.join(this.globalPath, 'agents', `${agent.name}.md`)
        const content = await fs.readFile(agentPath, 'utf-8')
        filteredChars += content.length
      } catch {
        // Skip if not found
      }
    }

    const filteredSize = Math.floor(filteredChars / CHARS_PER_TOKEN)

    // Estimate original size (what it would take without prjct)
    // Conservative estimate: avg 500 tokens per source file
    // Plus overhead for manually creating context
    const avgTokensPerFile = 500
    const originalSize = stats.fileCount * avgTokensPerFile

    // Calculate compression rate
    const compressionRate = originalSize > 0
      ? Math.max(0, (originalSize - filteredSize) / originalSize)
      : 0

    // Record to storage
    try {
      await metricsStorage.recordSync(this.projectId!, {
        originalSize,
        filteredSize,
        duration,
        isWatch: false,
        agents: agents.filter(a => a.type === 'domain').map(a => a.name),
      })
    } catch (error) {
      // Non-blocking - metrics are nice to have
      console.error('Warning: Failed to record metrics:', (error as Error).message)
    }

    return {
      duration,
      originalSize,
      filteredSize,
      compressionRate,
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, filename))
      return true
    } catch {
      return false
    }
  }

  private async getCliVersion(): Promise<string> {
    try {
      // Try to read from package.json in the module
      const pkgPath = path.join(__dirname, '..', '..', 'package.json')
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
      return pkg.version || '0.0.0'
    } catch {
      return '0.0.0'
    }
  }

  // Empty data structures for error cases
  private emptyGitData(): GitData {
    return {
      branch: 'main',
      commits: 0,
      contributors: 0,
      hasChanges: false,
      stagedFiles: [],
      modifiedFiles: [],
      untrackedFiles: [],
      recentCommits: [],
      weeklyCommits: 0,
    }
  }

  private emptyStats(): ProjectStats {
    return {
      fileCount: 0,
      version: '0.0.0',
      name: 'unknown',
      ecosystem: 'unknown',
      projectType: 'simple',
      languages: [],
      frameworks: [],
    }
  }

  private emptyCommands(): Commands {
    return {
      install: 'npm install',
      run: 'npm run',
      test: 'npm test',
      build: 'npm run build',
      dev: 'npm run dev',
      lint: 'npm run lint',
      format: 'npm run format',
    }
  }

  private emptyStack(): StackDetection {
    return {
      hasFrontend: false,
      hasBackend: false,
      hasDatabase: false,
      hasDocker: false,
      hasTesting: false,
      frontendType: null,
      frameworks: [],
    }
  }
}

export const syncService = new SyncService()
export { SyncService, SyncResult }
