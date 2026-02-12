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
import out from '../utils/output'

// ============================================================================
// Types
// ============================================================================

export type ProjectType =
  | 'web-app'
  | 'api-backend'
  | 'fullstack'
  | 'cli-tool'
  | 'library'
  | 'monorepo'
  | 'unknown'

export type AIAgent = 'claude' | 'cursor' | 'windsurf' | 'copilot' | 'gemini'

export interface DetectedStack {
  language: string
  framework?: string
  runtime?: string
  packageManager?: string
  technologies: string[]
}

export interface WizardPreferences {
  verbosity: 'minimal' | 'normal' | 'verbose'
  autoSync: boolean
  telemetry: boolean
}

export interface WizardResult {
  projectType: ProjectType
  agents: AIAgent[]
  stack: DetectedStack
  preferences: WizardPreferences
  skipped: boolean
}

export interface WizardStep {
  id: string
  title: string
  run: () => Promise<boolean> // Returns true if should continue, false to abort
}

// ============================================================================
// Constants
// ============================================================================

const PROJECT_TYPES: { value: ProjectType; title: string; description: string }[] = [
  { value: 'web-app', title: 'Web Application', description: 'React, Vue, Angular, Next.js, etc.' },
  {
    value: 'api-backend',
    title: 'API / Backend Service',
    description: 'Express, Hono, FastAPI, etc.',
  },
  {
    value: 'fullstack',
    title: 'Full-Stack (Monorepo)',
    description: 'Frontend + Backend in one repo',
  },
  { value: 'cli-tool', title: 'CLI Tool', description: 'Command-line application' },
  { value: 'library', title: 'Library / Package', description: 'Reusable npm/pip/cargo package' },
  {
    value: 'monorepo',
    title: 'Monorepo (Multiple Projects)',
    description: 'Turborepo, Nx, Lerna, etc.',
  },
]

const AI_AGENTS: { value: AIAgent; title: string; description: string }[] = [
  { value: 'claude', title: 'Claude Code', description: "Anthropic's Claude in VS Code/CLI" },
  { value: 'cursor', title: 'Cursor', description: 'AI-first code editor' },
  { value: 'windsurf', title: 'Windsurf', description: "Codeium's AI IDE" },
  { value: 'copilot', title: 'GitHub Copilot', description: "GitHub's AI pair programmer" },
  { value: 'gemini', title: 'Gemini CLI', description: "Google's Gemini in terminal" },
]

// ============================================================================
// OnboardingWizard Class
// ============================================================================

export class OnboardingWizard {
  private projectPath: string
  private currentStep: number = 0
  private totalSteps: number = 5
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

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Run the full wizard flow
   */
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
      this.currentStep++

      const shouldContinue = await step.run()

