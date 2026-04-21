/**
 * Analysis Commands: analyze, sync, and related helpers
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import * as p from '@clack/prompts'
import memorySystem from '../agentic/memory-system'
import analyzer from '../domain/analyzer'
import commandInstaller from '../infrastructure/command-installer'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { formatCost } from '../schemas/metrics'
import { formatAnalysisDiffMd, formatAnalysisDiffText } from '../services/analysis-diff'
import { buildAnalysisPayload } from '../services/analysis-payload-builder'
import { formatDiffPreview, formatFullDiff, generateSyncDiff } from '../services/diff-generator'
import { syncService } from '../services/sync-service'
import { analysisStorage } from '../storage/analysis-storage'
import { prjctDb } from '../storage/database'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import { metricsStorage } from '../storage/metrics-storage'
import type { AnalyzeOptions, CommandResult } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import * as dateHelper from '../utils/date-helper'
import {
  mdDone,
  mdList,
  mdNextSteps,
  mdOutput,
  mdSection,
  mdStats,
  mdWarn,
} from '../utils/md-formatter'
import { getNextSteps } from '../utils/next-steps'
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
import { PrjctCommandsBase } from './base'

/** Compact schema reference for LLM — avoids dumping 50+ lines of JSON examples */
const ANALYSIS_SCHEMA_COMPACT = `{version:1, commitHash, analyzedAt,
  architecture:{style:"monolith|monorepo|microservices|modular-monolith", insights:[], domains:[]},
  patterns:[{name, description, locations:[], confidence:0-1, category:"architecture|data-flow|error-handling|testing"}],
  antiPatterns:[{issue, reasoning, files:[], suggestion, severity:"low|medium|high", confidence:0-1}],
  techDebt:[{description, area, effort:"small|medium|large", impact, priority:"low|medium|high"}],
  riskAreas:[{path, reason, risk, severity}], refactorSuggestions:[{description, files:[], benefit, effort}],
  projectInsights:[], conventions:[{category, rule, example}],
  commands:{build, test, lint, dev, format, install}, stack:{languages:[], frameworks:[], packageManager}}`

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

      // Inline path resolution — `contextBuilder.build` (pre-v2 agentic
      // harness) was only consulted for `paths.analysis`. Going direct
      // to `pathManager` keeps this callsite alive without the wider
      // context-builder graph.
      void options

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
      const summaryPath = pathManager.getFilePath(projectId!, 'analysis', 'repo-summary.md')

      await fs.writeFile(summaryPath, summary, 'utf-8')

      await this.logToMemory(projectPath, 'repository_analyzed', {
        timestamp: dateHelper.getTimestamp(),
        fileCount: analysisData.fileCount,
        gitCommits: analysisData.gitStats.totalCommits,
      })

      const aiProvider = require('../infrastructure/ai-provider')
      const activeProvider = await aiProvider.getActiveProvider()

      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log(`📝 Updated ${pathManager.getDisplayPath(globalConfigResult.path!)}`)
      }

      console.log('✅ Analysis complete!\n')
      console.log(`📄 Full report: ${pathManager.getDisplayPath(summaryPath)}`)
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
      preview?: boolean
      yes?: boolean
      json?: boolean
      md?: boolean
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
          packagePath: pkg.path,
          packageName: pkg.name,
        })

        if (options.json) {
          console.log(
            JSON.stringify({ success: result.success, package: pkg.name, path: pkg.relativePath })
          )
        } else if (options.md) {
          console.log(mdOutput(mdDone(`Synced package: ${pkg.name}`)))
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
      const isNonInteractive = !process.stdin.isTTY || options.json || options.md

      // For preview mode or when we have existing content, show diff first
      // Non-interactive callers (LLMs, piped input) skip diff preview and sync directly
      if (existingContent && !options.yes && !isNonInteractive) {
        if (!isNonInteractive) {
          out.spin('Analyzing changes...')
        }

        // Do a dry-run sync to see what would change
        const result = await syncService.sync(projectPath, {
          full: options.full,
        })

        if (!result.success) {
          if (options.md) {
            console.log(mdOutput(`## Sync Failed`, `> ${result.error || 'Unknown error'}`))
            return { success: false, error: result.error }
          }
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
          if (options.md) {
            console.log(mdOutput(mdDone('No changes detected', 'Context is up to date.')))
            return { success: true, message: 'No changes' }
          }
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

        // Markdown non-interactive mode
        if (options.md) {
          await restoreOriginal()

          const changeItems: string[] = []
          for (const s of diff.added) changeItems.push(`Added: ${s.name} (${s.lineCount} lines)`)
          for (const s of diff.modified)
            changeItems.push(`Modified: ${s.name} (${s.lineCount} lines)`)
          for (const s of diff.removed)
            changeItems.push(`Removed: ${s.name} (${s.lineCount} lines)`)

          const md = mdOutput(
            `## Sync Preview`,
            changeItems.length > 0
              ? mdSection('Changes', mdList(changeItems))
              : 'No section changes.',
            mdStats({
              'Tokens before': diff.tokensBefore,
              'Tokens after': diff.tokensAfter,
              'Token delta': diff.tokenDelta > 0 ? `+${diff.tokenDelta}` : String(diff.tokenDelta),
            }),
            `> Run \`prjct sync --yes\` to apply changes.`
          )
          console.log(md)

          return {
            success: true,
            isPreview: true,
            diff,
            message: 'Preview complete (awaiting confirmation)',
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
        const action = await p.select({
          message: 'Apply these changes?',
          options: [
            { label: 'Yes, apply changes', value: 'apply' },
            { label: 'No, cancel', value: 'cancel' },
            { label: 'Show full diff', value: 'diff' },
          ],
        })

        if (p.isCancel(action) || action === 'cancel') {
          await restoreOriginal()
          out.warn('Sync cancelled — no changes applied')
          return { success: false, message: 'Cancelled by user' }
        }

        if (action === 'diff') {
          console.log(`\n${formatFullDiff(diff)}`)
          const confirmApply = await p.confirm({
            message: 'Apply these changes?',
            initialValue: true,
          })
          if (p.isCancel(confirmApply) || !confirmApply) {
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
      if (!options.md) out.spin('Syncing project...')

      // Use syncService to do EVERYTHING in one call
      const result = await syncService.sync(projectPath, {
        full: options.full,
      })

      if (!result.success) {
        if (options.md) {
          console.log(mdOutput(`## Sync Failed`, `> ${result.error || 'Unknown error'}`))
        } else {
          out.fail(result.error || 'Sync failed')
        }
        return { success: false, error: result.error }
      }

      if (!options.md) out.stop()

      if (options.md) {
        const elapsed = Date.now() - startTime
        const skillCount = result.generatedSkills?.generated?.length ?? 0

        // Check for analysis diff (PRJ-275)
        let analysisDiffSection: string | null = null
        try {
          const analysisDiff = await analysisStorage.diff(projectId)
          if (analysisDiff?.hasChanges) {
            analysisDiffSection = formatAnalysisDiffMd(analysisDiff)
          }
        } catch {
          // Non-critical
        }

        // Auto-include analysis payload if analysis is stale (instead of suggesting manual step)
        const currentCommit = result.git.recentCommits[0]?.hash ?? null
        const analysisIsCurrent =
          currentCommit && llmAnalysisStorage.isCurrent(projectId, currentCommit)
        let llmAnalysisInstructions: string | null = null
        if (!analysisIsCurrent) {
          try {
            const payload = await buildAnalysisPayload(
              projectId,
              projectPath,
              result.git,
              result.stats
            )
            llmAnalysisInstructions = [
              `## Analysis Payload`,
              `> Analyze this project data. Return JSON matching the schema.`,
              '### Schema',
              '```',
              ANALYSIS_SCHEMA_COMPACT,
              '```',
              '### Data',
              '```json',
              JSON.stringify(payload),
              '```',
              `> Save: \`prjct analysis-save-llm '<JSON>' --md\``,
            ].join('\n')
          } catch {
            // Fall back to manual instruction if payload build fails
            llmAnalysisInstructions = `### Next: Run \`prjct analysis-payload --md\` to update project analysis`
          }
        }

        const steps = getNextSteps('sync', true)
        const idx = result.syncMetrics?.indexes
        const mdStatsObj: Record<string, string | number> = {
          Duration: `${(elapsed / 1000).toFixed(1)}s`,
          Skills: `${skillCount} generated`,
          'Files indexed': result.stats.fileCount,
        }
        if (idx?.bm25Files) {
          const totalTokens = idx.bm25Files * (idx.bm25AvgTokens || 0)
          mdStatsObj['Tokens indexed'] = `${Math.round(totalTokens / 1000)}K`
          mdStatsObj['Import edges'] = idx.importEdges || 0
          mdStatsObj['Co-change commits'] = idx.cochangeCommits || 0
        }
        const md = mdOutput(
          mdDone(`Sync Complete`),
          mdStats(mdStatsObj),
          analysisDiffSection,
          result.git.hasChanges ? mdWarn('Uncommitted changes detected') : null,
          llmAnalysisInstructions,
          mdNextSteps(steps.map((s) => ({ label: s.desc, command: s.cmd })))
        )
        console.log(md)

        return {
          success: true,
          data: result,
          metrics: { elapsed, skillCount, fileCount: result.stats.fileCount },
        }
      }

      return showSyncResult(result, startTime)
    } catch (error) {
      if (options.md) {
        console.log(mdOutput(`## Sync Failed`, `> ${getErrorMessage(error)}`))
      } else {
        out.fail(getErrorMessage(error))
      }
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Generate analysis payload for LLM consumption.
   * Called by the sync template to get data for the LLM to analyze.
   */
  async analysisPayload(
    projectPath: string = process.cwd(),
    options: { json?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        return { success: false, error: 'No project ID found' }
      }

      // Quick sync to get fresh data (without full regeneration)
      const result = await syncService.sync(projectPath)
      if (!result.success) {
        return { success: false, error: result.error || 'Failed to gather project data' }
      }

      // Check if LLM analysis is already current
      const currentCommit = result.git.recentCommits[0]?.hash ?? null
      if (currentCommit && llmAnalysisStorage.isCurrent(projectId, currentCommit)) {
        if (options.md) {
          console.log(mdOutput(mdDone('LLM analysis is current'), '> No re-analysis needed.'))
        } else {
          console.log(
            JSON.stringify({ success: true, action: 'skip', message: 'Analysis is current' })
          )
        }
        return { success: true, message: 'Analysis is current' }
      }

      const payload = await buildAnalysisPayload(projectId, projectPath, result.git, result.stats)

      if (options.md) {
        console.log(
          mdOutput(
            `## Analysis Payload`,
            `> Analyze this project data. Return JSON matching the schema.`,
            '### Schema',
            '```',
            ANALYSIS_SCHEMA_COMPACT,
            '```',
            '### Data',
            '```json',
            JSON.stringify(payload),
            '```',
            `> Save: \`prjct analysis-save-llm '<JSON>' --md\``
          )
        )
      } else {
        console.log(JSON.stringify({ success: true, payload }))
      }

      return { success: true, data: payload }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Save structured LLM analysis findings to SQLite.
   * Called by the sync template after the LLM produces findings.
   */
  async saveLlmAnalysis(
    analysisJson: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        return { success: false, error: 'No project ID found' }
      }

      const analysis = JSON.parse(analysisJson)

      // Validate basic structure
      if (!analysis.version || !analysis.architecture || !analysis.patterns) {
        return { success: false, error: 'Invalid LLM analysis format. Missing required fields.' }
      }

      llmAnalysisStorage.save(projectId, analysis)

      if (options.md) {
        console.log(
          mdOutput(
            mdDone('LLM Analysis Saved'),
            mdStats({
              Architecture: analysis.architecture.style,
              Patterns: analysis.patterns.length,
              'Anti-patterns': analysis.antiPatterns?.length || 0,
              'Tech debt items': analysis.techDebt?.length || 0,
              'Risk areas': analysis.riskAreas?.length || 0,
              Conventions: analysis.conventions?.length || 0,
            })
          )
        )
      } else {
        console.log(
          JSON.stringify({
            success: true,
            message: 'LLM analysis saved',
            stats: {
              patterns: analysis.patterns.length,
              antiPatterns: analysis.antiPatterns?.length || 0,
              techDebt: analysis.techDebt?.length || 0,
            },
          })
        )
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Get the current LLM analysis for a project.
   */
  async getLlmAnalysis(
    projectPath: string = process.cwd(),
    options: { json?: boolean; md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        return { success: false, error: 'No project ID found' }
      }

      const analysis = llmAnalysisStorage.getActive(projectId)

      if (!analysis) {
        if (options.md) {
          console.log(mdOutput('## No LLM Analysis', '> Run `prjct sync` to generate.'))
        } else {
          console.log(JSON.stringify({ success: false, message: 'No LLM analysis found' }))
        }
        return { success: false, message: 'No LLM analysis found' }
      }

      if (options.md) {
        const sections: string[] = [mdDone(`LLM Analysis (${analysis.architecture.style})`), '']

        if (analysis.architecture.insights.length > 0) {
          sections.push(
            mdSection('Architecture Insights', mdList(analysis.architecture.insights.slice(0, 5)))
          )
        }

        if (analysis.patterns.length > 0) {
          const shown = analysis.patterns.slice(0, 8)
          sections.push(
            mdSection(
              `Patterns (${analysis.patterns.length})`,
              mdList(shown.map((p) => `**${p.name}** — ${p.description} (${p.category})`))
            )
          )
        }

        if (analysis.antiPatterns.length > 0) {
          const shown = analysis.antiPatterns.slice(0, 5)
          sections.push(
            mdSection(
              `Anti-Patterns (${analysis.antiPatterns.length})`,
              mdList(shown.map((a) => `[${a.severity}] ${a.issue} — ${a.suggestion}`))
            )
          )
        }

        if (analysis.techDebt.length > 0) {
          const shown = analysis.techDebt.slice(0, 5)
          sections.push(
            mdSection(
              `Tech Debt (${analysis.techDebt.length})`,
              mdList(shown.map((d) => `[${d.priority}/${d.effort}] ${d.description}`))
            )
          )
        }

        if (analysis.conventions.length > 0) {
          sections.push(
            mdSection(
              'Conventions',
              mdList(analysis.conventions.slice(0, 5).map((c) => `**${c.category}**: ${c.rule}`))
            )
          )
        }

        console.log(mdOutput(...sections))
      } else {
        // Cap arrays for context efficiency
        const compact = {
          ...analysis,
          patterns: analysis.patterns.slice(0, 10),
          antiPatterns: analysis.antiPatterns.slice(0, 6),
          techDebt: analysis.techDebt.slice(0, 6),
          conventions: analysis.conventions.slice(0, 6),
        }
        console.log(JSON.stringify({ success: true, analysis: compact }))
      }

      return { success: true, data: analysis }
    } catch (error) {
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
          topAgents: summary.topAgents.slice(0, 5),
          last30DaysTokens: summary.last30DaysTokens,
          trend: summary.trend,
          dailyStats: dailyStats.slice(0, 7),
        }
        console.log(JSON.stringify(jsonOutput))
        return { success: true, data: jsonOutput }
      }

      // Get project info for header
      let projectName = 'Unknown'
      try {
        const projectDoc = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project')
        projectName = (projectDoc?.name as string) || 'Unknown'
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
   * prjct diff - Show diff between draft and sealed analysis (PRJ-275)
   *
   * Compares the current draft with the sealed version to show
   * what changed: languages, frameworks, patterns, file count, etc.
   */
  async diff(
    projectPath: string = process.cwd(),
    options: { json?: boolean; md?: boolean } = {}
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

      const diff = await analysisStorage.diff(projectId)

      if (!diff) {
        const msg =
          'Cannot compute diff: need both a sealed and a draft analysis. Run `p. sync` to create a draft.'
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: msg }))
        } else if (options.md) {
          console.log(mdOutput(`## Analysis Diff`, `> ${msg}`))
        } else {
          out.warn(msg)
        }
        return { success: false, error: msg }
      }

      if (options.json) {
        console.log(JSON.stringify({ success: true, ...diff }))
        return { success: true, data: diff }
      }

      if (options.md) {
        console.log(mdOutput(formatAnalysisDiffMd(diff)))
        return { success: true, data: diff }
      }

      // Terminal output
      if (!diff.hasChanges) {
        out.done('No changes between draft and sealed analysis')
      } else {
        out.section('Analysis Diff')
        console.log(formatAnalysisDiffText(diff))
        console.log('')

        const parts: string[] = []
        if (diff.summary.added > 0) parts.push(`${diff.summary.added} added`)
        if (diff.summary.removed > 0) parts.push(`${diff.summary.removed} removed`)
        if (diff.summary.changed > 0) parts.push(`${diff.summary.changed} changed`)
        out.done(parts.join(', '))
      }
      console.log('')

      return { success: true, data: diff }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else if (options.md) {
        console.log(mdOutput(`## Diff Failed`, `> ${errMsg}`))
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
   * prjct rollback - Rollback to the previous sealed analysis (PRJ-276)
   *
   * Restores the previous sealed version. The current sealed becomes a draft.
   * Only one level of rollback is supported.
   */
  async rollback(
    projectPath: string = process.cwd(),
    options: { json?: boolean; md?: boolean } = {}
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

      const result = await analysisStorage.rollback(projectId)

      if (options.json) {
        console.log(
          JSON.stringify({
            success: result.success,
            restoredSignature: result.restoredSignature,
            error: result.error,
          })
        )
        return { success: result.success, error: result.error }
      }

      if (options.md) {
        if (!result.success) {
          console.log(mdOutput(`## Rollback Failed`, `> ${result.error}`))
          return { success: false, error: result.error }
        }

        console.log(
          mdOutput(
            mdDone('Analysis Rolled Back'),
            mdStats({
              'Restored signature': `${result.restoredSignature?.substring(0, 16)}...`,
              Note: 'Previous sealed version is now active. Current version moved to draft.',
            })
          )
        )
        return { success: true, data: { restoredSignature: result.restoredSignature } }
      }

      if (!result.success) {
        out.fail(result.error || 'Rollback failed')
        return { success: false, error: result.error }
      }

      out.done('Analysis rolled back to previous sealed version')
      console.log(`  Restored signature: ${result.restoredSignature?.substring(0, 16)}...`)
      console.log(`  Previous sealed version demoted to draft`)
      console.log('')

      return { success: true, data: { restoredSignature: result.restoredSignature } }
    } catch (error) {
      const errMsg = getErrorMessage(error)
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: errMsg }))
      } else if (options.md) {
        console.log(mdOutput(`## Rollback Failed`, `> ${errMsg}`))
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

      // Get project path from project doc
      let repoPath = projectPath
      try {
        const projectDoc = prjctDb.getDoc<Record<string, unknown>>(projectId, 'project')
        repoPath = (projectDoc?.repoPath as string) || projectPath
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
