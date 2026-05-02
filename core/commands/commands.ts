/**
 * prjct CLI Commands Handler
 *
 * MD-First Architecture - All state in Markdown files.
 *
 * COMMANDS:
 * - Workflow: done, next, pause, resume
 * - Planning: init, bug, idea, spec
 * - Shipping: ship
 * - Analytics: dash, help
 * - Maintenance: cleanup, design, recover, undo, redo, history
 * - Analysis: analyze, sync
 * - Setup: start, setup
 * - Context: context
 */

import type { AgentInfo } from '../types/agents'
import type { AnalyzeOptions, Author, CommandResult, SetupOptions } from '../types/commands'
import { AnalysisCommands } from './analysis'
import { CaptureCommands } from './capture'
import { ContextCommands } from './context'
import { InstallCommands } from './install'
import { McpCommands } from './mcp'
import { PlanningCommands } from './planning'
import { PrimitiveCommands } from './primitives'
import { SeedCommands } from './seed'
import { SetupCommands } from './setup'
import { ShippingCommands } from './shipping'
import { UpdateCommands } from './update'
import { WorkflowCommands } from './workflow'

/**
 * PrjctCommands - Combined class with all commands
 * Uses mixins pattern to combine all command groups
 */
class PrjctCommands {
  // Instances of each command group
  private workflow: WorkflowCommands
  private planning: PlanningCommands
  private shipping: ShippingCommands
  private analysis: AnalysisCommands
  private setupCmds: SetupCommands
  private updateCmds: UpdateCommands
  private contextCmds: ContextCommands
  private primitivesCmds: PrimitiveCommands
  private seedCmds: SeedCommands
  private installCmds: InstallCommands
  private captureCmds: CaptureCommands
  private mcpCmds: McpCommands

  // Shared state
  agent: unknown
  agentInfo: AgentInfo | null
  currentAuthor: Author | null
  prjctDir: string

  constructor() {
    this.workflow = new WorkflowCommands()
    this.planning = new PlanningCommands()
    this.shipping = new ShippingCommands()
    this.analysis = new AnalysisCommands()
    this.setupCmds = new SetupCommands()
    this.updateCmds = new UpdateCommands()
    this.contextCmds = new ContextCommands()
    this.primitivesCmds = new PrimitiveCommands()
    this.seedCmds = new SeedCommands()
    this.installCmds = new InstallCommands()
    this.captureCmds = new CaptureCommands()
    this.mcpCmds = new McpCommands()

    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
  }

  // ========== Workflow Commands ==========

  async task(
    description: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; skipHooks?: boolean } = {}
  ): Promise<CommandResult> {
    return this.workflow.now(description, projectPath, options)
  }

  async workflowPrefs(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.workflow.workflow(input, projectPath, options)
  }

  // ========== Planning Commands ==========

  async init(
    optionsOrIdea: import('../types/commands').InitOptions | string | null = null,
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    return this.planning.init(optionsOrIdea, projectPath)
  }

  // ========== Shipping Commands ==========

  async ship(
    feature: string | null,
    projectPath: string = process.cwd(),
    options: {
      md?: boolean
      skipHooks?: boolean
      intent?: 'register-only' | 'seed-code-workflow' | 'proceed'
    } = {}
  ): Promise<CommandResult> {
    return this.shipping.ship(feature, projectPath, { ...options })
  }

  // ========== Analysis Commands ==========

  async analyze(
    options: AnalyzeOptions = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    return this.analysis.analyze(options, projectPath)
  }

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
    return this.analysis.sync(projectPath, options)
  }

  async saveLlmAnalysis(
    analysisJson: string,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.analysis.saveLlmAnalysis(analysisJson, projectPath, options)
  }

  async regenVault(
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.analysis.regenVault(projectPath, options)
  }

  // ========== Context Commands ==========

  async context(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.contextCmds.context(input, projectPath, options)
  }

  // ========== v2 Primitives ==========

  async status(
    value: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.primitivesCmds.status(value, projectPath, options)
  }

  async tag(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.primitivesCmds.tag(args, projectPath, options)
  }

  async remember(
    args: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; tags?: string } = {}
  ): Promise<CommandResult> {
    return this.primitivesCmds.remember(args, projectPath, options)
  }

  // v2 alpha.8: declarative packs + Claude Code hook install
  async seed(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.seedCmds.seed(input, projectPath, options)
  }

  async install(
    _arg: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.installCmds.install(null, projectPath, options)
  }

  async capture(
    content: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean; tags?: string; force?: boolean } = {}
  ): Promise<CommandResult> {
    return this.captureCmds.capture(content, projectPath, options)
  }

  async mcp(
    input: string | null = null,
    projectPath: string = process.cwd(),
    options: { md?: boolean } = {}
  ): Promise<CommandResult> {
    return this.mcpCmds.mcp(input, projectPath, options)
  }

  // ========== Auth Commands ==========

  async auth(action: string | null = null, options: { md?: boolean } = {}): Promise<CommandResult> {
    return this.setupCmds.auth(action, options)
  }

  async login(options: { md?: boolean; url?: string } = {}): Promise<CommandResult> {
    return this.setupCmds.login(options)
  }

  async logout(): Promise<CommandResult> {
    return this.setupCmds.logout()
  }

  // ========== Setup Commands ==========

  async start(): Promise<CommandResult> {
    return this.setupCmds.start()
  }

  async setup(options: SetupOptions = {}): Promise<CommandResult> {
    return this.setupCmds.setup(options)
  }

  async update(
    options: { 'dry-run'?: boolean; md?: boolean } = {},
    projectPath: string = process.cwd()
  ): Promise<CommandResult> {
    return this.updateCmds.update(options, projectPath)
  }

  async installStatusLine(): Promise<{ success: boolean; error?: string }> {
    return this.setupCmds.installStatusLine()
  }

  showAsciiArt(): void {
    this.setupCmds.showAsciiArt()
  }

  // ========== Delegated Base Methods ==========

  async initializeAgent(): Promise<unknown> {
    return this.workflow.initializeAgent()
  }

  async ensureProjectInit(projectPath: string): Promise<CommandResult> {
    return this.workflow.ensureProjectInit(projectPath)
  }

  async ensureAuthor(): Promise<Author> {
    return this.workflow.ensureAuthor()
  }

  async getGlobalProjectPath(projectPath: string): Promise<string> {
    return this.workflow.getGlobalProjectPath(projectPath)
  }

  async logToMemory(
    projectPath: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    return this.workflow.logToMemory(projectPath, action, data)
  }
}

// Export both class and singleton instance
const instance = new PrjctCommands()

export default instance
export { PrjctCommands }
