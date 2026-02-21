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
 * Analysis/stats functions extracted to ./sync-analyzer.ts
 * Agent generation functions extracted to ./sync-agent-gen.ts
 *
 * @version 2.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { SemanticMemories } from '../agentic/memory-system'
import { indexProject as indexBm25 } from '../domain/bm25'
import { affectedDomains, propagateChanges } from '../domain/change-propagator'
import { detectChanges, hasHashRegistry, saveHashes } from '../domain/file-hasher'
import { indexCoChanges } from '../domain/git-cochange'
import { indexImports } from '../domain/import-graph'
import { getErrorMessage } from '../errors'
import { detectCodex } from '../infrastructure/ai-provider'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { verifyCodexPRouterReady } from '../infrastructure/setup'
import { analysisStorage } from '../storage/analysis-storage'
import { archiveStorage } from '../storage/archive-storage'
import { prjctDb } from '../storage/database'
import { ideasStorage } from '../storage/ideas-storage'
import { metricsStorage } from '../storage/metrics-storage'
import { migrateJsonToSqlite, sweepLegacyJson } from '../storage/migrate-json'
import { queueStorage } from '../storage/queue-storage'
import { shippedStorage } from '../storage/shipped-storage'
import { stateStorage } from '../storage/state-storage'
import { generateAIToolContexts } from '../tools/ai/generator'
import { extractLearningsFromDB } from '../tools/ai/learnings-extractor'
import { DEFAULT_AI_TOOLS, detectInstalledTools, resolveToolIds } from '../tools/ai/registry'
import type { AIToolProjectContext as ProjectContext } from '../types/context-tools'
import type {
  GitData,
  IncrementalInfo,
  ProjectCommands,
  ProjectStats,
  ProjectSyncResult,
  SyncAgentInfo,
  SyncMetrics,
  SyncOptions,
} from '../types/project-sync'
import type { Context7Status } from '../types/services.js'
import type { StackDetection } from '../types/stack'
import type { VerificationReport } from '../types/sync-verifier'
import * as dateHelper from '../utils/date-helper'
import log from '../utils/logger'
import { outcomeMemoryLearner } from '../workflows/outcome-learner'
import { outcomeStorage } from '../workflows/outcome-storage'
import context7Service from './context7-service'
import { localStateGenerator } from './local-state-generator'
import { memoryService } from './memory-service'
import patternExtractor from './pattern-extractor'
import {
  autoInstallSkills,
  configureSkills,
  generateAgents,
  loadExistingAgents,
} from './sync-agent-gen'
import { analyzeGit, buildSources, detectCommands, detectStack, gatherStats } from './sync-analyzer'
import { syncVerifier } from './sync-verifier'

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
    // Default behavior: detected CLI tools (claude/codex) + detected IDE tools
    let aiToolIds: string[]
    if (!options.aiTools || options.aiTools.length === 0) {
      const detectedTools = await detectInstalledTools(projectPath)
      const cliTools = detectedTools.filter((id) => DEFAULT_AI_TOOLS.includes(id) || id === 'codex')
      const ideTools = detectedTools.filter(
        (id) => !DEFAULT_AI_TOOLS.includes(id) && id !== 'codex'
      )

      // Keep backward-compatible fallback to Claude when no CLI tools are detected
      aiToolIds = [...(cliTools.length > 0 ? cliTools : DEFAULT_AI_TOOLS), ...ideTools]
      aiToolIds = Array.from(new Set(aiToolIds))
    } else if (options.aiTools[0] === 'auto') {
      aiToolIds = await detectInstalledTools(projectPath)
      if (aiToolIds.length === 0) aiToolIds = ['claude'] // fallback
    } else if (options.aiTools[0] === 'all') {
      aiToolIds = await resolveToolIds('all', projectPath)
    } else {
      aiToolIds = options.aiTools
    }

    let context7Status: Context7Status = {
      installed: false,
      verified: false,
      configPath: '',
      message: '',
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
          context7: { installed: false, verified: false },
          error: 'No prjct project. Run p. init first.',
        }
      }

      this.globalPath = pathManager.getGlobalProjectPath(this.projectId)
      this.cliVersion = await this.getCliVersion()

      // Codex router check — non-blocking, sync should succeed for other providers
      const codexDetection = await detectCodex()
      if (codexDetection.installed) {
        const codexRouter = await verifyCodexPRouterReady({ autoRepair: true })
        if (!codexRouter.verified) {
          log.warn(`Codex p. router not ready: ${codexRouter.message || 'verification failed'}`)
        }
      }

      // Context7 is mandatory for deterministic coding workflows
      try {
        context7Status = await context7Service.ensureReady()
      } catch (error) {
        return {
          success: false,
          projectId: this.projectId,
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
          context7: {
            installed: context7Status.installed,
            verified: false,
            message: getErrorMessage(error),
          },
          error: `Context7 MCP is required but not ready: ${getErrorMessage(error)}. Run 'prjct start' to repair.`,
        }
      }

      // 2. Ensure directories exist (non-blocking)
      const ensureDirsPromise = this.ensureDirectories()

      // 2b. Auto-migrate JSON → SQLite (idempotent, skips if already done)
      await ensureDirsPromise
      await migrateJsonToSqlite(this.projectId)

      // 2c. Sweep leftover JSON files → import to SQLite → delete
      // Runs every sync to catch ghosts from old code or failed migrations
      try {
        const swept = await sweepLegacyJson(this.projectId)
        if (swept > 0) {
          log.info('Swept legacy JSON files into SQLite', { swept })
        }
      } catch (error) {
        log.debug('Legacy JSON sweep failed (non-critical)', { error: getErrorMessage(error) })
      }

      // 3. Gather all data IN PARALLEL (30-50% speedup)
      // These operations are independent and can run concurrently
      const [git, stats, commands, stack] = await Promise.all([
        analyzeGit(this.projectPath),
        gatherStats(this.projectPath),
        detectCommands(this.projectPath),
        detectStack(this.projectPath),
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
            indexBm25(this.projectPath, this.projectId!),
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
      // Load task feedback for agent generation (PRJ-272)
      let taskFeedbackContext:
        | {
            patternsDiscovered: string[]
            knownGotchas: string[]
            agentAccuracy: Array<{ agent: string; rating: string; note?: string }>
          }
        | undefined
      if (shouldRegenerateAgents) {
        try {
          const feedback = await stateStorage.getAggregatedFeedback(this.projectId!)
          if (
            feedback.patternsDiscovered.length > 0 ||
            feedback.knownGotchas.length > 0 ||
            feedback.agentAccuracy.length > 0
          ) {
            taskFeedbackContext = feedback
          }
        } catch {
          // Feedback loading failure should not block agent generation
        }
      }

      // Skip agent regeneration if nothing structural changed
      const agents = shouldRegenerateAgents
        ? await generateAgents(this.globalPath, stack, stats, taskFeedbackContext)
        : await loadExistingAgents(this.globalPath)
      const skills = configureSkills(agents, this.projectId!, this.globalPath)
      const skillsInstalled = shouldRegenerateAgents ? await autoInstallSkills(agents) : []
      const sources = buildSources(stats, commands)
      const contextFiles: string[] = []

      // 4b. Load analysis data for AI tool context enrichment
      let analysisData: ProjectContext['analysis']
      try {
        const analysis = await analysisStorage.getActive(this.projectId)
        if (analysis?.patterns?.length || analysis?.antiPatterns?.length) {
          analysisData = {
            patterns: analysis.patterns ?? [],
            antiPatterns: analysis.antiPatterns ?? [],
            packageManager: analysis.packageManager,
            sourceDir: analysis.sourceDir,
            testDir: analysis.testDir,
          }
        }
      } catch {
        /* non-blocking */
      }

      // 4c. Load learnings from SQLite - Progressive Context
      let learnings: ProjectContext['learnings']
      try {
        learnings = await extractLearningsFromDB(this.projectId)
      } catch {
        // Learnings extraction is optional - don't block on failure
      }

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
        analysis: analysisData,
        learnings, // Learnings from SQLite
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
        this.saveDraftAnalysis(git, stats, stack, context7Status.verified),
      ])

      const activeAnalysis = await analysisStorage.getActive(this.projectId)
      const analysisSummary = {
        patterns: activeAnalysis?.patterns?.length || 0,
        antiPatterns: activeAnalysis?.antiPatterns?.length || 0,
        criticalAntiPatterns:
          activeAnalysis?.antiPatterns?.filter((a) => a.severity === 'high').length || 0,
      }

      // 9. Record metrics for value dashboard
      const duration = Date.now() - startTime
      const syncMetrics = await this.recordSyncMetrics(stats, contextFiles, agents, duration)

      // 9b. Archive stale data (PRJ-267)
      await this.archiveStaleData()

      // 9c. Auto-learn from task history → memory (PRJ-283)
      await this.autoLearnFromHistory()

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
        context7: {
          installed: context7Status.installed,
          verified: context7Status.verified,
          message: context7Status.message,
        },
        analysisSummary,
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
        context7: {
          installed: context7Status.installed,
          verified: context7Status.verified,
          message: context7Status.message,
        },
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
  // PROJECT.JSON UPDATE
  // ==========================================================================

  private async updateProjectJson(git: GitData, stats: ProjectStats): Promise<void> {
    // Read existing from SQLite
    const existing: Record<string, unknown> =
      prjctDb.getDoc<Record<string, unknown>>(this.projectId!, 'project') || {}

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

    prjctDb.setDoc(this.projectId!, 'project', updated)
  }

  // ==========================================================================
  // STATE.JSON UPDATE
  // ==========================================================================

  private async updateStateJson(stats: ProjectStats, stack: StackDetection): Promise<void> {
    // Read existing from SQLite via stateStorage
    const stateData = await stateStorage.read(this.projectId!)
    const state: Record<string, unknown> = { ...stateData }

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

    await stateStorage.write(this.projectId!, state as import('../schemas/state').StateJson)

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
    prjctDb.appendEvent(this.projectId!, 'sync', {
      branch: git.branch,
      uncommitted: git.hasChanges,
      fileCount: stats.fileCount,
      commitCount: git.commits,
    })
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
   * Incorporates task feedback from completed tasks (PRJ-272).
   */
  private async saveDraftAnalysis(
    git: GitData,
    stats: ProjectStats,
    stack: StackDetection,
    context7Verified: boolean
  ): Promise<void> {
    try {
      const commitHash = git.recentCommits[0]?.hash || null

      // Load aggregated feedback from completed tasks (PRJ-272)
      let patterns: Array<{
        name: string
        description: string
        location?: string
        severity?: 'low' | 'medium' | 'high'
        language?: string
        framework?: string
        source?: 'baseline' | 'repo' | 'context7' | 'feedback'
        confidence?: number
      }> = []
      let antiPatterns: Array<{
        issue: string
        file: string
        suggestion: string
        severity?: 'low' | 'medium' | 'high'
        language?: string
        framework?: string
        source?: 'baseline' | 'repo' | 'context7' | 'feedback'
        confidence?: number
      }> = []
      let feedback:
        | {
            patternsDiscovered: string[]
            knownGotchas: string[]
          }
        | undefined
      try {
        feedback = await stateStorage.getAggregatedFeedback(this.projectId!)

        // Convert discovered patterns to CodePattern objects
        if (feedback.patternsDiscovered.length > 0) {
          patterns = feedback.patternsDiscovered.map((p) => ({
            name: p,
            description: `Discovered during task execution: ${p}`,
            source: 'feedback',
            confidence: 0.74,
          }))
        }

        // Convert known gotchas (recurring issues) to AntiPattern objects
        if (feedback.knownGotchas.length > 0) {
          antiPatterns = feedback.knownGotchas.map((g) => ({
            issue: g,
            file: 'multiple',
            suggestion: `Recurring issue reported across tasks: ${g}`,
            source: 'feedback',
            severity: 'medium',
            confidence: 0.7,
          }))
        }
      } catch {
        // Feedback aggregation failure should not block analysis
      }

      const extracted = await patternExtractor.extract({
        projectId: this.projectId!,
        projectPath: this.projectPath,
        languages: stats.languages,
        frameworks: Array.from(new Set([...stats.frameworks, ...stack.frameworks])),
        feedback,
        context7Verified,
      })

      patterns = extracted.patterns
      antiPatterns = extracted.antiPatterns

      await analysisStorage.saveDraft(this.projectId!, {
        projectId: this.projectId!,
        languages: stats.languages,
        frameworks: stats.frameworks,
        configFiles: [],
        fileCount: stats.fileCount,
        patterns,
        antiPatterns,
        analyzedAt: dateHelper.getTimestamp(),
        status: 'draft',
        commitHash: commitHash ?? undefined,
      })
    } catch (error) {
      log.debug('Failed to save draft analysis (non-critical)', { error: getErrorMessage(error) })
    }
  }

  // ==========================================================================
  // ARCHIVAL (PRJ-267)
  // ==========================================================================

  /**
   * Archive stale data across all storage types.
   * Runs during sync to keep active storage lean.
   */
  private async archiveStaleData(): Promise<void> {
    if (!this.projectId) return

    try {
      const [shipped, dormant, staleQueue, stalePaused, memoryCapped] = await Promise.all([
        shippedStorage.archiveOldShipped(this.projectId).catch(() => 0),
        ideasStorage.markDormantIdeas(this.projectId).catch(() => 0),
        queueStorage.removeStaleCompleted(this.projectId).catch(() => 0),
        stateStorage.archiveStalePausedTasks(this.projectId).catch(() => []),
        memoryService.capEntries(this.projectId).catch(() => 0),
      ])

      const totalArchived =
        shipped + dormant + staleQueue + (stalePaused as unknown[]).length + memoryCapped

      if (totalArchived > 0) {
        log.info('Archived stale data', {
          shipped,
          dormant,
          staleQueue,
          stalePaused: (stalePaused as unknown[]).length,
          memoryCapped,
          total: totalArchived,
        })

        // Record archive stats
        const stats = archiveStorage.getStats(this.projectId)
        log.debug('Archive stats', stats)
      }
    } catch (error) {
      log.debug('Archival failed (non-critical)', { error: getErrorMessage(error) })
    }
  }

  /**
   * Auto-learn from task history and outcomes → inject into memory (PRJ-283).
   * Extracts patterns from completed tasks and injects high-confidence
   * learnings into the semantic memory system.
   */
  private async autoLearnFromHistory(): Promise<void> {
    if (!this.projectId) return

    try {
      const taskHistory = await stateStorage.getTaskHistory(this.projectId)
      if (taskHistory.length === 0) return

      const semanticMemories = new SemanticMemories()
      const result = await outcomeMemoryLearner.learnFromTaskHistory(
        this.projectId,
        taskHistory,
        semanticMemories
      )

      // Also learn from feature outcomes if available
      try {
        const outcomes = await outcomeStorage.getFeatureOutcomes(this.projectId)
        if (outcomes.length > 0) {
          await outcomeMemoryLearner.learnFromOutcomes(this.projectId, outcomes, semanticMemories)
        }
      } catch {
        // Outcome storage may not exist yet
      }

      if (result.memoriesInjected > 0) {
        log.info('Auto-learned from task history', {
          patternsExtracted: result.patternsExtracted,
          memoriesInjected: result.memoriesInjected,
          patternsSkipped: result.patternsSkipped,
        })
      }
    } catch (error) {
      log.debug('Auto-learning failed (non-critical)', { error: getErrorMessage(error) })
    }
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

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
export type { ProjectSyncResult as SyncResult } from '../types/project-sync'
