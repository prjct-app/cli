/**
 * Planning Commands: init, feature, bug, idea, spec
 * Write-Through Architecture: JSON → MD → Event
 */

import path from 'node:path'
import * as authorDetector from '../infrastructure/author-detector'
import commandInstaller from '../infrastructure/command-installer'
import { generateUUID } from '../schemas/schemas'
import type { Priority, TaskSection, TaskType } from '../schemas/state'
import { ideasStorage } from '../storage/ideas-storage'
import { queueStorage } from '../storage/queue-storage'
import { workflowRuleStorage } from '../storage/workflow-rule-storage'
import type { CommandResult, InitOptions } from '../types/commands'
import { getErrorMessage } from '../types/fs'
import { mdNextSteps, mdOutput, mdSection, mdStats } from '../utils/md-formatter'
import { showNextSteps } from '../utils/next-steps'
import { detectProjectCommands } from '../utils/project-commands'
import { OnboardingWizard } from '../workflows/onboarding'
import {
  configManager,
  dateHelper,
  fileHelper,
  out,
  PrjctCommandsBase,
  pathManager,
  toolRegistry,
} from './base'

// Lazy-loaded to avoid circular dependencies
let _analysisCommands: import('./analysis').AnalysisCommands | null = null
async function getAnalysisCommands(): Promise<import('./analysis').AnalysisCommands> {
  if (!_analysisCommands) {
    const { AnalysisCommands } = await import('./analysis')
    _analysisCommands = new AnalysisCommands()
  }
  return _analysisCommands
}

export type { InitOptions } from '../types/commands'

export class PlanningCommands extends PrjctCommandsBase {
  /**
   * /p:init - Initialize prjct project with interactive wizard
   *
   * @param options.yes - Skip wizard, use auto-detected values (for CI)
   * @param options.idea - Initial idea for architect mode
   * @param projectPath - Project directory path
   */
  async init(
    options: InitOptions | string | null = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      // Handle legacy signature: init(idea, projectPath)
      let opts: InitOptions = {}
      if (typeof options === 'string' || options === null) {
        opts = { idea: options }
      } else {
        opts = options
      }

      await this.initializeAgent()

      const isConfigured = await configManager.isConfigured(projectPath)

      if (isConfigured) {
        out.warn('already initialized')
        return { success: false, message: 'Already initialized' }
      }

      // Determine if we should run interactive wizard
      const isTTY = process.stdout.isTTY && process.stdin.isTTY
      // CI: Skip interactive prompts in CI environments
      const skipWizard = opts.yes || !isTTY || process.env.CI === 'true'

      // Run wizard if interactive
      let wizardResult = null
      if (!skipWizard) {
        const wizard = new OnboardingWizard(projectPath)
        wizardResult = await wizard.run()

        if (wizardResult.skipped) {
          return { success: false, message: 'Setup cancelled' }
        }
      } else if (isTTY && opts.yes) {
        // Non-interactive but show progress
        const wizard = new OnboardingWizard(projectPath)
        wizardResult = await wizard.runNonInteractive()
      }

      out.step(1, 4, 'Detecting author...')

      const detectedAuthor = await authorDetector.detect()
      // Convert null to undefined for createConfig
      const author = {
        name: detectedAuthor.name || undefined,
        email: detectedAuthor.email || undefined,
        github: detectedAuthor.github || undefined,
      }
      const config = await configManager.createConfig(projectPath, author)
      const projectId = config.projectId

      out.step(2, 4, 'Creating structure...')

      await pathManager.ensureProjectStructure(projectId)
      const globalPath = pathManager.getGlobalProjectPath(projectId)

      // Seed default workflow rules for ship
      await this._seedShipWorkflow(projectId, projectPath)

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
        'memory/patterns.json': JSON.stringify(
          {
            version: 1,
            decisions: {},
            preferences: {},
            workflows: {},
            counters: {},
          },
          null,
          2
        ),
      }

