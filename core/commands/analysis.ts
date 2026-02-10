/**
 * Analysis Commands: analyze, sync, and related helpers
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prompts from 'prompts'
import { generateContext } from '../agentic/context-generator'
import memorySystem from '../agentic/memory-system'
import analyzer from '../domain/analyzer'
import commandInstaller from '../infrastructure/command-installer'
import { formatCost } from '../schemas/metrics'
import { createStalenessChecker, syncService } from '../services'
import { formatDiffPreview, formatFullDiff, generateSyncDiff } from '../services/diff-generator'
import { analysisStorage } from '../storage/analysis-storage'
import { metricsStorage } from '../storage/metrics-storage'
import type { AnalyzeOptions, CommandResult, ProjectContext } from '../types'
import { getErrorMessage } from '../types/fs'
import out from '../utils/output'
import {
  formatDuration,
  formatTokens,
  generateAnalysisSummary,
  generateSparkline,
  generateStatsMarkdown,
  getSessionActivity,
  showSyncResult,
} from './analysis-helpers'
import {
  configManager,
  contextBuilder,
  dateHelper,
  PrjctCommandsBase,
  pathManager,
  toolRegistry,
} from './base'

export class AnalysisCommands extends PrjctCommandsBase {
  /**
   * /p:analyze - Analyze repository and generate summary
   */
  async analyze(
    options: AnalyzeOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      await this.initializeAgent()

      console.log('🔍 Analyzing repository...\n')

      analyzer.init(projectPath)

      const context = (await contextBuilder.build(projectPath, options)) as ProjectContext

      const analysisData = {
        packageJson: await analyzer.readPackageJson(),
        cargoToml: await analyzer.readCargoToml(),
        goMod: await analyzer.readGoMod(),
        requirements: await analyzer.readRequirements(),
        directories: await analyzer.listDirectories(),
        fileCount: await analyzer.countFiles(),
        gitStats: await analyzer.getGitStats(),
        gitLog: await analyzer.getGitLog(20),
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

      const summary = generateAnalysisSummary(analysisData, projectPath)

      const projectId = await configManager.getProjectId(projectPath)
      const summaryPath =
        context.paths.analysis || pathManager.getFilePath(projectId!, 'analysis', 'repo-summary.md')

      await toolRegistry.get('Write')!(summaryPath, summary)

      await this.logToMemory(projectPath, 'repository_analyzed', {
        timestamp: dateHelper.getTimestamp(),
        fileCount: analysisData.fileCount,
        gitCommits: analysisData.gitStats.totalCommits,
      })

      await generateContext(projectId!, projectPath)

      const aiProvider = require('../infrastructure/ai-provider')
      const activeProvider = await aiProvider.getActiveProvider()

      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log(`📝 Updated ${pathManager.getDisplayPath(globalConfigResult.path!)}`)
      }

      console.log('✅ Analysis complete!\n')
      console.log('📄 Full report: analysis/repo-summary.md')
      console.log(`📝 Context: ~/.prjct-cli/projects/${projectId}/${activeProvider.contextFile}\n`)
      console.log('Next steps:')
      console.log('• /p:sync → Generate agents based on stack')
      console.log('• /p:feature → Add a new feature')

      return {
        success: true,
        summaryPath,
        data: analysisData,
      }
    } catch (error) {
      console.error('❌ Error:', getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:sync - Comprehensive project sync with diff preview
   *
   * Uses syncService to do ALL operations in one TypeScript execution:
   * - Git analysis
   * - Project stats
   * - Agent generation
   * - Context file generation
   * - Skill configuration
   * - State updates
   *
   * Options:
   * - --preview: Show what would change without applying
   * - --yes: Skip confirmation prompt
   * - --json: Output structured JSON for LLM consumption (non-interactive)
   *
   * When running in non-TTY mode (e.g., from an LLM), the CLI outputs
   * structured JSON instead of interactive prompts. The LLM should:
   * 1. Run `prjct sync --preview --json` to get diff data
   * 2. Show diff to user and use AskUserQuestion for confirmation
   * 3. Run `prjct sync --yes` if user confirms
   *
   * This eliminates the need for Claude to make 50+ individual tool calls.
   *
   * @see PRJ-125
   */
  async sync(
    projectPath: string = process.cwd(),
    options: {
      aiTools?: string[]
      preview?: boolean
      yes?: boolean
      json?: boolean
      package?: string
      full?: boolean
    } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      const globalPath = pathManager.getGlobalProjectPath(projectId)
      const startTime = Date.now()

      // Handle package-specific sync for monorepos
      if (options.package) {
        const monoInfo = await pathManager.detectMonorepo(projectPath)
        if (!monoInfo.isMonorepo) {
          return {
            success: false,
            error: 'Not a monorepo. --package flag only works in monorepos.',
          }
        }

        const pkg = monoInfo.packages.find(
          (p) => p.name === options.package || p.relativePath === options.package
        )
        if (!pkg) {
          const available = monoInfo.packages.map((p) => p.name).join(', ')
          return {
            success: false,
            error: `Package "${options.package}" not found. Available: ${available}`,
          }
        }

        // Sync only the specified package
        const result = await syncService.sync(projectPath, {
          aiTools: options.aiTools,
          packagePath: pkg.path,
          packageName: pkg.name,
        })

        if (options.json) {
          console.log(
            JSON.stringify({ success: result.success, package: pkg.name, path: pkg.relativePath })
          )
        } else {
          out.done(`Synced package: ${pkg.name}`)
        }

        return { success: result.success }
      }

      // Generate diff preview if we have existing context
      const claudeMdPath = path.join(globalPath, 'context', 'CLAUDE.md')
      let existingContent: string | null = null
      try {
        existingContent = await fs.readFile(claudeMdPath, 'utf-8')
      } catch {
        // No existing file - first sync
      }

      // Detect non-interactive mode (LLM or piped input)
      const isNonInteractive = !process.stdin.isTTY || options.json

      // For preview mode or when we have existing content, show diff first
      if (existingContent && !options.yes) {
        if (!isNonInteractive) {
          out.spin('Analyzing changes...')
        }

        // Do a dry-run sync to see what would change
        const result = await syncService.sync(projectPath, {
          aiTools: options.aiTools,
          full: options.full,
        })

        if (!result.success) {
          if (isNonInteractive) {
            console.log(JSON.stringify({ success: false, error: result.error || 'Sync failed' }))
            return { success: false, error: result.error }
          }
          out.fail(result.error || 'Sync failed')
          return { success: false, error: result.error }
        }

        // Read the newly generated CLAUDE.md
        let newContent: string
        try {
          newContent = await fs.readFile(claudeMdPath, 'utf-8')
        } catch {
          newContent = ''
        }

        // Generate diff
        const diff = generateSyncDiff(existingContent, newContent)

        if (!isNonInteractive) {
          out.stop()
        }

        if (!diff.hasChanges) {
          if (isNonInteractive) {
            console.log(
              JSON.stringify({
                success: true,
                action: 'no_changes',
                message: 'No changes detected (context is up to date)',
              })
            )
            return { success: true, message: 'No changes' }
          }
          out.done('No changes detected (context is up to date)')
          return { success: true, message: 'No changes' }
        }

        // Helper to restore original CLAUDE.md (undo sync's write)
        const restoreOriginal = async () => {
          if (existingContent != null) {
            await fs.writeFile(claudeMdPath, existingContent, 'utf-8')
          }
        }

        // Non-interactive mode: return JSON for LLM to handle
        if (isNonInteractive) {
          // Restore original — LLM will call `prjct sync --yes` to apply
          await restoreOriginal()

          // Build a plain-text diff summary for LLM to show user
          const diffSummary = {
            added: diff.added.map((s) => ({ name: s.name, lineCount: s.lineCount })),
            modified: diff.modified.map((s) => ({ name: s.name, lineCount: s.lineCount })),
            removed: diff.removed.map((s) => ({ name: s.name, lineCount: s.lineCount })),
            preserved: diff.preserved,
            tokensBefore: diff.tokensBefore,
            tokensAfter: diff.tokensAfter,
            tokenDelta: diff.tokenDelta,
          }

          console.log(
            JSON.stringify({
              success: true,
              action: 'confirm_required',
              message: 'Changes detected. Confirmation required to apply.',
              diff: diffSummary,
              fullDiff: options.preview
                ? {
                    added: diff.added,
                    modified: diff.modified,
                    removed: diff.removed,
                  }
                : undefined,
              hint: 'Run `prjct sync --yes` to apply changes',
            })
          )

          return {
            success: true,
            isPreview: true,
            diff,
            message: 'Preview complete (awaiting confirmation)',
          }
        }

        // Show diff preview (interactive mode)
        console.log(formatDiffPreview(diff))

        // Preview-only mode (--preview / --dry-run) - restore and don't apply
        if (options.preview) {
          await restoreOriginal()
          return {
            success: true,
            isPreview: true,
            diff,
            message: 'Preview complete (no changes applied)',
          }
        }

        // Interactive confirmation (TTY mode only)
        const response = await prompts({
          type: 'select',
          name: 'action',
          message: 'Apply these changes?',
          choices: [
            { title: 'Yes, apply changes', value: 'apply' },
            { title: 'No, cancel', value: 'cancel' },
            { title: 'Show full diff', value: 'diff' },
          ],
        })

        if (response.action === 'cancel' || !response.action) {
          await restoreOriginal()
          out.warn('Sync cancelled — no changes applied')
          return { success: false, message: 'Cancelled by user' }
        }

        if (response.action === 'diff') {
          console.log(`\n${formatFullDiff(diff)}`)
          const confirm = await prompts({
            type: 'confirm',
            name: 'apply',
            message: 'Apply these changes?',
            initial: true,
          })
          if (!confirm.apply) {
            await restoreOriginal()
            out.warn('Sync cancelled — no changes applied')
            return { success: false, message: 'Cancelled by user' }
          }
        }

        // User approved — changes already applied by sync
        out.done('Changes applied')
        return showSyncResult(result, startTime)
      }

      // First sync or --yes flag - proceed directly
      out.spin('Syncing project...')

      // Use syncService to do EVERYTHING in one call
      const result = await syncService.sync(projectPath, {
        aiTools: options.aiTools,
        full: options.full,
      })

      if (!result.success) {
        out.fail(result.error || 'Sync failed')
        return { success: false, error: result.error }
      }

      out.stop()
      return showSyncResult(result, startTime)
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:stats - Session summary and value dashboard
   *
   * Displays:
   * - Session activity (tasks completed, features shipped today)
   * - Patterns learned (from memory system)
   * - Token savings (total, compression rate, estimated cost)
   * - Performance metrics (sync count, avg duration)
   * - Agent usage breakdown
   * - 30-day trend visualization
   *
   * @see PRJ-89
   */
  async stats(
    projectPath: string = process.cwd(),
    options: { json?: boolean; export?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        return { success: false, error: 'No project ID found' }
      }

      // Get metrics summary
      const summary = await metricsStorage.getSummary(projectId)
      const dailyStats = await metricsStorage.getDailyStats(projectId, 30)

      // Get session activity (today's events)
      const sessionActivity = await getSessionActivity(projectId)

      // Get learned patterns
      const patternsSummary = await memorySystem.getPatternsSummary(projectId)

      // JSON output mode
      if (options.json) {
        const jsonOutput = {
          session: sessionActivity,
          patterns: patternsSummary,
          totalTokensSaved: summary.totalTokensSaved,
          estimatedCostSaved: summary.estimatedCostSaved,
          compressionRate: summary.compressionRate,
          syncCount: summary.syncCount,
          avgSyncDuration: summary.avgSyncDuration,
          topAgents: summary.topAgents,
          last30DaysTokens: summary.last30DaysTokens,
          trend: summary.trend,
          dailyStats,
        }
        console.log(JSON.stringify(jsonOutput, null, 2))
        return { success: true, data: jsonOutput }
      }

      // Get project info for header
      const globalPath = pathManager.getGlobalProjectPath(projectId)
      let projectName = 'Unknown'
      try {
        const projectJson = JSON.parse(
          await fs.readFile(path.join(globalPath, 'project.json'), 'utf-8')
        )
        projectName = projectJson.name || 'Unknown'
      } catch {
        // Use fallback
      }

      // Determine first sync date
      const metricsData = await metricsStorage.read(projectId)
      const firstSyncDate = metricsData.firstSync
        ? new Date(metricsData.firstSync).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'N/A'

      // ASCII Dashboard
      console.log('')
      console.log('╭─────────────────────────────────────────────────╮')
      console.log('│  📊 prjct-cli Stats Dashboard                   │')
      console.log(
        `│  Project: ${projectName.padEnd(20).slice(0, 20)} | Since: ${firstSyncDate.padEnd(12).slice(0, 12)} │`
      )
      console.log('╰─────────────────────────────────────────────────╯')
      console.log('')

      // Session Activity Section (PRJ-89)
      console.log("🎯 TODAY'S ACTIVITY")
      if (sessionActivity.sessionDuration) {
        console.log(`   Duration:        ${sessionActivity.sessionDuration}`)
      }
      console.log(`   Tasks completed: ${sessionActivity.tasksCompleted}`)
      console.log(`   Features shipped: ${sessionActivity.featuresShipped}`)
      if (sessionActivity.agentsUsed.length > 0) {
        const agentStr = sessionActivity.agentsUsed
          .slice(0, 3)
          .map((a) => `${a.name} (${a.count}×)`)
          .join(', ')
        console.log(`   Agents used:     ${agentStr}`)
      }
      console.log('')

      // Learned Patterns Section (PRJ-89)
      if (patternsSummary.decisions > 0 || patternsSummary.preferences > 0) {
        console.log('🧠 PATTERNS LEARNED')
        console.log(
          `   Decisions:    ${patternsSummary.learnedDecisions} confirmed (${patternsSummary.decisions} total)`
        )
        console.log(`   Preferences:  ${patternsSummary.preferences} saved`)
        console.log(`   Workflows:    ${patternsSummary.workflows} tracked`)
        console.log('')
      }

      // Token Savings Section
      console.log('💰 TOKEN SAVINGS')
      console.log(`   Total saved:     ${formatTokens(summary.totalTokensSaved)} tokens`)
      console.log(
        `   Compression:     ${(summary.compressionRate * 100).toFixed(0)}% average reduction`
      )
      console.log(`   Estimated cost:  ${formatCost(summary.estimatedCostSaved)} saved`)
      console.log('')

      // Performance Section
      console.log('⚡ PERFORMANCE')
      console.log(`   Syncs completed: ${summary.syncCount.toLocaleString()}`)
      console.log(`   Avg sync time:   ${formatDuration(summary.avgSyncDuration)}`)
      console.log('')

      // Agent Usage Section
      if (summary.topAgents.length > 0) {
        console.log('🤖 AGENT USAGE (all time)')
        const totalUsage = summary.topAgents.reduce((sum, a) => sum + a.usageCount, 0)
        for (const agent of summary.topAgents) {
          const pct = totalUsage > 0 ? ((agent.usageCount / totalUsage) * 100).toFixed(0) : 0
          console.log(`   ${agent.agentName.padEnd(12)}: ${pct}% (${agent.usageCount} uses)`)
        }
        console.log('')
      }

      // 30-Day Trend Section
      if (dailyStats.length > 0) {
        console.log('📈 TREND (last 30 days)')
        const sparkline = generateSparkline(dailyStats)
        console.log(`   ${sparkline} ${formatTokens(summary.last30DaysTokens)} tokens saved`)

        if (summary.trend !== 0) {
          const trendIcon = summary.trend > 0 ? '↑' : '↓'
          const trendSign = summary.trend > 0 ? '+' : ''
          console.log(
            `   ${trendIcon} ${trendSign}${summary.trend.toFixed(0)}% vs previous 30 days`
          )
        }
        console.log('')
      }

      // Footer
      console.log('───────────────────────────────────────────────────')
      console.log(`Export: prjct stats --export > stats.md`)
      console.log('')

      // Export mode - return markdown
      if (options.export) {
        const markdown = generateStatsMarkdown(
          summary,
          dailyStats,
          projectName,
          firstSyncDate,
          sessionActivity,
          patternsSummary
        )
        console.log(markdown)
        return { success: true, data: { markdown } }
      }

      return {
        success: true,
        data: { ...summary, session: sessionActivity, patterns: patternsSummary },
      }
    } catch (error) {
      console.error('❌ Error:', getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:status - Check if CLAUDE.md context is stale
   *
   * Uses git commit history to detect when significant changes
   * have occurred since the last sync.
   *
   * @see PRJ-120
   */
  async status(
    projectPath: string = process.cwd(),
    options: { json?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No project ID found' }))
        } else {
          out.fail('No project ID found')
        }
        return { success: false, error: 'No project ID found' }
      }

      // Create staleness checker and run check
      const checker = createStalenessChecker(projectPath)
      const status = await checker.check(projectId)

      // Get session info
      const sessionInfo = await checker.getSessionInfo(projectId)

      // Get analysis status (PRJ-263)
      const analysisStatus = await analysisStorage.getStatus(projectId)

      // JSON output mode
      if (options.json) {
        console.log(
          JSON.stringify({
            success: true,
            ...status,
            session: sessionInfo,
            analysis: analysisStatus,
          })
        )
        return {
          success: true,
          data: { ...status, session: sessionInfo, analysis: analysisStatus },
        }
      }

      // Human-readable output
      console.log('')
      console.log(checker.formatStatus(status))
      console.log('')
      console.log(checker.formatSessionInfo(sessionInfo))

      // Show analysis status (PRJ-263)
      if (analysisStatus.hasSealed || analysisStatus.hasDraft) {
        console.log('')
        console.log('Analysis:')
        if (analysisStatus.hasSealed) {
          console.log(`  Sealed: ${analysisStatus.sealedCommit} (${analysisStatus.sealedAt})`)
        }
        if (analysisStatus.hasDraft) {
          console.log(`  Draft: ${analysisStatus.draftCommit} (pending seal)`)
        }
      }

      console.log('')

      return { success: true, data: { ...status, session: sessionInfo, analysis: analysisStatus } }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else {
        out.fail(errMsg)
      }
      return { success: false, error: errMsg }
    }
  }

  /**
   * prjct seal - Seal the current draft analysis (PRJ-263)
   *
   * Locks the current draft with a SHA-256 signature.
   * Only sealed analysis feeds task context.
   */
  async seal(
    projectPath: string = process.cwd(),
    options: { json?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No project ID found' }))
        }
        return { success: false, error: 'No project ID found' }
      }

      const result = await analysisStorage.seal(projectId)

      if (options.json) {
        console.log(
          JSON.stringify({
            success: result.success,
            signature: result.signature,
            error: result.error,
          })
        )
        return { success: result.success, error: result.error }
      }

      if (!result.success) {
        out.fail(result.error || 'Seal failed')
        return { success: false, error: result.error }
      }

      out.done('Analysis sealed')
      console.log(`  Signature: ${result.signature?.substring(0, 16)}...`)
      console.log('')

      return { success: true, data: { signature: result.signature } }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else {
        out.fail(errMsg)
      }
      return { success: false, error: errMsg }
    }
  }

  /**
   * prjct verify - Verify integrity of sealed analysis (PRJ-263)
   *
   * Modes:
   * - Default: Cryptographic verification (signature check)
   * - --semantic: Semantic verification (data accuracy check, PRJ-270)
   */
  async verify(
    projectPath: string = process.cwd(),
    options: { json?: boolean; semantic?: boolean } = {}
  ): Promise<CommandResult> {
    // Semantic verification mode (PRJ-270)
    if (options.semantic) {
      return this.semanticVerify(projectPath, options)
    }

    // Default: Cryptographic verification (PRJ-263)
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        return { success: false, error: 'No project ID found' }
      }

      const result = await analysisStorage.verify(projectId)

      if (options.json) {
        console.log(JSON.stringify(result))
        return { success: result.valid }
      }

      if (result.valid) {
        out.done(result.message)
      } else {
        out.fail(result.message)
      }
      console.log('')

      return { success: result.valid, data: result }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      out.fail(errMsg)
      return { success: false, error: errMsg }
    }
  }

  /**
   * prjct analysis verify --semantic - Semantic verification of analysis results (PRJ-270)
   *
   * Validates that analysis data matches actual project state:
   * - Frameworks exist in package.json
   * - Languages match file extensions
   * - Pattern locations reference real files
   * - File count is accurate
   * - Anti-pattern files exist
   */
  async semanticVerify(
    projectPath: string = process.cwd(),
    options: { json?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'No project ID found' }))
        } else {
          out.fail('No project ID found')
        }
        return { success: false, error: 'No project ID found' }
      }

      // Get project path from project.json
      const globalPath = pathManager.getGlobalProjectPath(projectId)
      let repoPath = projectPath
      try {
        const projectJson = JSON.parse(
          await fs.readFile(path.join(globalPath, 'project.json'), 'utf-8')
        )
        repoPath = projectJson.repoPath || projectPath
      } catch {
        // Use fallback projectPath
      }

      // Run semantic verification
      const result = await analysisStorage.semanticVerify(projectId, repoPath)

      // JSON output mode
      if (options.json) {
        console.log(JSON.stringify(result))
        return { success: result.passed, data: result }
      }

      // Human-readable output
      console.log('')
      if (result.passed) {
        out.done('Semantic verification passed')
        console.log(
          `  ${result.passedCount}/${result.checks.length} checks passed (${result.totalMs}ms)`
        )
      } else {
        out.fail('Semantic verification failed')
        console.log(`  ${result.failedCount}/${result.checks.length} checks failed`)
      }
      console.log('')

      // Show check details
      console.log('Check Results:')
      for (const check of result.checks) {
        const icon = check.passed ? '✓' : '✗'
        const status = check.passed
          ? `${check.output} (${check.durationMs}ms)`
          : check.error || 'Failed'
        console.log(`  ${icon} ${check.name}: ${status}`)
      }
      console.log('')

      return { success: result.passed, data: result }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else {
        out.fail(errMsg)
      }
      return { success: false, error: errMsg }
    }
  }
}
