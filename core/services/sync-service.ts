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

import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import {
  DEFAULT_AI_TOOLS,
  detectInstalledTools,
  generateAIToolContexts,
  type ProjectContext,
  resolveToolIds,
} from '../ai-tools'
import { indexProject } from '../domain/bm25'
import { affectedDomains, propagateChanges } from '../domain/change-propagator'
import { detectChanges, hasHashRegistry, saveHashes } from '../domain/file-hasher'
import { indexCoChanges } from '../domain/git-cochange'
import { indexImports } from '../domain/import-graph'
import { getErrorMessage } from '../errors'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { analysisStorage } from '../storage/analysis-storage'
import { metricsStorage } from '../storage/metrics-storage'
import { migrateJsonToSqlite } from '../storage/migrate-json'
import type {
  GitData,
  IncrementalInfo,
  ProjectCommands,
  ProjectStats,
  ProjectSyncResult,
  StackDetection,
  SyncAgentInfo,
  SyncMetrics,
  SyncOptions,
  VerificationReport,
} from '../types'
import { type ContextSources, defaultSources, type SourceInfo } from '../utils/citations'
import * as dateHelper from '../utils/date-helper'
import log from '../utils/logger'
import { ContextFileGenerator } from './context-generator'
import { localStateGenerator } from './local-state-generator'
import { skillInstaller } from './skill-installer'
import { StackDetector } from './stack-detector'
import { syncVerifier } from './sync-verifier'

