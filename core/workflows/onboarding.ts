/**
 * OnboardingWizard - Interactive first-run setup experience
 *
 * Guides new users through project setup in ~60 seconds:
 * 1. Project type detection + confirmation
 * 2. AI agent selection (multi-select)
 * 3. Stack confirmation
 * 4. Preferences collection
 * 5. Generation + summary
 */

import * as p from '@clack/prompts'
import chalk from 'chalk'
import type {
  AIAgent,
  OnboardingDetectedStack as DetectedStack,
  ProjectType,
  WizardPreferences,
  WizardResult,
  WizardStep,
} from '../types/workflows.js'
import out from '../utils/output'
import {
  AI_AGENTS,
  detectInstalledAgents,
  detectProjectType,
  detectStack,
  PROJECT_TYPES,
} from './onboarding/detection'

interface AIAgentOption {
  label: string
  hint: string
  value: string
}

export class OnboardingWizard {
  private projectPath: string
  private aborted: boolean = false

  // Collected data
  private detectedType: ProjectType = 'unknown'
  private confirmedType: ProjectType = 'unknown'
  private selectedAgents: AIAgent[] = []
  private detectedStack: DetectedStack = { language: 'Unknown', technologies: [] }
  private confirmedStack: DetectedStack = { language: 'Unknown', technologies: [] }
  private preferences: WizardPreferences = {
    verbosity: 'normal',
    autoSync: true,
    telemetry: false,
  }

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
  }

  // Public API

  async run(): Promise<WizardResult> {
    p.intro(chalk.cyan.bold('⚡ prjct-cli setup'))

    const steps: WizardStep[] = [
      { id: 'project-type', title: 'Project Type', run: () => this.stepProjectType() },
      { id: 'ai-agents', title: 'AI Agents', run: () => this.stepAIAgents() },
      { id: 'stack', title: 'Stack Confirmation', run: () => this.stepStack() },
      { id: 'preferences', title: 'Preferences', run: () => this.stepPreferences() },
      { id: 'summary', title: 'Summary', run: () => this.stepSummary() },
    ]

    for (const step of steps) {
      const shouldContinue = await step.run()
      if (!shouldContinue || this.aborted) return this.buildResult(true)
    }

    p.outro(chalk.green('Setup complete!'))
    return this.buildResult(false)
  }

  /**
   * Run in non-interactive mode (--yes flag).
   * Uses all auto-detected values without prompting.
   */
  async runNonInteractive(): Promise<WizardResult> {
    out.spin('Auto-detecting project configuration...')

    this.detectedType = await detectProjectType(this.projectPath)
    this.confirmedType = this.detectedType
    const detectedAgents = await detectInstalledAgents(this.projectPath)
    this.selectedAgents = detectedAgents
    this.detectedStack = await detectStack(this.projectPath)
    this.confirmedStack = this.detectedStack

    out.done('Configuration detected')
    return this.buildResult(false)
  }

  // Step Implementations

  private async stepProjectType(): Promise<boolean> {
    this.detectedType = await detectProjectType(this.projectPath)

    const initialIndex = PROJECT_TYPES.findIndex((pt) => pt.value === this.detectedType)

    const projectType = await p.select({
      message:
        this.detectedType !== 'unknown'
          ? `Detected: ${this.getProjectTypeLabel(this.detectedType)}. Is this correct?`
          : 'What type of project is this?',
      options: PROJECT_TYPES.map((pt) => ({
        label: pt.title,
        hint: pt.description,
        value: pt.value,
      })),
      initialValue: initialIndex >= 0 ? PROJECT_TYPES[initialIndex].value : undefined,
    })

    if (p.isCancel(projectType)) {
      this.handleCancel()
      return false
    }

    this.confirmedType = projectType || this.detectedType
    return true
  }

  private async stepAIAgents(): Promise<boolean> {
    const detectedAgents = await detectInstalledAgents(this.projectPath)
    const options: AIAgentOption[] = AI_AGENTS.map((agent) => ({
      label: agent.title,
      hint: agent.description,
      value: agent.value,
    }))

    const agents = await p.multiselect<string>({
      message: 'Which AI agents do you use?',
      options,
      initialValues: detectedAgents,
      required: true,
    })

    if (p.isCancel(agents)) {
      this.handleCancel()
      return false
    }

    this.selectedAgents = agents as AIAgent[]
    return true
  }

  private async stepStack(): Promise<boolean> {
    this.detectedStack = await detectStack(this.projectPath)

    const stackDisplay = this.formatStackDisplay(this.detectedStack)
    p.note(stackDisplay, 'Detected stack')

    const confirmed = await p.confirm({ message: 'Is this stack correct?', initialValue: true })

    if (p.isCancel(confirmed)) {
      this.handleCancel()
      return false
    }

    if (confirmed) {
      this.confirmedStack = this.detectedStack
    } else {
      const manual = await p.group(
        {
          language: () =>
            p.text({
              message: 'Primary language:',
              defaultValue: this.detectedStack.language,
            }),
          framework: () =>
            p.text({
              message: 'Framework (optional):',
              defaultValue: this.detectedStack.framework || '',
            }),
        },
        { onCancel: () => this.handleCancel() }
      )

      if (this.aborted) return false

      this.confirmedStack = {
        ...this.detectedStack,
        language: manual.language || this.detectedStack.language,
        framework: manual.framework || undefined,
      }
    }

    return true
  }

  private async stepPreferences(): Promise<boolean> {
    const prefs = await p.group(
      {
        verbosity: () =>
          p.select({
            message: 'Output verbosity:',
            options: [
              { label: 'Minimal', hint: 'Essential output only', value: 'minimal' as const },
              {
                label: 'Normal (Recommended)',
                hint: 'Balanced information',
                value: 'normal' as const,
              },
              { label: 'Verbose', hint: 'Detailed logging', value: 'verbose' as const },
            ],
            initialValue: 'normal' as const,
          }),
        autoSync: () =>
          p.confirm({ message: 'Auto-sync context on file changes?', initialValue: true }),
      },
      { onCancel: () => this.handleCancel() }
    )

    if (this.aborted) return false

    this.preferences = {
      verbosity: prefs.verbosity || 'normal',
      autoSync: prefs.autoSync ?? true,
      telemetry: false,
    }

    return true
  }

  private async stepSummary(): Promise<boolean> {
    const summaryLines = [
      `${chalk.cyan('Project Type:')} ${this.getProjectTypeLabel(this.confirmedType)}`,
      `${chalk.cyan('AI Agents:')} ${this.selectedAgents.map((a) => this.getAgentLabel(a)).join(', ')}`,
      `${chalk.cyan('Stack:')} ${this.formatStackDisplay(this.confirmedStack)}`,
      `${chalk.cyan('Verbosity:')} ${this.preferences.verbosity}`,
      `${chalk.cyan('Auto-sync:')} ${this.preferences.autoSync ? 'Yes' : 'No'}`,
    ].join('\n')

    p.note(summaryLines, 'Configuration Summary')

    const proceed = await p.confirm({
      message: 'Generate configuration with these settings?',
      initialValue: true,
    })

    if (p.isCancel(proceed) || !proceed) {
      if (p.isCancel(proceed)) this.handleCancel()
      return false
    }

    return true
  }

  // Helpers

  private handleCancel(): void {
    this.aborted = true
    p.cancel('Setup cancelled. Run again anytime.')
  }

  private getProjectTypeLabel(type: ProjectType): string {
    return PROJECT_TYPES.find((pt) => pt.value === type)?.title || 'Unknown'
  }

  private getAgentLabel(agent: AIAgent): string {
    return AI_AGENTS.find((a) => a.value === agent)?.title || agent
  }

  private formatStackDisplay(stack: DetectedStack): string {
    const parts = [stack.language]
    if (stack.framework) parts.push(stack.framework)
    if (stack.runtime && stack.runtime !== 'Node.js') parts.push(stack.runtime)
    if (stack.technologies.length > 0) {
      parts.push(`+ ${stack.technologies.slice(0, 3).join(', ')}`)
    }
    return parts.join(' / ')
  }

  private buildResult(skipped: boolean): WizardResult {
    return {
      projectType: this.confirmedType,
      agents: this.selectedAgents,
      stack: this.confirmedStack,
      preferences: this.preferences,
      skipped,
    }
  }

  // Getters for external access

  getSelectedAgents(): AIAgent[] {
    return this.selectedAgents
  }

  getConfirmedStack(): DetectedStack {
    return this.confirmedStack
  }

  getPreferences(): WizardPreferences {
    return this.preferences
  }
}
