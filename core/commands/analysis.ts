/**
 * Analysis Commands: analyze, sync, and related helpers
 */

import path from 'path'

import type { CommandResult, AnalyzeOptions, ProjectContext } from '../types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  dateHelper
} from './base'
import analyzer from '../domain/analyzer'
import { generateContext } from '../context/generator'
import commandInstaller from '../infrastructure/command-installer'
import { syncService } from '../services'
import { showNextSteps } from '../utils/next-steps'
import { metricsStorage } from '../storage/metrics-storage'
import { formatCost } from '../schemas/metrics'

export class AnalysisCommands extends PrjctCommandsBase {
  /**
   * /p:analyze - Analyze repository and generate summary
   */
  async analyze(options: AnalyzeOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      await this.initializeAgent()

      console.log('🔍 Analyzing repository...\n')

      analyzer.init(projectPath)

      const context = await contextBuilder.build(projectPath, options) as ProjectContext

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
        context.paths.analysis ||
        pathManager.getFilePath(
          projectId!,
          'analysis',
          'repo-summary.md'
        )

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

    const gitStats = data.gitStats as { totalCommits?: number; contributors?: number; age?: string } | undefined
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
   * /p:sync - Comprehensive project sync
   *
   * Uses syncService to do ALL operations in one TypeScript execution:
   * - Git analysis
   * - Project stats
   * - Agent generation
   * - Context file generation
   * - Skill configuration
   * - State updates
   *
   * This eliminates the need for Claude to make 50+ individual tool calls.
   */
  async sync(projectPath: string = process.cwd(), options: { aiTools?: string[] } = {}): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const startTime = Date.now()
      console.log('🔄 Syncing project...\n')

      // Use syncService to do EVERYTHING in one call
      const result = await syncService.sync(projectPath, { aiTools: options.aiTools })

      if (!result.success) {
        console.error('❌ Sync failed:', result.error)
        return { success: false, error: result.error }
      }

      // Update global config
      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log(`📝 Updated ${pathManager.getDisplayPath(globalConfigResult.path!)}`)
      }

      // Format output
      console.log(`🔄 Project synced to prjct v${result.cliVersion}\n`)

      console.log('📊 Project Stats')
      console.log(`├── Files: ~${result.stats.fileCount}`)
      console.log(`├── Commits: ${result.git.commits}`)
      console.log(`├── Version: ${result.stats.version}`)
      console.log(`└── Stack: ${result.stats.ecosystem}\n`)

      console.log('🌿 Git Status')
      console.log(`├── Branch: ${result.git.branch}`)
      console.log(`├── Uncommitted: ${result.git.hasChanges ? 'Yes' : 'Clean'}`)
      console.log(`└── Recent: ${result.git.weeklyCommits} commits this week\n`)

      console.log('📁 Context Updated')
      for (const file of result.contextFiles) {
        console.log(`├── ${file}`)
      }
      console.log('')

      // Show AI Tools generated (multi-agent output)
      if (result.aiTools && result.aiTools.length > 0) {
        const successTools = result.aiTools.filter(t => t.success)
        console.log(`🤖 AI Tools Context (${successTools.length})`)
        for (const tool of result.aiTools) {
          const status = tool.success ? '✓' : '✗'
          console.log(`├── ${status} ${tool.outputFile} (${tool.toolId})`)
        }
        console.log('')
      }

      const workflowAgents = result.agents.filter(a => a.type === 'workflow').map(a => a.name)
      const domainAgents = result.agents.filter(a => a.type === 'domain').map(a => a.name)

      console.log(`🤖 Agents Regenerated (${result.agents.length})`)
      console.log(`├── Workflow: ${workflowAgents.join(', ')}`)
      console.log(`└── Domain: ${domainAgents.join(', ') || 'none'}\n`)

      if (result.skills.length > 0) {
        console.log('📦 Skills Configured')
        for (const skill of result.skills) {
          console.log(`├── ${skill.agent}.md → ${skill.skill}`)
        }
        console.log('')
      }

      if (result.git.hasChanges) {
        console.log('⚠️  You have uncommitted changes\n')
      } else {
        console.log('✨ Repository is clean!\n')
      }

      showNextSteps('sync')

      // Summary metrics
      const elapsed = Date.now() - startTime
      const contextFilesCount = result.contextFiles.length + (result.aiTools?.filter(t => t.success).length || 0)
      const agentCount = result.agents.length

      console.log('─'.repeat(45))
      console.log(`📊 Sync Summary`)
      console.log(`   Stack: ${result.stats.ecosystem} (${result.stats.frameworks.join(', ') || 'no frameworks'})`)
      console.log(`   Files: ${result.stats.fileCount} analyzed → ${contextFilesCount} context files`)
      console.log(`   Agents: ${agentCount} (${result.agents.filter(a => a.type === 'domain').length} domain)`)
      console.log(`   Time: ${(elapsed / 1000).toFixed(1)}s`)
      console.log('')

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
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:stats - Value dashboard showing accumulated savings and impact
   *
   * Displays:
   * - Token savings (total, compression rate, estimated cost)
   * - Performance metrics (sync count, avg duration)
   * - Agent usage breakdown
   * - 30-day trend visualization
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

      // JSON output mode
      if (options.json) {
        const jsonOutput = {
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
        const fs = require('fs/promises')
        const path = require('path')
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
      console.log('│  📊 prjct-cli Value Dashboard                   │')
      console.log(`│  Project: ${projectName.padEnd(20).slice(0, 20)} | Since: ${firstSyncDate.padEnd(12).slice(0, 12)} │`)
      console.log('╰─────────────────────────────────────────────────╯')
      console.log('')

      // Token Savings Section
      console.log('💰 TOKEN SAVINGS')
      console.log(`   Total saved:     ${this._formatTokens(summary.totalTokensSaved)} tokens`)
      console.log(`   Compression:     ${(summary.compressionRate * 100).toFixed(0)}% average reduction`)
      console.log(`   Estimated cost:  ${formatCost(summary.estimatedCostSaved)} saved`)
      console.log('')

      // Performance Section
      console.log('⚡ PERFORMANCE')
      console.log(`   Syncs completed: ${summary.syncCount.toLocaleString()}`)
      console.log(`   Avg sync time:   ${this._formatDuration(summary.avgSyncDuration)}`)
      console.log('')

      // Agent Usage Section
      if (summary.topAgents.length > 0) {
        console.log('🤖 AGENT USAGE')
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
          console.log(`   ${trendIcon} ${trendSign}${summary.trend.toFixed(0)}% vs previous 30 days`)
        }
        console.log('')
      }

      // Footer
      console.log('───────────────────────────────────────────────────')
      console.log(`Export: prjct stats --export > stats.md`)
      console.log('')

      // Export mode - return markdown
      if (options.export) {
        const markdown = this._generateStatsMarkdown(summary, dailyStats, projectName, firstSyncDate)
        console.log(markdown)
        return { success: true, data: { markdown } }
      }

      return {
        success: true,
        data: summary,
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
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
    dailyStats: { date: string; tokensSaved: number; syncs: number }[],
    projectName: string,
    firstSyncDate: string
  ): string {
    const lines: string[] = []

    lines.push(`# ${projectName} - Value Dashboard`)
    lines.push('')
    lines.push(`_Generated: ${new Date().toLocaleString()} | Tracking since: ${firstSyncDate}_`)
    lines.push('')

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
