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

      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log('📝 Updated ~/.claude/CLAUDE.md')
      }

      console.log('✅ Analysis complete!\n')
      console.log('📄 Full report: analysis/repo-summary.md')
      console.log('📝 Context: ~/.prjct-cli/projects/' + projectId + '/CLAUDE.md\n')
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
   * /p:sync - Sync project state with raw data for Claude to analyze
   *
   * AGENTIC: This command gathers RAW data and puts it in CLAUDE.md
   * Claude then reads the data and decides what agents to create.
   * NO hardcoded if/else logic for technology detection.
   */
  async sync(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      await this.initializeAgent()

      console.log('🔄 Syncing project state...\n')

      // 1. Run analysis to gather raw data
      console.log('📊 Running analysis...')
      const analysisResult = await this.analyze({}, projectPath)

      if (!analysisResult.success) {
        console.error('❌ Analysis failed')
        return analysisResult
      }

      const projectId = await configManager.getProjectId(projectPath)

      // 2. Generate CLAUDE.md with RAW DATA (no processing)
      // Claude will read this and decide what to do
      await generateContext(projectId!, projectPath)

      // 3. Update global config
      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log('📝 Updated ~/.claude/CLAUDE.md')
      }

      // 4. Log to memory
      await this.logToMemory(projectPath, 'sync_complete', {
        timestamp: dateHelper.getTimestamp(),
        projectId,
      })

      console.log('\n✅ Sync complete!\n')
      console.log('📝 Context: ~/.prjct-cli/projects/' + projectId + '/CLAUDE.md')
      console.log('\n📋 CLAUDE.md contains RAW project data.')
      console.log('💡 Claude reads this data and decides what specialists to create.\n')
      console.log('Next steps:')
      console.log('• Read CLAUDE.md to see project data')
      console.log('• /p:feature → Add a feature')

      return {
        success: true,
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

}
