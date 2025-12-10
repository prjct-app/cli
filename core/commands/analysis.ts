/**
 * Analysis Commands: analyze, sync, and related helpers
 */

import path from 'path'

import type { CommandResult, AnalyzeOptions, Context } from './types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  dateHelper
} from './base'

export class AnalysisCommands extends PrjctCommandsBase {
  /**
   * /p:analyze - Analyze repository and generate summary
   */
  async analyze(options: AnalyzeOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      await this.initializeAgent()

      console.log('🔍 Analyzing repository...\n')

      const analyzer = require('../domain/analyzer')
      analyzer.init(projectPath)

      const context = await contextBuilder.build(projectPath, options) as Context

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

      const contextSync = require('../context-sync')
      await contextSync.generateLocalContext(projectPath, projectId)

      const commandInstaller = require('../infrastructure/command-installer')
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
   * /p:sync - Sync project state and generate dynamic agents
   */
  async sync(projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      await this.initializeAgent()

      console.log('🔄 Syncing project state...\n')

      const context = await contextBuilder.build(projectPath) as Context

      console.log('📊 Running analysis...')
      const analysisResult = await this.analyze({}, projectPath)

      if (!analysisResult.success) {
        console.error('❌ Analysis failed')
        return analysisResult
      }

      const summaryContent = (await toolRegistry.get('Read')!(context.paths.analysis)) as string | null

      if (!summaryContent) {
        console.error('❌ No analysis found. Run /p:analyze first.')
        return { success: false, error: 'No analysis found' }
      }

      console.log('✅ Analysis loaded\n')

      console.log('🤖 Generating specialized agents...\n')

      const projectId = await configManager.getProjectId(projectPath)
      const AgentGenerator = require('../domain/agent-generator')
      const generator = new AgentGenerator(projectId)

      const generatedAgents = await this._generateAgentsFromAnalysis(summaryContent, generator, projectPath)

      await this.logToMemory(projectPath, 'agents_generated', {
        timestamp: dateHelper.getTimestamp(),
        agents: generatedAgents,
        count: generatedAgents.length,
      })

      const contextSync = require('../context-sync')
      await contextSync.generateLocalContext(projectPath, projectId)

      const commandInstaller = require('../infrastructure/command-installer')
      const globalConfigResult = await commandInstaller.installGlobalConfig()
      if (globalConfigResult.success) {
        console.log('📝 Updated ~/.claude/CLAUDE.md')
      }

      console.log('\n✅ Sync complete!\n')
      console.log(`🤖 Agents Generated: ${generatedAgents.length}`)
      generatedAgents.forEach((agent) => {
        console.log(`   • ${agent}`)
      })
      console.log('📝 Context: ~/.prjct-cli/projects/' + projectId + '/CLAUDE.md')
      console.log('\n📋 Based on: analysis/repo-summary.md')
      console.log('💡 See templates/agents/AGENTS.md for reference\n')
      console.log('Next steps:')
      console.log('• /p:context → View project state')
      console.log('• /p:feature → Add a feature')

      return {
        success: true,
        agents: generatedAgents,
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * Generate agents dynamically from analysis summary
   */
  async _generateAgentsFromAnalysis(summaryContent: string, generator: unknown, projectPath: string): Promise<string[]> {
    const agents: string[] = []

    const analyzer = require('../domain/analyzer')
    analyzer.init(projectPath)

    const projectData = {
      packageJson: await analyzer.readPackageJson(),
      extensions: await analyzer.getFileExtensions(),
      directories: await analyzer.listDirectories(),
      configFiles: await analyzer.listConfigFiles(),
      analysisSummary: summaryContent,
      projectPath
    }

    const gen = generator as { generateAgentsFromTech: (data: unknown) => Promise<Array<{ name?: string } | string>> }
    const generatedAgents = await gen.generateAgentsFromTech(projectData)

    generatedAgents.forEach(agent => {
      if (typeof agent === 'string') {
        agents.push(agent)
      } else if (agent.name) {
        agents.push(agent.name)
      }
    })

    return agents
  }
}