      // Save wizard preferences if available
      if (wizardResult) {
        baseFiles['config/wizard.json'] = JSON.stringify(
          {
            projectType: wizardResult.projectType,
            agents: wizardResult.agents,
            stack: wizardResult.stack,
            preferences: wizardResult.preferences,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        )
      }

      for (const [filePath, content] of Object.entries(baseFiles)) {
        await toolRegistry.get('Write')!(path.join(globalPath, filePath), content)
      }

      const isEmpty = await this._detectEmptyDirectory(projectPath)
      const hasCode = await this._detectExistingCode(projectPath)

      if (hasCode || !isEmpty) {
        out.step(3, 4, 'Analyzing project...')
        const analysis = await getAnalysisCommands()
        const analysisResult = await analysis.analyze({}, projectPath)

        if (analysisResult.success) {
          out.step(4, 4, 'Generating agents...')

          // Pass wizard agent selection to sync if available
          await analysis.sync(projectPath)

          out.done('initialized')
          this._printNextSteps(wizardResult)
          return { success: true, mode: 'existing', projectId, wizard: wizardResult }
        }
      }

      const idea = opts.idea
      if (isEmpty && !hasCode) {
        if (!idea) {
          out.done('blank project - provide idea for architect mode')
          return { success: true, mode: 'blank_no_idea', projectId, wizard: wizardResult }
        }

        out.spin('architect mode...')
        const sessionPath = path.join(globalPath, 'planning', 'architect-session.md')
        const sessionContent = `# Architect Session\n\n## Idea\n${idea}\n\n## Status\nInitialized - awaiting stack recommendation\n\nGenerated: ${new Date().toLocaleString()}\n`
        await toolRegistry.get('Write')!(sessionPath, sessionContent)

        await commandInstaller.installGlobalConfig()

        out.done('architect mode ready')
        return { success: true, mode: 'architect', projectId, idea, wizard: wizardResult }
      }

      await commandInstaller.installGlobalConfig()

      out.done('initialized')
      this._printNextSteps(wizardResult)
      return { success: true, projectId, wizard: wizardResult }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Print next steps after initialization
   */
  private _printNextSteps(wizardResult: import('../types/workflows').WizardResult | null): void {
    console.log('')
    console.log('  Quick start:')
    console.log('    prjct sync     Update context after changes')
    console.log('    prjct task     Start working on a task')
    console.log('    prjct hooks    Auto-sync on commit/checkout')
    console.log('')

    if (wizardResult) {
      const agentFiles = wizardResult.agents
        .map((a) => {
          switch (a) {
            case 'claude':
              return 'CLAUDE.md'
            case 'cursor':
              return '.cursorrules'
            case 'windsurf':
              return '.windsurfrules'
            case 'copilot':
              return '.github/copilot-instructions.md'
            case 'gemini':
              return 'GEMINI.md'
            case 'codex':
              return 'AGENTS.md'
            default:
              return null
          }
        })
        .filter(Boolean)

      if (agentFiles.length > 0) {
        console.log(`  Generated: ${agentFiles.join(', ')}`)
        console.log('')
      }
    }

    console.log('  Docs: https://prjct.app/docs')
    console.log('')
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
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      out.spin(`planning ${description}...`)

      const tasks = this._breakdownFeatureTasks(description)
      const featureId = generateUUID()

      // Write-through: Add tasks (JSON → MD → Event)
      await queueStorage.addTasks(
        projectId,
        tasks.map((task) => ({
          description: task,
          priority: 'medium' as Priority,
          type: 'feature' as TaskType,
          section: 'active' as TaskSection,
          featureId,
          originFeature: description,
        }))
      )

      await this.logToMemory(projectPath, 'feature_planned', {
        feature: description,
        featureId,
        tasks: tasks.length,
        timestamp: dateHelper.getTimestamp(),
      })

      out.done(`${tasks.length} tasks planned`)

      return { success: true, feature: description, featureId, tasks }
    } catch (error) {
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:bug - Report and track bugs with auto-prioritization
   */
  async bug(
    description: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        if (!options.md) out.fail('bug description required')
        return { success: false, error: 'Description required' }
      }

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (!options.md) out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      if (!options.md) out.spin('tracking bug...')

      const severity = this._detectBugSeverity(description)

      // Map severity to Priority type
      const priorityMap: Record<string, Priority> = {
        critical: 'critical',
        high: 'high',
        medium: 'medium',
        low: 'low',
      }
      const priority = priorityMap[severity] || 'medium'

      // Write-through: Add bug task (JSON → MD → Event)
      await queueStorage.addTask(projectId, {
        description: `🐛 ${description}`,
        priority,
        type: 'bug' as TaskType,
        section: 'active' as TaskSection,
      })

      await this.logToMemory(projectPath, 'bug_reported', {
        bug: description,
        severity,
        priority,
        timestamp: dateHelper.getTimestamp(),
      })

      if (options.md) {
        console.log(
          mdOutput(
            mdSection('Bug Reported', description),
            mdStats({ Severity: severity, Priority: priority }),
            mdNextSteps([
              { label: 'Fix now', command: `prjct task "fix: ${description}" --md` },
              { label: 'View queue', command: 'prjct next --md' },
            ])
          )
        )
      } else {
        out.done(`bug [${severity}] [${priority}]`)
        showNextSteps('bug')
      }

      return { success: true, bug: description, severity }
    } catch (error) {
      if (!options.md) out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:architect - Execute architect plan and generate code
   */
  async architect(
    action: string = 'execute',
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
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
      } catch (_error) {
        // No plan file - expected for projects without architect mode
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

      console.log(`\n${'='.repeat(60)}`)
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
      console.error('❌ Error:', getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:idea - Transform ideas into architectures or quick captures
   */
  async idea(
    description: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      if (!description) {
        if (!options.md) out.fail('idea description required')
        return { success: false, error: 'Idea description required' }
      }

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        if (!options.md) out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      // Determine if simple or complex idea
      const wordCount = description.split(/\s+/).length
      const isComplex =
        wordCount > 20 || description.includes('with') || description.includes('that')

      if (isComplex) {
        // Complex idea → Create architecture session
        if (!options.md) out.spin('analyzing idea...')

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

        if (options.md) {
          console.log(
            mdOutput(
              mdSection('Idea Captured', description),
              mdStats({ Mode: 'architecture' }),
              mdNextSteps([{ label: 'Continue planning', command: 'prjct architect execute' }])
            )
          )
        } else {
          out.done('architecture session created')
          console.log('\n💡 Use /p:architect execute to continue planning\n')
        }

        return { success: true, mode: 'architecture', idea: description }
      } else {
        // Simple idea → Quick capture (JSON → MD → Event)
        if (!options.md) out.spin('capturing idea...')

        await ideasStorage.addIdea(projectId, description)

        await this.logToMemory(projectPath, 'idea_captured', {
          idea: description,
          timestamp: dateHelper.getTimestamp(),
        })

        if (options.md) {
          console.log(
            mdOutput(
              mdSection('Idea Captured', description),
              mdStats({ Mode: 'capture' }),
              mdNextSteps([
                { label: 'Start working on it', command: `prjct task "${description}" --md` },
                { label: 'View ideas', command: 'prjct dash ideas' },
              ])
            )
          )
        } else {
          out.done(`idea captured: ${description.slice(0, 40)}`)
          showNextSteps('idea')
        }

        return { success: true, mode: 'capture', idea: description }
      }
    } catch (error) {
      if (!options.md) out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * /p:spec - Create detailed specifications for complex features
   */
  async spec(
    featureName: string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    try {
      const initResult = await this.ensureProjectInit(projectPath)
      if (!initResult.success) return initResult

      const projectId = await configManager.getProjectId(projectPath)
      if (!projectId) {
        out.failWithHint('NO_PROJECT_ID')
        return { success: false, error: 'No project ID found' }
      }

      if (!featureName) {
        // List existing specs
        out.spin('loading specs...')

        const globalPath = pathManager.getGlobalProjectPath(projectId)
        const specsPath = path.join(globalPath, 'planning', 'specs')

        try {
          const fs = await import('node:fs/promises')
          const files = await fs.readdir(specsPath)
          const specs = files.filter((f) => f.endsWith('.md') && f !== '.gitkeep')

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
          console.log(`${'═'.repeat(50)}\n`)

          return { success: true, specs }
        } catch (_error) {
          // No specs directory - expected for new projects
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
      out.fail(getErrorMessage(error))
      return { success: false, error: getErrorMessage(error) }
    }
  }

  /**
   * Seed default workflow rules for ship command.
   * Creates sensible defaults based on detected project tools.
   */
  private async _seedShipWorkflow(projectId: string, projectPath: string): Promise<void> {
    const detected = await detectProjectCommands(projectPath)
    let sortOrder = 0

    // Gate: Prevent shipping from main/master
    workflowRuleStorage.addRule(projectId, {
      type: 'gate',
      command: 'ship',
      position: 'before',
      action: 'git branch --show-current | grep -vE "^(main|master)$"',
      description: 'Prevent shipping from main branch',
      enabled: true,
      timeoutMs: 5000,
      sortOrder: sortOrder++,
      createdAt: new Date().toISOString(),
    })

    // Step: Lint (if detected, non-blocking with || true)
    if (detected.lint) {
      workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.lint.command} || true`,
        description: 'Lint code',
        enabled: true,
        timeoutMs: 120000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
    }

    // Step: Test (if detected, non-blocking with || true)
    if (detected.test) {
      workflowRuleStorage.addRule(projectId, {
        type: 'step',
        command: 'ship',
        position: 'before',
        action: `${detected.test.command} || true`,
        description: 'Run tests',
        enabled: true,
        timeoutMs: 300000,
        sortOrder: sortOrder++,
        createdAt: new Date().toISOString(),
      })
    }
  }
}
