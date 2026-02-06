/**
 * Analysis Commands: analyze, sync, and related helpers
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import prompts from 'prompts'
import memorySystem from '../agentic/memory-system'
import { generateContext } from '../context/generator'
import analyzer from '../domain/analyzer'
import commandInstaller from '../infrastructure/command-installer'
import { formatCost } from '../schemas/metrics'
import { createStalenessChecker, memoryService, syncService } from '../services'
import { formatDiffPreview, formatFullDiff, generateSyncDiff } from '../services/diff-generator'
import { metricsStorage } from '../storage/metrics-storage'
import type { AnalyzeOptions, CommandResult, ProjectContext } from '../types'
import { showNextSteps } from '../utils/next-steps'
import out from '../utils/output'
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

      const summary = this._generateAnalysisSummary(analysisData, projectPath)

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
      const activeProvider = aiProvider.getActiveProvider()

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
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Generate analysis summary from collected data
   */
  _generateAnalysisSummary(data: Record<string, unknown>, projectPath: string): string {
    const lines: string[] = []

    lines.push('# Repository Analysis\n')
    lines.push(`Generated: ${new Date().toLocaleString()}\n`)

    const projectName = path.basename(projectPath)
    lines.push(`## Project: ${projectName}\n`)

    lines.push('## Stack Detected\n')

    if (data.packageJson) {
      const pkg = data.packageJson as { dependencies?: Record<string, string> }
      lines.push('### JavaScript/TypeScript\n')
      lines.push('- **Package Manager**: npm/yarn/pnpm')
      if (pkg.dependencies) {
        const deps = Object.keys(pkg.dependencies)
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

    const directories = data.directories as string[] | undefined
    lines.push('## Structure\n')
    lines.push(`- **Total Files**: ${data.fileCount}`)
    lines.push(
      `- **Directories**: ${directories?.slice(0, 15).join(', ') || 'none'}${(directories?.length || 0) > 15 ? ` (+${(directories?.length || 0) - 15} more)` : ''}`
    )

    if (data.hasDockerfile) lines.push('- **Docker**: Detected')
    if (data.hasDockerCompose) lines.push('- **Docker Compose**: Detected')
    if (data.hasReadme) lines.push('- **Documentation**: README.md found')
    lines.push('')

    const gitStats = data.gitStats as
      | { totalCommits?: number; contributors?: number; age?: string }
      | undefined
    lines.push('## Git Statistics\n')
    lines.push(`- **Total Commits**: ${gitStats?.totalCommits || 0}`)
    lines.push(`- **Contributors**: ${gitStats?.contributors || 0}`)
    lines.push(`- **Age**: ${gitStats?.age || 'unknown'}`)
    lines.push('')

    if (data.gitLog) {
      lines.push('## Recent Activity\n')
      const logLines = (data.gitLog as string).split('\n').slice(0, 5)
      logLines.forEach((line) => {
        if (line.trim()) {
          const [hash, , time, msg] = line.split('|')
          lines.push(`- \`${hash}\` ${msg} (${time})`)
        }
      })
      lines.push('')
    }

    lines.push('## Recommendations\n')
    lines.push('Based on detected stack, consider generating specialized agents using `/p:sync`.\n')

    lines.push('---\n')
    lines.push(
      '*This analysis was generated automatically. For updated information, run `/p:analyze` again.*\n'
    )

    return lines.join('\n')
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
        const result = await syncService.sync(projectPath, { aiTools: options.aiTools })

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

        // Non-interactive mode: return JSON for LLM to handle
        if (isNonInteractive) {
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

        // Preview-only mode - don't apply
        if (options.preview) {
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
          out.warn('Sync cancelled')
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
            out.warn('Sync cancelled')
            return { success: false, message: 'Cancelled by user' }
          }
        }

        // Changes already applied from dry-run, just show success
        out.done('Changes applied')
        return this.showSyncResult(result, startTime)
      }

      // First sync or --yes flag - proceed directly
      out.spin('Syncing project...')

      // Use syncService to do EVERYTHING in one call
      const result = await syncService.sync(projectPath, { aiTools: options.aiTools })

      if (!result.success) {
        out.fail(result.error || 'Sync failed')
        return { success: false, error: result.error }
      }

      out.stop()
      return this.showSyncResult(result, startTime)
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Display sync results (extracted to avoid duplication)
   *
   * UX Design (PRJ-100):
   * - Summary first: success + key metrics on first lines
   * - Scannable: single-line metrics, minimal vertical space
   * - Changes focused: show what changed, not everything that exists
   * - Next steps prominent: clear call to action at bottom
   */
  private async showSyncResult(
    result: Awaited<ReturnType<typeof syncService.sync>>,
    startTime: number
  ): Promise<CommandResult> {
    const elapsed = Date.now() - startTime
    const contextFilesCount =
      result.contextFiles.length + (result.aiTools?.filter((t) => t.success).length || 0)
    const agentCount = result.agents.length
    const domainAgentCount = result.agents.filter((a) => a.type === 'domain').length

    // Update global config (silent - don't clutter output)
    await commandInstaller.installGlobalConfig()

    // ═══════════════════════════════════════════════════════════════════════
    // SUCCESS LINE - Immediate confirmation with timing
    // ═══════════════════════════════════════════════════════════════════════
    out.done(`Synced ${result.stats.name || 'project'} (${(elapsed / 1000).toFixed(1)}s)`)
    console.log('')

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY BOX - Key metrics grouped visually
    // ═══════════════════════════════════════════════════════════════════════
    const compressionPct = result.syncMetrics?.compressionRate
      ? Math.round(result.syncMetrics.compressionRate * 100)
      : 0
    const framework = result.stats.frameworks.length > 0 ? ` (${result.stats.frameworks[0]})` : ''
    const boxLines = [
      `${result.stats.fileCount} files → ${contextFilesCount} context | ${agentCount} agents${compressionPct > 10 ? ` | ${compressionPct}% reduction` : ''}`,
      `Stack: ${result.stats.ecosystem}${framework} | Branch: ${result.git.branch}`,
    ]
    out.box('Sync Summary', boxLines.join('\n'))

    // ═══════════════════════════════════════════════════════════════════════
    // CHANGES SECTION - What was generated/updated
    // ═══════════════════════════════════════════════════════════════════════
    const generatedItems: string[] = []
    if (result.contextFiles.length > 0) {
      generatedItems.push(`${result.contextFiles.length} context files`)
    }
    const successTools = result.aiTools?.filter((t) => t.success) || []
    if (successTools.length > 0) {
      generatedItems.push(`AI tools: ${successTools.map((t) => t.toolId).join(', ')}`)
    }
    if (agentCount > 0) {
      const agentSummary =
        domainAgentCount > 0
          ? `${agentCount} agents (${domainAgentCount} domain)`
          : `${agentCount} agents`
      generatedItems.push(agentSummary)
    }
    if (result.skills.length > 0) {
      const skillWord = result.skills.length === 1 ? 'skill' : 'skills'
      generatedItems.push(`${result.skills.length} ${skillWord}`)
    }

    out.section('Generated')
    out.list(generatedItems, { bullet: '✓' })
    console.log('')

    // ═══════════════════════════════════════════════════════════════════════
    // STATUS INDICATOR - Repository state
    // ═══════════════════════════════════════════════════════════════════════
    if (result.git.hasChanges) {
      out.warn('Uncommitted changes detected')
      console.log('')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICATION - Post-sync validation checks
    // ═══════════════════════════════════════════════════════════════════════
    if (result.verification) {
      const v = result.verification
      if (v.passed) {
        const items = v.checks.map((c) => `${c.name} (${c.durationMs}ms)`)
        out.section('Verified')
        out.list(items, { bullet: '✓' })
      } else {
        out.section('Verification')
        const items = v.checks.map((c) =>
          c.passed ? `✓ ${c.name}` : `✗ ${c.name}${c.error ? ` — ${c.error}` : ''}`
        )
        out.list(items)
        if (v.skippedCount > 0) {
          out.warn(`${v.skippedCount} check(s) skipped (fail-fast)`)
        }
      }
      console.log('')
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NEXT STEPS - Clear call to action
    // ═══════════════════════════════════════════════════════════════════════
    showNextSteps('sync')

    return {
      success: true,
      data: result,
      metrics: {
        elapsed,
        contextFilesCount,
        agentCount,
        fileCount: result.stats.fileCount,
      },
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
      const sessionActivity = await this._getSessionActivity(projectId)

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
      console.log(`   Total saved:     ${this._formatTokens(summary.totalTokensSaved)} tokens`)
      console.log(
        `   Compression:     ${(summary.compressionRate * 100).toFixed(0)}% average reduction`
      )
      console.log(`   Estimated cost:  ${formatCost(summary.estimatedCostSaved)} saved`)
      console.log('')

      // Performance Section
      console.log('⚡ PERFORMANCE')
      console.log(`   Syncs completed: ${summary.syncCount.toLocaleString()}`)
      console.log(`   Avg sync time:   ${this._formatDuration(summary.avgSyncDuration)}`)
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
        const sparkline = this._generateSparkline(dailyStats)
        console.log(`   ${sparkline} ${this._formatTokens(summary.last30DaysTokens)} tokens saved`)

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
        const markdown = this._generateStatsMarkdown(
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
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
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

      // JSON output mode
      if (options.json) {
        console.log(
          JSON.stringify({
            success: true,
            ...status,
            session: sessionInfo,
          })
        )
        return { success: true, data: { ...status, session: sessionInfo } }
      }

      // Human-readable output
      console.log('')
      console.log(checker.formatStatus(status))
      console.log('')
      console.log(checker.formatSessionInfo(sessionInfo))
      console.log('')

      return { success: true, data: { ...status, session: sessionInfo } }
    } catch (error) {
      const errMsg = (error as Error).message
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else {
        out.fail(errMsg)
      }
      return { success: false, error: errMsg }
    }
  }

  /**
   * Get session activity stats from today's events
   * @see PRJ-89
   */
  private async _getSessionActivity(projectId: string): Promise<{
    sessionDuration: string | null
    tasksCompleted: number
    featuresShipped: number
    agentsUsed: { name: string; count: number }[]
  }> {
    try {
      // Get today's events from memory
      const recentHistory = await memoryService.getRecentEvents(projectId, 100)

      const today = new Date().toISOString().split('T')[0]
      const todayEvents = recentHistory.filter((e) => {
        const ts = (e.timestamp || e.ts) as string | undefined
        return ts?.startsWith(today)
      })

      // Calculate session duration (time between first and last event today)
      let sessionDuration: string | null = null
      if (todayEvents.length >= 2) {
        const timestamps = todayEvents
          .map((e) => new Date((e.timestamp || e.ts) as string).getTime())
          .filter((t) => !Number.isNaN(t))
          .sort((a, b) => a - b)

        if (timestamps.length >= 2) {
          const durationMs = timestamps[timestamps.length - 1] - timestamps[0]
          sessionDuration = dateHelper.formatDuration(durationMs)
        }
      }

      // Count tasks completed today
      const tasksCompleted = todayEvents.filter((e) => e.action === 'task_completed').length

      // Count features shipped today
      const featuresShipped = todayEvents.filter((e) => e.action === 'feature_shipped').length

      // Count agent usage from sync events
      const agentCounts = new Map<string, number>()
      for (const event of todayEvents) {
        if (event.action === 'sync' && Array.isArray(event.subagents)) {
          for (const agent of event.subagents as string[]) {
            agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1)
          }
        }
      }

      const agentsUsed = Array.from(agentCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      return {
        sessionDuration,
        tasksCompleted,
        featuresShipped,
        agentsUsed,
      }
    } catch {
      return {
        sessionDuration: null,
        tasksCompleted: 0,
        featuresShipped: 0,
        agentsUsed: [],
      }
    }
  }

  // =========== Stats Helper Methods ===========

  private _formatTokens(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`
    }
    return tokens.toLocaleString()
  }

  private _formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`
    }
    return `${(ms / 1000).toFixed(1)}s`
  }

  private _generateSparkline(dailyStats: { tokensSaved: number }[]): string {
    if (dailyStats.length === 0) return ''

    const chars = '▁▂▃▄▅▆▇█'
    const values = dailyStats.map((d) => d.tokensSaved)
    const max = Math.max(...values, 1)

    return values
      .map((v) => {
        const idx = Math.min(Math.floor((v / max) * (chars.length - 1)), chars.length - 1)
        return chars[idx]
      })
      .join('')
  }

  private _generateStatsMarkdown(
    summary: {
      totalTokensSaved: number
      estimatedCostSaved: number
      compressionRate: number
      syncCount: number
      avgSyncDuration: number
      topAgents: { agentName: string; usageCount: number }[]
      last30DaysTokens: number
      trend: number
    },
    _dailyStats: { date: string; tokensSaved: number; syncs: number }[],
    projectName: string,
    firstSyncDate: string,
    sessionActivity?: {
      sessionDuration: string | null
      tasksCompleted: number
      featuresShipped: number
      agentsUsed: { name: string; count: number }[]
    },
    patternsSummary?: {
      decisions: number
      learnedDecisions: number
      workflows: number
      preferences: number
    }
  ): string {
    const lines: string[] = []

    lines.push(`# ${projectName} - Stats Dashboard`)
    lines.push('')
    lines.push(`_Generated: ${new Date().toLocaleString()} | Tracking since: ${firstSyncDate}_`)
    lines.push('')

    // Session Activity (PRJ-89)
    if (sessionActivity) {
      lines.push("## 🎯 Today's Activity")
      lines.push('')
      lines.push(`| Metric | Value |`)
      lines.push(`|--------|-------|`)
      if (sessionActivity.sessionDuration) {
        lines.push(`| Duration | ${sessionActivity.sessionDuration} |`)
      }
      lines.push(`| Tasks completed | ${sessionActivity.tasksCompleted} |`)
      lines.push(`| Features shipped | ${sessionActivity.featuresShipped} |`)
      if (sessionActivity.agentsUsed.length > 0) {
        const agentStr = sessionActivity.agentsUsed
          .slice(0, 3)
          .map((a) => `${a.name} (${a.count}×)`)
          .join(', ')
        lines.push(`| Agents used | ${agentStr} |`)
      }
      lines.push('')
    }

    // Patterns Learned (PRJ-89)
    if (patternsSummary && (patternsSummary.decisions > 0 || patternsSummary.preferences > 0)) {
      lines.push('## 🧠 Patterns Learned')
      lines.push('')
      lines.push(`| Type | Count |`)
      lines.push(`|------|-------|`)
      lines.push(
        `| Decisions | ${patternsSummary.learnedDecisions} confirmed (${patternsSummary.decisions} total) |`
      )
      lines.push(`| Preferences | ${patternsSummary.preferences} |`)
      lines.push(`| Workflows | ${patternsSummary.workflows} |`)
      lines.push('')
    }

    lines.push('## 💰 Token Savings')
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total saved | ${this._formatTokens(summary.totalTokensSaved)} tokens |`)
    lines.push(`| Compression | ${(summary.compressionRate * 100).toFixed(0)}% |`)
    lines.push(`| Cost saved | ${formatCost(summary.estimatedCostSaved)} |`)
    lines.push('')

    lines.push('## ⚡ Performance')
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Syncs | ${summary.syncCount} |`)
    lines.push(`| Avg time | ${this._formatDuration(summary.avgSyncDuration)} |`)
    lines.push('')

    if (summary.topAgents.length > 0) {
      lines.push('## 🤖 Agent Usage')
      lines.push('')
      lines.push(`| Agent | Usage |`)
      lines.push(`|-------|-------|`)
      const totalUsage = summary.topAgents.reduce((sum, a) => sum + a.usageCount, 0)
      for (const agent of summary.topAgents) {
        const pct = totalUsage > 0 ? ((agent.usageCount / totalUsage) * 100).toFixed(0) : 0
        lines.push(`| ${agent.agentName} | ${pct}% (${agent.usageCount}) |`)
      }
      lines.push('')
    }

    lines.push('## 📈 30-Day Trend')
    lines.push('')
    lines.push(`- Tokens saved: ${this._formatTokens(summary.last30DaysTokens)}`)
    if (summary.trend !== 0) {
      const trendSign = summary.trend > 0 ? '+' : ''
      lines.push(`- Trend: ${trendSign}${summary.trend.toFixed(0)}% vs previous period`)
    }
    lines.push('')

    lines.push('---')
    lines.push('')
    lines.push('_Generated with [prjct-cli](https://prjct.app)_')

    return lines.join('\n')
  }
}