const execAsync = promisify(exec)

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
  async sync(
    projectPath: string = process.cwd(),
    options: SyncOptions = {}
  ): Promise<ProjectSyncResult> {
    this.projectPath = projectPath
    const startTime = Date.now()

    // Resolve AI tools: supports 'auto', 'all', or specific list
    // Default behavior: claude + any detected IDE tools (.cursor/, .windsurf/)
    let aiToolIds: string[]
    if (!options.aiTools || options.aiTools.length === 0) {
      // Start with default CLI tools and add detected IDE tools
      const detectedIdeTools = (await detectInstalledTools(projectPath)).filter(
        (id) => !DEFAULT_AI_TOOLS.includes(id)
      )
      aiToolIds = [...DEFAULT_AI_TOOLS, ...detectedIdeTools]
    } else if (options.aiTools[0] === 'auto') {
      aiToolIds = await detectInstalledTools(projectPath)
      if (aiToolIds.length === 0) aiToolIds = ['claude'] // fallback
    } else if (options.aiTools[0] === 'all') {
      aiToolIds = await resolveToolIds('all', projectPath)
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
          skillsInstalled: [],
          contextFiles: [],
          aiTools: [],
          error: 'No prjct project. Run p. init first.',
        }
      }

      this.globalPath = pathManager.getGlobalProjectPath(this.projectId)
      this.cliVersion = await this.getCliVersion()

      // 2. Ensure directories exist (non-blocking)
      const ensureDirsPromise = this.ensureDirectories()

      // 2b. Auto-migrate JSON → SQLite (idempotent, skips if already done)
      await ensureDirsPromise
      await migrateJsonToSqlite(this.projectId)

      // 3. Gather all data IN PARALLEL (30-50% speedup)
      // These operations are independent and can run concurrently
      const [git, stats, commands, stack] = await Promise.all([
        this.analyzeGit(),
        this.gatherStats(),
        this.detectCommands(),
        this.detectStack(),
      ])

      // 3a. Incremental change detection
      // Determine if we can skip expensive operations based on file changes
      const isFullSync = options.full === true
      let incrementalInfo: IncrementalInfo | undefined
      let shouldRebuildIndexes = true
      let shouldRegenerateAgents = true
      let changedDomains = new Set<string>()

      if (!isFullSync && hasHashRegistry(this.projectId!)) {
        try {
          const { diff, currentHashes } = await detectChanges(this.projectPath, this.projectId!)
          const totalChanged = diff.added.length + diff.modified.length + diff.deleted.length

          if (totalChanged === 0 && !options.changedFiles?.length) {
            // Nothing changed — skip expensive rebuilds
            shouldRebuildIndexes = false
            shouldRegenerateAgents = false
            incrementalInfo = {
              isIncremental: true,
              filesChanged: 0,
              filesUnchanged: diff.unchanged.length,
              indexesRebuilt: false,
              agentsRegenerated: false,
              affectedDomains: [],
            }
          } else {
            // Some files changed — propagate through import graph
            const propagated = propagateChanges(diff, this.projectId!)
            changedDomains = affectedDomains(propagated.allAffected)

            // Only rebuild indexes if source files changed
            const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
            const hasSourceChanges = propagated.allAffected.some((f) => {
              const ext = f.substring(f.lastIndexOf('.'))
              return sourceExtensions.has(ext)
            })
            shouldRebuildIndexes = hasSourceChanges

            // Only regenerate agents if stack/domains might have changed
            // (new files added to previously empty domains, or config files changed)
            const configChanged = propagated.directlyChanged.some(
              (f) =>
                f === 'package.json' ||
                f === 'tsconfig.json' ||
                f.includes('Dockerfile') ||
                f.includes('docker-compose')
            )
            shouldRegenerateAgents = configChanged

            incrementalInfo = {
              isIncremental: true,
              filesChanged: totalChanged,
              filesUnchanged: diff.unchanged.length,
              indexesRebuilt: shouldRebuildIndexes,
              agentsRegenerated: shouldRegenerateAgents,
              affectedDomains: Array.from(changedDomains),
            }
          }

          // Save updated hashes AFTER determining diff (commit new state)
          saveHashes(this.projectId!, currentHashes)
        } catch (error) {
          log.debug('Incremental detection failed, falling back to full sync', {
            error: getErrorMessage(error),
          })
          // Fall through to full sync
        }
      } else {
        // First sync or --full flag: compute and save hashes for next time
        try {
          const { currentHashes } = await detectChanges(this.projectPath, this.projectId!)
          saveHashes(this.projectId!, currentHashes)
        } catch (error) {
          log.debug('Hash computation failed (non-critical)', {
            error: getErrorMessage(error),
          })
        }
      }

      // 3b. Build file-ranking indexes IN PARALLEL (BM25, import graph, co-change)
      // Skip if no source files changed (incremental optimization)
      if (shouldRebuildIndexes) {
        try {
          await Promise.all([
            indexProject(this.projectPath, this.projectId!),
            indexImports(this.projectPath, this.projectId!),
            indexCoChanges(this.projectPath, this.projectId!),
          ])
        } catch (error) {
          log.debug('File ranking index build failed (non-critical)', {
            error: getErrorMessage(error),
          })
        }
      }

      // 4. Generate all files (depends on gathered data)
      // Skip agent regeneration if nothing structural changed
      const agents = shouldRegenerateAgents
        ? await this.generateAgents(stack, stats)
        : await this.loadExistingAgents()
      const skills = this.configureSkills(agents)
      const skillsInstalled = shouldRegenerateAgents ? await this.autoInstallSkills(agents) : []
      const sources = this.buildSources(stats, commands)
      const contextFiles = await this.generateContextFiles(git, stats, commands, agents, sources)

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
          workflow: agents.filter((a) => a.type === 'workflow').map((a) => a.name),
          domain: agents.filter((a) => a.type === 'domain').map((a) => a.name),
        },
        sources,
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
        this.saveDraftAnalysis(git, stats, stack),
      ])

      // 9. Record metrics for value dashboard
      const duration = Date.now() - startTime
      const syncMetrics = await this.recordSyncMetrics(stats, contextFiles, agents, duration)

      // 10. Update global config and commands (CLI does EVERYTHING)
      // This ensures `prjct sync` from terminal updates global CLAUDE.md and commands
      await commandInstaller.installGlobalConfig()
      await commandInstaller.syncCommands()

      // 11. Run verification checks (built-in + custom from config)
      let verification: VerificationReport | undefined
      try {
        const localConfig = await configManager.readConfig(this.projectPath)
        verification = await syncVerifier.verify(
          this.projectPath,
          this.globalPath,
          localConfig?.verification
        )
      } catch (error) {
        log.debug('Verification failed (non-critical)', { error: getErrorMessage(error) })
      }

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
        skillsInstalled,
        contextFiles,
        aiTools: aiToolResults.map((r) => ({
          toolId: r.toolId,
          outputFile: r.outputFile,
          success: r.success,
        })),
        syncMetrics,
        verification,
        incremental: incrementalInfo,
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
        skillsInstalled: [],
        contextFiles: [],
        aiTools: [],
        error: getErrorMessage(error),
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
      dirs.map((dir) => fs.mkdir(path.join(this.globalPath, dir), { recursive: true }))
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
      data.commits = parseInt(commits.trim(), 10) || 0

      // Contributors
      const { stdout: contributors } = await execAsync('git shortlog -sn --all | wc -l', {
        cwd: this.projectPath,
      })
      data.contributors = parseInt(contributors.trim(), 10) || 0

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
      data.weeklyCommits = parseInt(weekly.trim(), 10) || 0
    } catch (error) {
      log.debug('Git analysis failed (not a git repo?)', { error: getErrorMessage(error) })
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
      stats.fileCount = parseInt(stdout.trim(), 10) || 0
    } catch (error) {
      log.debug('File count failed', { path: this.projectPath, error: getErrorMessage(error) })
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
    } catch (error) {
      log.debug('No package.json found', { path: this.projectPath, error: getErrorMessage(error) })
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
    if ((await this.fileExists('requirements.txt')) || (await this.fileExists('pyproject.toml'))) {
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

  private async detectCommands(): Promise<ProjectCommands> {
    const commands: ProjectCommands = {
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
  // SOURCE CITATIONS
  // ==========================================================================

  private buildSources(stats: ProjectStats, commands: ProjectCommands): ContextSources {
    const sources = defaultSources()

    // Determine ecosystem source file
    const ecosystemFiles: Record<string, string> = {
      JavaScript: 'package.json',
      Rust: 'Cargo.toml',
      Go: 'go.mod',
      Python: 'pyproject.toml',
    }
    const ecosystemFile = ecosystemFiles[stats.ecosystem] || 'filesystem'
    const detected = (file: string): SourceInfo => ({ file, type: 'detected' })
    const inferred = (file: string): SourceInfo => ({ file, type: 'inferred' })

    sources.ecosystem = detected(ecosystemFile)
    sources.name = detected(ecosystemFile)
    sources.version = detected(ecosystemFile)
    sources.languages = detected(ecosystemFile)
    sources.frameworks = detected(ecosystemFile)

    // Commands source is the lock file or ecosystem file
    if (commands.install.startsWith('bun')) {
      sources.commands = detected('bun.lockb')
    } else if (commands.install.startsWith('pnpm')) {
      sources.commands = detected('pnpm-lock.yaml')
    } else if (commands.install === 'yarn') {
      sources.commands = detected('yarn.lock')
    } else if (commands.install.startsWith('cargo')) {
      sources.commands = detected('Cargo.toml')
    } else if (commands.install.startsWith('go')) {
      sources.commands = detected('go.mod')
    } else {
      sources.commands = detected('package.json')
    }

    // Project type is inferred from file count + framework count
    sources.projectType = inferred('file count + frameworks')

    // Git is always from git
    sources.git = detected('git')

    return sources
  }

  // ==========================================================================
  // STACK DETECTION
  // ==========================================================================

  private async detectStack(): Promise<StackDetection> {
    const detector = new StackDetector(this.projectPath)
    return detector.detect()
  }

  // ==========================================================================
  // AGENT GENERATION
  // ==========================================================================

  private async generateAgents(
    stack: StackDetection,
    stats: ProjectStats
  ): Promise<SyncAgentInfo[]> {
    const agents: SyncAgentInfo[] = []
    const agentsPath = path.join(this.globalPath, 'agents')

    // Purge old agents
    try {
      const files = await fs.readdir(agentsPath)
      for (const file of files) {
        if (file.endsWith('.md')) {
          await fs.unlink(path.join(agentsPath, file))
        }
      }
    } catch (error) {
      log.debug('Failed to purge old agents', { path: agentsPath, error: getErrorMessage(error) })
    }

    // Workflow agents (always generated) - IN PARALLEL
    const workflowAgents = ['prjct-workflow', 'prjct-planner', 'prjct-shipper']
    await Promise.all(workflowAgents.map((name) => this.generateWorkflowAgent(name, agentsPath)))
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
      domainAgentsToGenerate.map((agent) =>
        this.generateDomainAgent(agent.name, agentsPath, stats, stack)
      )
    )

    // Add to agents list
    for (const agent of domainAgentsToGenerate) {
      agents.push({ name: agent.name, type: 'domain', skill: agent.skill })
    }

    return agents
  }

  /**
   * Load existing agent info from disk (for incremental sync when agents don't need regeneration).
   * Reads the agents directory and returns metadata without regenerating files.
   */
  private async loadExistingAgents(): Promise<SyncAgentInfo[]> {
    const agentsPath = path.join(this.globalPath, 'agents')
    const agents: SyncAgentInfo[] = []

    try {
      const files = await fs.readdir(agentsPath)
      const workflowNames = new Set(['prjct-workflow', 'prjct-planner', 'prjct-shipper'])

      for (const file of files) {
        if (!file.endsWith('.md')) continue
        const name = file.replace('.md', '')
        const type = workflowNames.has(name) ? ('workflow' as const) : ('domain' as const)
        agents.push({ name, type })
      }
    } catch {
      // No existing agents — fall back to generation
      return []
    }

    return agents
  }

  /**
   * Resolve {{> partial-name }} includes in template content.
   * Loads partials from templates/subagents/.
   */
  private async resolveTemplateIncludes(content: string): Promise<string> {
    const includePattern = /\{\{>\s*([\w-]+)\s*\}\}/g
    const matches = [...content.matchAll(includePattern)]

    if (matches.length === 0) return content

    let resolved = content
    for (const match of matches) {
      const partialName = match[1]
      const partialPath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'subagents',
        `${partialName}.md`
      )
      try {
        const partialContent = await fs.readFile(partialPath, 'utf-8')
        resolved = resolved.replace(match[0], partialContent.trim())
      } catch {
        // Partial not found — leave marker for debugging
        resolved = resolved.replace(match[0], `<!-- partial "${partialName}" not found -->`)
      }
    }

    return resolved
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
      content = await this.resolveTemplateIncludes(content)
    } catch (error) {
      log.debug('Workflow agent template not found, generating minimal', {
        name,
        error: getErrorMessage(error),
      })
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

      // Resolve includes before variable replacement
      content = await this.resolveTemplateIncludes(content)

      // Inject project-specific context
      content = content.replace('{projectName}', stats.name)
      content = content.replace('{frameworks}', stack.frameworks.join(', ') || 'None detected')
      content = content.replace('{ecosystem}', stats.ecosystem)
    } catch (error) {
      log.debug('Domain agent template not found, generating minimal', {
        name,
        error: getErrorMessage(error),
      })
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

  private configureSkills(agents: SyncAgentInfo[]): { agent: string; skill: string }[] {
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
    ).catch((error) => {
      log.debug('Failed to write skills.json', { error: getErrorMessage(error) })
    })

    return skills
  }

  // ==========================================================================
  // SKILL AUTO-INSTALLATION
  // ==========================================================================

  /**
   * Auto-install skills from skill-mappings.json for generated agents.
   * Reads the mapping, checks which packages are needed, and installs missing ones.
   */
  private async autoInstallSkills(
    agents: SyncAgentInfo[]
  ): Promise<{ name: string; agent: string; status: 'installed' | 'skipped' | 'error' }[]> {
    const results: { name: string; agent: string; status: 'installed' | 'skipped' | 'error' }[] = []

    try {
      // Load skill mappings
      const mappingsPath = path.join(
        __dirname,
        '..',
        '..',
        'templates',
        'config',
        'skill-mappings.json'
      )
      const mappingsContent = await fs.readFile(mappingsPath, 'utf-8')
      const mappings = JSON.parse(mappingsContent)
      const agentToSkillMap = mappings.agentToSkillMap || {}

      // Collect all packages to install, grouped by agent
      const packagesToInstall: { pkg: string; agent: string }[] = []
      for (const agent of agents) {
        const mapping = agentToSkillMap[agent.name]
        if (mapping?.packages) {
          for (const pkg of mapping.packages) {
            packagesToInstall.push({ pkg, agent: agent.name })
          }
        }
      }

      if (packagesToInstall.length === 0) return results

      // Install each package (check if already installed first)
      const skillsDir = path.join(os.homedir(), '.claude', 'skills')
      for (const { pkg, agent } of packagesToInstall) {
        // Extract skill name from package path (e.g., "anthropics/skills/frontend-design" -> "frontend-design")
        const skillName = pkg.split('/').pop() || pkg

        // Check if already installed
        const subdirPath = path.join(skillsDir, skillName, 'SKILL.md')
        const flatPath = path.join(skillsDir, `${skillName}.md`)

        let alreadyInstalled = false
        try {
          await fs.access(subdirPath)
          alreadyInstalled = true
        } catch {
          try {
            await fs.access(flatPath)
            alreadyInstalled = true
          } catch {
            // Not installed
          }
        }

        if (alreadyInstalled) {
          results.push({ name: skillName, agent, status: 'skipped' })
          continue
        }

        // Install via skillInstaller (supports owner/repo format)
        try {
          // Parse package as owner/repo or owner/repo@skill format
          // "anthropics/skills/frontend-design" -> owner=anthropics, repo=skills, skill=frontend-design
          const parts = pkg.split('/')
          let installSource: string
          if (parts.length === 3) {
            // owner/repo/skill -> owner/repo@skill
            installSource = `${parts[0]}/${parts[1]}@${parts[2]}`
          } else {
            installSource = pkg
          }

          const installResult = await skillInstaller.install(installSource)
          if (installResult.installed.length > 0) {
            results.push({ name: skillName, agent, status: 'installed' })
            log.info(`Installed skill: ${skillName} for agent: ${agent}`)
          } else if (installResult.errors.length > 0) {
            results.push({ name: skillName, agent, status: 'error' })
            log.debug(`Failed to install skill ${skillName}`, { errors: installResult.errors })
          } else {
            results.push({ name: skillName, agent, status: 'skipped' })
          }
        } catch (error) {
          results.push({ name: skillName, agent, status: 'error' })
          log.debug(`Skill install error for ${skillName}`, { error: getErrorMessage(error) })
        }
      }
    } catch (error) {
      log.debug('Skill auto-installation failed (non-critical)', { error: getErrorMessage(error) })
    }

    return results
  }

  // ==========================================================================
  // CONTEXT FILE GENERATION
  // ==========================================================================

  private async generateContextFiles(
    git: GitData,
    stats: ProjectStats,
    commands: ProjectCommands,
    agents: SyncAgentInfo[],
    sources?: ContextSources
  ): Promise<string[]> {
    const generator = new ContextFileGenerator({
      projectId: this.projectId!,
      projectPath: this.projectPath,
      globalPath: this.globalPath,
    })

    return generator.generate(git, stats, commands, agents, sources)
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
    } catch (error) {
      log.debug('No existing project.json', {
        path: projectJsonPath,
        error: getErrorMessage(error),
      })
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
      // Staleness tracking (PRJ-120)
      lastSyncCommit: git.recentCommits[0]?.hash || null,
      lastSyncBranch: git.branch,
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
    } catch (error) {
      log.debug('No existing state.json', { path: statePath, error: getErrorMessage(error) })
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
      ...((state.context as Record<string, unknown>) || {}),
      lastSession: dateHelper.getTimestamp(),
      lastAction: 'Synced project',
      nextAction: 'Run `p. task "description"` to start working',
    }

    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')

    // Also generate local .prjct-state.md (PRJ-112)
    try {
      await localStateGenerator.generate(
        this.projectPath,
        state as import('../schemas/state').StateJson
      )
    } catch (error) {
      log.debug('Local state generation failed (optional)', { error: getErrorMessage(error) })
    }
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

    await fs.appendFile(memoryPath, `${JSON.stringify(event)}\n`, 'utf-8')
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
    agents: SyncAgentInfo[],
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
      } catch (error) {
        log.debug('Context file not found for metrics', { file, error: getErrorMessage(error) })
      }
    }

    // Also count agent files
    for (const agent of agents) {
      try {
        const agentPath = path.join(this.globalPath, 'agents', `${agent.name}.md`)
        const content = await fs.readFile(agentPath, 'utf-8')
        filteredChars += content.length
      } catch (error) {
        log.debug('Agent file not found for metrics', {
          agent: agent.name,
          error: getErrorMessage(error),
        })
      }
    }

    const filteredSize = Math.floor(filteredChars / CHARS_PER_TOKEN)

    // Estimate original size (what it would take without prjct)
    // Conservative estimate: avg 500 tokens per source file
    // Plus overhead for manually creating context
    const avgTokensPerFile = 500
    const originalSize = stats.fileCount * avgTokensPerFile

    // Calculate compression rate
    const compressionRate =
      originalSize > 0 ? Math.max(0, (originalSize - filteredSize) / originalSize) : 0

    // Record to storage
    try {
      await metricsStorage.recordSync(this.projectId!, {
        originalSize,
        filteredSize,
        duration,
        isWatch: false,
        agents: agents.filter((a) => a.type === 'domain').map((a) => a.name),
      })
    } catch (error) {
      log.debug('Failed to record sync metrics', { error: getErrorMessage(error) })
    }

    return {
      duration,
      originalSize,
      filteredSize,
      compressionRate,
    }
  }

  // ==========================================================================
  // DRAFT ANALYSIS (PRJ-263)
  // ==========================================================================

  /**
   * Save sync results as a draft analysis.
   * Preserves existing sealed analysis — only the draft is overwritten.
   */
  private async saveDraftAnalysis(
    git: GitData,
    stats: ProjectStats,
    _stack: StackDetection
  ): Promise<void> {
    try {
      const commitHash = git.recentCommits[0]?.hash || null

      await analysisStorage.saveDraft(this.projectId!, {
        projectId: this.projectId!,
        languages: stats.languages,
        frameworks: stats.frameworks,
        configFiles: [],
        fileCount: stats.fileCount,
        patterns: [],
        antiPatterns: [],
        analyzedAt: dateHelper.getTimestamp(),
        status: 'draft',
        commitHash: commitHash ?? undefined,
      })
    } catch (error) {
      log.debug('Failed to save draft analysis (non-critical)', { error: getErrorMessage(error) })
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.projectPath, filename))
      return true
    } catch (error) {
      log.debug('File not found', { filename, error: getErrorMessage(error) })
      return false
    }
  }

  private async getCliVersion(): Promise<string> {
    try {
      // Try to read from package.json in the module
      const pkgPath = path.join(__dirname, '..', '..', 'package.json')
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'))
      return pkg.version || '0.0.0'
    } catch (error) {
      log.debug('Failed to read CLI version', { error: getErrorMessage(error) })
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

  private emptyCommands(): ProjectCommands {
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
export { SyncService }
export type { ProjectSyncResult as SyncResult } from '../types'
