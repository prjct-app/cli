/**
 * Planning Commands: init, feature, bug, idea, spec
 * Write-Through Architecture: JSON → MD → Event
 */

import path from 'path'

import type { CommandResult, AnalyzeOptions, Context } from './types'
import { generateUUID } from '../schemas'
import type { Priority, TaskType, TaskSection } from '../schemas/state'
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
import { queueStorage, ideasStorage } from '../storage'
import authorDetector from '../infrastructure/author-detector'
import commandInstaller from '../infrastructure/command-installer'

// Lazy-loaded to avoid circular dependencies
let _analysisCommands: import('./analysis').AnalysisCommands | null = null
async function getAnalysisCommands(): Promise<import('./analysis').AnalysisCommands> {
  if (!_analysisCommands) {
    const { AnalysisCommands } = await import('./analysis')
    _analysisCommands = new AnalysisCommands()
  }
  return _analysisCommands
}

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
        const analysis = await getAnalysisCommands()
        const analysisResult = await analysis.analyze({}, projectPath)

        if (analysisResult.success) {
          out.spin('generating agents...')
          await analysis.sync(projectPath)
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

        await commandInstaller.installGlobalConfig()

        out.done('architect mode ready')
        return { success: true, mode: 'architect', projectId, idea }
      }

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

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      out.spin(`planning ${description}...`)

      const context = await contextBuilder.build(projectPath, { description }) as Context
      const tasks = this._breakdownFeatureTasks(description)
      const featureId = generateUUID()

      const tasksWithAgents: { task: string; agent: string }[] = []
      for (const taskDesc of tasks) {
        const agentResult = await this._assignAgentForTask(taskDesc, projectPath, context)
        const agent = agentResult.agent?.name || 'generalist'
        tasksWithAgents.push({ task: taskDesc, agent })
      }

      // Write-through: Add tasks (JSON → MD → Event)
      await queueStorage.addTasks(projectId, tasksWithAgents.map(t => ({
        description: t.task,
        priority: 'medium' as Priority,
        type: 'feature' as TaskType,
        section: 'active' as TaskSection,
        featureId,
        originFeature: description,
        agent: t.agent
      })))

      await this.logToMemory(projectPath, 'feature_planned', {
        feature: description,
        featureId,
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

      return { success: true, feature: description, featureId, tasks: tasksWithAgents }
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

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      out.spin('tracking bug...')

      const context = await contextBuilder.build(projectPath, { description }) as Context
      const severity = this._detectBugSeverity(description)

      const agentResult = await this._assignAgentForTask(`fix bug: ${description}`, projectPath, context)
      const agent = agentResult.agent?.name || 'generalist'

      // Map severity to Priority type
      const priorityMap: Record<string, Priority> = {
        'critical': 'critical',
        'high': 'high',
        'medium': 'medium',
        'low': 'low'
      }
      const priority = priorityMap[severity] || 'medium'

      // Write-through: Add bug task (JSON → MD → Event)
      await queueStorage.addTask(projectId, {
        description: `🐛 ${description}`,
        priority,
        type: 'bug' as TaskType,
        section: 'active' as TaskSection,
        agent
      })

      await this.logToMemory(projectPath, 'bug_reported', {
        bug: description,
        severity,
        priority,
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

  /**
   * /p:idea - Transform ideas into architectures or quick captures
   */
  async idea(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        out.fail('idea description required')
        return { success: false, error: 'Idea description required' }
      }

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      // Determine if simple or complex idea
      const wordCount = description.split(/\s+/).length
      const isComplex = wordCount > 20 || description.includes('with') || description.includes('that')

      if (isComplex) {
        // Complex idea → Create architecture session
        out.spin('analyzing idea...')

        const globalPath = pathManager.getGlobalProjectPath(projectId)
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session

## Idea
${description}

## Status
Initialized - awaiting architecture design

## Next Steps
1. Define tech stack
2. Create system design
3. Break down into features
4. Generate roadmap

Generated: ${new Date().toLocaleString()}
`
        await toolRegistry.get('Write')!(sessionPath, sessionContent)

        await this.logToMemory(projectPath, 'idea_architecture_started', {
          idea: description,
          timestamp: dateHelper.getTimestamp(),
        })

        out.done('architecture session created')
        console.log('\n💡 Use /p:architect execute to continue planning\n')

        return { success: true, mode: 'architecture', idea: description }
      } else {
        // Simple idea → Quick capture (JSON → MD → Event)
        out.spin('capturing idea...')

        await ideasStorage.addIdea(projectId, description)

        await this.logToMemory(projectPath, 'idea_captured', {
          idea: description,
          timestamp: dateHelper.getTimestamp(),
        })

        out.done(`idea captured: ${description.slice(0, 40)}`)

        return { success: true, mode: 'capture', idea: description }
      }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }

  /**
   * /p:spec - Create detailed specifications for complex features
   */
  async spec(featureName: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.fail('no project ID')
        return { success: false, error: 'No project ID found' }
      }

      if (!featureName) {
        // List existing specs
        out.spin('loading specs...')

        const globalPath = pathManager.getGlobalProjectPath(projectId)
        const specsPath = path.join(globalPath, 'planning', 'specs')

        try {
          const fs = await import('fs/promises')
          const files = await fs.readdir(specsPath)
          const specs = files.filter(f => f.endsWith('.md') && f !== '.gitkeep')

          if (specs.length === 0) {
            out.warn('no specs yet')
            console.log('\n💡 Create one with /p:spec "feature name"\n')
            return { success: true, specs: [] }
          }

          console.log('\n📋 SPECIFICATIONS\n')
          console.log('═'.repeat(50))
          specs.forEach((s, i) => {
            const name = s.replace('.md', '').replace(/-/g, ' ')
            console.log(`  ${i + 1}. ${name}`)
          })
          console.log('═'.repeat(50) + '\n')

          return { success: true, specs }
        } catch {
          out.warn('no specs directory')
          return { success: true, specs: [] }
        }
      }

      // Create new spec
      out.spin('creating spec...')

      const globalPath = pathManager.getGlobalProjectPath(projectId)
      const specsPath = path.join(globalPath, 'planning', 'specs')
      await fileHelper.ensureDir(specsPath)

      const slug = featureName.toLowerCase().replace(/\s+/g, '-')
      const specFile = path.join(specsPath, `${slug}.md`)

      const specContent = `# Specification: ${featureName}

## Overview
[Brief description of the feature]

## Requirements
- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3

## Design Decisions
| Decision | Rationale |
|----------|-----------|
| | |

## Tasks (20-30 min each)
1. [ ] Task 1 - [description]
2. [ ] Task 2 - [description]
3. [ ] Task 3 - [description]

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Notes
[Additional notes and considerations]

---
Created: ${new Date().toLocaleString()}
Status: Draft
`

      await toolRegistry.get('Write')!(specFile, specContent)

      await this.logToMemory(projectPath, 'spec_created', {
        feature: featureName,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`spec created: ${slug}.md`)
      console.log(`\n📝 Edit: ~/.prjct-cli/projects/${projectId}/planning/specs/${slug}.md`)
      console.log('💡 When ready, use /p:feature to add tasks to queue\n')

      return { success: true, feature: featureName, specPath: specFile }
    } catch (error) {
      out.fail((error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  }
}
