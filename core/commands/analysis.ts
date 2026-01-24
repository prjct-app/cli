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
  async sync(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      console.log('🔄 Syncing project...\n')

      // Use syncService to do EVERYTHING in one call
      const result = await syncService.sync(projectPath)

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

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

}