      if (!shouldContinue || this.aborted) {
        return this.buildResult(true)
      }
    }

    p.outro(chalk.green('Setup complete!'))
    return this.buildResult(false)
  }

  /**
   * Run in non-interactive mode (--yes flag)
   * Uses all auto-detected values without prompting
   */
  async runNonInteractive(): Promise<WizardResult> {
    out.spin('Auto-detecting project configuration...')

    // Auto-detect everything
    this.detectedType = await this.detectProjectType()
    this.confirmedType = this.detectedType
    this.selectedAgents = ['claude'] // Default to Claude
    this.detectedStack = await this.detectStack()
    this.confirmedStack = this.detectedStack
    // Use default preferences

    out.done('Configuration detected')

    return this.buildResult(false)
  }

  // ==========================================================================
  // Step Implementations
  // ==========================================================================

  /**
   * Step 1: Project Type Detection + Confirmation
   */
  private async stepProjectType(): Promise<boolean> {
    this.detectedType = await this.detectProjectType()

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

  /**
   * Step 2: AI Agent Selection (multi-select)
   */
  private async stepAIAgents(): Promise<boolean> {
    const detectedAgents = await this.detectInstalledAgents()

    const agents = await p.multiselect({
      message: 'Which AI agents do you use?',
      options: AI_AGENTS.map((agent) => ({
        label: agent.title,
        hint: agent.description,
        value: agent.value,
      })),
      initialValues: detectedAgents,
      required: true,
    })

    if (p.isCancel(agents)) {
      this.handleCancel()
      return false
    }

    this.selectedAgents = agents.length > 0 ? agents : ['claude']
    return true
  }

  /**
   * Step 3: Stack Detection + Confirmation
   */
  private async stepStack(): Promise<boolean> {
    this.detectedStack = await this.detectStack()

    const stackDisplay = this.formatStackDisplay(this.detectedStack)
    p.note(stackDisplay, 'Detected stack')

    const confirmed = await p.confirm({
      message: 'Is this stack correct?',
      initialValue: true,
    })

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
        {
          onCancel: () => {
            this.handleCancel()
          },
        }
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

  /**
   * Step 4: Preferences Collection
   */
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
          p.confirm({
            message: 'Auto-sync context on file changes?',
            initialValue: true,
          }),
      },
      {
        onCancel: () => {
          this.handleCancel()
        },
      }
    )

    if (this.aborted) return false

    this.preferences = {
      verbosity: prefs.verbosity || 'normal',
      autoSync: prefs.autoSync ?? true,
      telemetry: false,
    }

    return true
  }

  /**
   * Step 5: Summary + Generation
   */
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

  // ==========================================================================
  // Detection Methods
  // ==========================================================================

  /**
   * Detect project type from file system
   */
  async detectProjectType(): Promise<ProjectType> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    try {
      const files = await fs.readdir(this.projectPath)

      // Check for monorepo indicators
      if (
        files.includes('turbo.json') ||
        files.includes('lerna.json') ||
        files.includes('nx.json')
      ) {
        return 'monorepo'
      }

      // Check for package.json
      if (files.includes('package.json')) {
        const pkgPath = path.join(this.projectPath, 'package.json')
        const pkgContent = await fs.readFile(pkgPath, 'utf-8')
        const pkg = JSON.parse(pkgContent)

        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        // CLI tool indicators
        if (pkg.bin) return 'cli-tool'

        // Library indicators
        if (pkg.main && !deps.react && !deps.vue && !deps.angular && !deps.express && !deps.hono) {
          return 'library'
        }

        // Full-stack indicators
        if ((deps.react || deps.vue) && (deps.express || deps.hono || deps.fastify)) {
          return 'fullstack'
        }

        // Frontend indicators
        if (deps.react || deps.vue || deps['@angular/core'] || deps.next || deps.nuxt) {
          return 'web-app'
        }

        // Backend indicators
        if (deps.express || deps.hono || deps.fastify || deps.koa || deps.nestjs) {
          return 'api-backend'
        }
      }

      // Python project detection
      if (files.includes('pyproject.toml') || files.includes('setup.py')) {
        const hasServer = files.some((f) => ['main.py', 'app.py', 'server.py'].includes(f))
        return hasServer ? 'api-backend' : 'library'
      }

      // Go project detection
      if (files.includes('go.mod')) {
        return files.includes('main.go') ? 'cli-tool' : 'library'
      }

      // Rust project detection
      if (files.includes('Cargo.toml')) {
        return 'cli-tool' // Most Rust CLIs
      }

      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Detect installed AI agents from config files
   */
  async detectInstalledAgents(): Promise<AIAgent[]> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')
    const os = await import('node:os')

    const agents: AIAgent[] = []

    // Claude Code: Check ~/.claude directory
    try {
      await fs.access(path.join(os.homedir(), '.claude'))
      agents.push('claude')
    } catch {
      /* not installed */
    }

    // Cursor: Check for .cursorrules in project
    try {
      await fs.access(path.join(this.projectPath, '.cursorrules'))
      agents.push('cursor')
    } catch {
      /* not installed */
    }

    // Windsurf: Check for .windsurfrules
    try {
      await fs.access(path.join(this.projectPath, '.windsurfrules'))
      agents.push('windsurf')
    } catch {
      /* not installed */
    }

    // Copilot: Check for .github/copilot-instructions.md
    try {
      await fs.access(path.join(this.projectPath, '.github', 'copilot-instructions.md'))
      agents.push('copilot')
    } catch {
      /* not installed */
    }

    // Gemini: Check ~/.gemini
    try {
      await fs.access(path.join(os.homedir(), '.gemini'))
      agents.push('gemini')
    } catch {
      /* not installed */
    }

    // Default to Claude if nothing detected
    return agents.length > 0 ? agents : ['claude']
  }

  /**
   * Detect tech stack from project files
   */
  async detectStack(): Promise<DetectedStack> {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    const stack: DetectedStack = {
      language: 'Unknown',
      technologies: [],
    }

    try {
      const files = await fs.readdir(this.projectPath)

      // Language detection
      if (files.includes('package.json')) {
        const pkgPath = path.join(this.projectPath, 'package.json')
        const pkgContent = await fs.readFile(pkgPath, 'utf-8')
        const pkg = JSON.parse(pkgContent)

        const deps = { ...pkg.dependencies, ...pkg.devDependencies }

        // TypeScript check
        stack.language = deps.typescript ? 'TypeScript' : 'JavaScript'

        // Framework detection
        if (deps.next) stack.framework = 'Next.js'
        else if (deps.nuxt) stack.framework = 'Nuxt'
        else if (deps.react) stack.framework = 'React'
        else if (deps.vue) stack.framework = 'Vue'
        else if (deps['@angular/core']) stack.framework = 'Angular'
        else if (deps.express) stack.framework = 'Express'
        else if (deps.hono) stack.framework = 'Hono'
        else if (deps.fastify) stack.framework = 'Fastify'
        else if (deps.nestjs || deps['@nestjs/core']) stack.framework = 'NestJS'

        // Runtime detection
        if (deps.bun || deps['@types/bun']) stack.runtime = 'Bun'
        else if (pkg.engines?.bun) stack.runtime = 'Bun'
        else stack.runtime = 'Node.js'

        // Package manager detection
        if (files.includes('bun.lockb')) stack.packageManager = 'Bun'
        else if (files.includes('pnpm-lock.yaml')) stack.packageManager = 'pnpm'
        else if (files.includes('yarn.lock')) stack.packageManager = 'Yarn'
        else if (files.includes('package-lock.json')) stack.packageManager = 'npm'

        // Additional technologies
        if (deps.prisma || deps['@prisma/client']) stack.technologies.push('Prisma')
        if (deps.drizzle || deps['drizzle-orm']) stack.technologies.push('Drizzle')
        if (deps.tailwindcss) stack.technologies.push('Tailwind CSS')
        if (deps.zod) stack.technologies.push('Zod')
        if (deps.trpc || deps['@trpc/server']) stack.technologies.push('tRPC')
      } else if (files.includes('pyproject.toml') || files.includes('requirements.txt')) {
        stack.language = 'Python'
        // Could parse pyproject.toml for framework detection
      } else if (files.includes('go.mod')) {
        stack.language = 'Go'
      } else if (files.includes('Cargo.toml')) {
        stack.language = 'Rust'
      } else if (files.includes('pom.xml') || files.includes('build.gradle')) {
        stack.language = 'Java'
      }

      return stack
    } catch {
      return stack
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

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

  // ==========================================================================
  // Getters for external access
  // ==========================================================================

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

export default OnboardingWizard
