/**
 * Planning Commands: init, feature, bug, architect
 */

import path from 'path'

import type { CommandResult, AnalyzeOptions, Context } from './types'
import {
  PrjctCommandsBase,
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  fileHelper,
  dateHelper,
  out
} from './base'
import authorDetector from '../infrastructure/author-detector'

export class PlanningCommands extends PrjctCommandsBase {
  /**
   * /p:init - Initialize prjct project
   */
  async init(idea: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      await this.initializeAgent()

      const isConfigured = await configManager.isConfigured(projectPath)

      if (isConfigured) {
        out.warn('already initialized')
        return { success: false, message: 'Already initialized' }
      }

      out.spin('initializing...')

      const detectedAuthor = await authorDetector.detect()
      // Convert null to undefined for createConfig
      const author = {
        name: detectedAuthor.name || undefined,
        email: detectedAuthor.email || undefined,
        github: detectedAuthor.github || undefined
      }
      const config = await configManager.createConfig(projectPath, author)
      const projectId = config.projectId

      out.spin('creating structure...')

      await pathManager.ensureProjectStructure(projectId)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      const baseFiles: Record<string, string> = {
        'core/now.md': '# NOW\n\nNo current task. Use `/p:now` to set focus.\n',
        'core/next.md': '# NEXT\n\n## Priority Queue\n\n',
        'core/context.md': '# CONTEXT\n\n',
        'progress/shipped.md': '# SHIPPED 🚀\n\n',
        'progress/metrics.md': '# METRICS\n\n',
        'planning/ideas.md': '# IDEAS 💡\n\n## Brain Dump\n\n',
        'planning/roadmap.md': '# ROADMAP\n\n',
        'planning/specs/.gitkeep': '# Specs directory - created by /p:spec\n',
        'memory/context.jsonl': '',
        'memory/patterns.json': JSON.stringify({
          version: 1,
          decisions: {},
          preferences: {},
          workflows: {},
          counters: {}
        }, null, 2),
      }

      for (const [filePath, content] of Object.entries(baseFiles)) {
        await toolRegistry.get('Write')!(path.join(globalPath, filePath), content)
      }

      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      if (hasCode || !isEmpty) {
        out.spin('analyzing project...')
        const analysisResult = await (this as unknown as { analyze: (options: AnalyzeOptions, projectPath: string) => Promise<CommandResult> }).analyze({}, projectPath)

        if (analysisResult.success) {
          out.spin('generating agents...')
          await (this as unknown as { sync: (projectPath: string) => Promise<CommandResult> }).sync(projectPath)
          out.done('initialized')
          return { success: true, mode: 'existing', projectId }
        }
      }

      if (isEmpty && !hasCode) {
        if (!idea) {
          out.done('blank project - provide idea for architect mode')
          return { success: true, mode: 'blank_no_idea', projectId }
        }

        out.spin('architect mode...')
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session\n\n## Idea\n${idea}\n\n## Status\nInitialized - awaiting stack recommendation\n\nGenerated: ${new Date().toLocaleString()}\n`
        await toolRegistry.get('Write')!(sessionPath, sessionContent)

        const commandInstaller = require('../infrastructure/command-installer')
        await commandInstaller.installGlobalConfig()

        out.done('architect mode ready')
        return { success: true, mode: 'architect', projectId, idea }
      }

      const commandInstaller = require('../infrastructure/command-installer')
      await commandInstaller.installGlobalConfig()

      out.done('initialized')
      return { success: true, projectId }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:feature - Add feature with value analysis, roadmap, and task breakdown
   */
  async feature(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        out.fail('description required')
        return { success: false, error: 'Description required' }
      }

      out.spin(`planning ${description}...`)

      const context = await contextBuilder.build(projectPath, { description }) as Context
      const tasks = this._breakdownFeatureTasks(description)

      const tasksWithAgents: { task: string; agent: string }[] = []
      for (const taskDesc of tasks) {
        const agentResult = await this._assignAgentForTask(taskDesc, projectPath, context)
        const agent = agentResult.agent?.name || 'generalist'
        tasksWithAgents.push({ task: taskDesc, agent })
      }

      const nextContent =
        (await toolRegistry.get('Read')!(context.paths.next) as string) || '# NEXT\n\n## Priority Queue\n\n'
      const taskSection =
        `\n## Feature: ${description}\n\n` +
        tasksWithAgents.map((t, i) => `${i + 1}. [${t.agent}] [ ] ${t.task}`).join('\n') +
        `\n\nEstimated: ${tasks.length * 2}h\n`

      await toolRegistry.get('Write')!(context.paths.next, nextContent + taskSection)

      await this.logToMemory(projectPath, 'feature_planned', {
        feature: description,
        tasks: tasksWithAgents.length,
        assignments: tasksWithAgents.map(t => ({ task: t.task, agent: t.agent })),
        timestamp: dateHelper.getTimestamp(),
      })

      const agentCounts = tasksWithAgents.reduce((acc: Record<string, number>, t) => {
        acc[t.agent] = (acc[t.agent] || 0) + 1
        return acc
      }, {})
      const agentSummary = Object.entries(agentCounts).map(([a, c]) => `${a}:${c}`).join(' ')

      out.done(`${tasks.length} tasks [${agentSummary}]`)

      return { success: true, feature: description, tasks: tasksWithAgents }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:bug - Report and track bugs with auto-prioritization
   */
  async bug(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        out.fail('bug description required')
        return { success: false, error: 'Description required' }
      }

      out.spin('tracking bug...')

      const context = await contextBuilder.build(projectPath, { description }) as Context
      const severity = this._detectBugSeverity(description)

      const agentResult = await this._assignAgentForTask(`fix bug: ${description}`, projectPath, context)
      const agent = agentResult.agent?.name || 'generalist'

      const nextContent =
        (await toolRegistry.get('Read')!(context.paths.next) as string) || '# NEXT\n\n## Priority Queue\n\n'
      const bugEntry = `\n## 🐛 BUG [${severity.toUpperCase()}] [${agent}]: ${description}\n\nReported: ${new Date().toLocaleString()}\nPriority: ${severity === 'critical' ? '⚠️ URGENT' : severity === 'high' ? '🔴 High' : '🟡 Normal'}\nAssigned: ${agent}\n`

      const updatedContent =
        severity === 'critical' || severity === 'high'
          ? nextContent.replace('## Priority Queue\n\n', `## Priority Queue\n\n${bugEntry}\n`)
          : nextContent + bugEntry

      await toolRegistry.get('Write')!(context.paths.next, updatedContent)

      await this.logToMemory(projectPath, 'bug_reported', {
        bug: description,
        severity,
        agent,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`bug [${severity}] → ${agent}`)

      return { success: true, bug: description, severity, agent }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:architect - Execute architect plan and generate code
   */
  async architect(action: string = 'execute', projectPath: string = process.cwd()): Promise<CommandResult> {
    if (action !== 'execute') {
      return {
        success: false,
        message: '❌ Invalid action. Use: /p:architect execute',
      }
    }

    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      console.log('🏗️  Architect Mode - Code Generation\n')

      const globalPath = await this.getGlobalProjectPath(projectPath)
      const planPath = path.join(globalPath, 'planning', 'architect-session.md')

      let planContent: string
      try {
        planContent = await fileHelper.readFile(planPath)
      } catch {
        return {
          success: false,
          message:
            '❌ No architect plan found.\n\n' +
            'Create a plan first:\n' +
            '  1. Run /p:init in an empty directory\n' +
            '  2. Answer the discovery questions\n' +
            '  3. Plan will be auto-generated\n' +
            '  4. Then run /p:architect execute',
        }
      }

      if (!planContent || planContent.trim() === '') {
        return {
          success: false,
          message: '❌ Architect plan is empty',
        }
      }

      console.log('📋 Reading architect plan...\n')

      const ideaMatch = planContent.match(/## Project Idea\n(.+)/s)
      const stackMatch = planContent.match(/\*\*Stack:\*\*\n([\s\S]+?)\n\n/)
      const stepsMatch = planContent.match(/\*\*Implementation Steps:\*\*\n([\s\S]+?)\n\n/)

      const idea = ideaMatch ? ideaMatch[1].split('\n')[0].trim() : 'Unknown project'
      const stack = stackMatch ? stackMatch[1] : 'Not specified'
      const steps = stepsMatch ? stepsMatch[1] : 'Not specified'

      console.log(`📝 Project: ${idea}`)
      console.log(`\n🔧 Stack:\n${stack}`)
      console.log(`\n📋 Implementation Steps:\n${steps}`)

      console.log('\n' + '='.repeat(60))
      console.log('🤖 READY TO GENERATE CODE')
      console.log('='.repeat(60))

      console.log(
        '\nThe architect plan is ready. Claude will now:\n' +
          '  1. Read the architectural plan\n' +
          '  2. Use Context7 for official documentation\n' +
          '  3. Generate project structure\n' +
          '  4. Create starter files with boilerplate\n'
      )

      console.log('\n💡 This command shows the plan.')
      console.log('   For code generation, Claude Code will read this plan')
      console.log('   and generate the structure automatically.\n')

      await this.logToMemory(projectPath, 'architect_executed', {
        timestamp: dateHelper.getTimestamp(),
        idea,
      })

      return {
        success: true,
        plan: planContent,
        idea,
      }
    } catch (error) {
      console.error('❌ Error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
