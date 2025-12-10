/**
 * Agentic Commands Handler for prjct CLI
 *
 * 100% AGENTIC - Claude decides everything based on templates.
 * ZERO if/else business logic.
 *
 * All commands use the agentic execution engine.
 * Templates define what Claude should do.
 *
 * MIGRATED COMMANDS (18 total):
 * - Sprint 1 (9 CRITICAL): init, analyze, sync, feature, bug, now, done, next, ship
 * - Sprint 2 (4 IMPORTANT): context, recap, stuck, design
 * - Sprint 3 (5 OPTIONAL): cleanup, progress, roadmap, status, build
 *
 * PENDING (3 total):
 * - Sprint 4 (3 SETUP): start, setup, migrateAll
 */

import { WorkflowCommands } from './workflow'
import { PlanningCommands } from './planning'
import { ShippingCommands } from './shipping'
import { AnalyticsCommands } from './analytics'
import { MaintenanceCommands } from './maintenance'
import { AnalysisCommands } from './analysis'
import { SetupCommands } from './setup'

import type {
  CommandResult,
  AgentInfo,
  Author,
  DesignOptions,
  CleanupOptions,
  SetupOptions,
  MigrateOptions,
  AnalyzeOptions
} from './types'

/**
 * PrjctCommands - Combined class with all commands
 * Uses mixins pattern to combine all command groups
 */
class PrjctCommands {
  // Instances of each command group
  private workflow: WorkflowCommands
  private planning: PlanningCommands
  private shipping: ShippingCommands
  private analytics: AnalyticsCommands
  private maintenance: MaintenanceCommands
  private analysis: AnalysisCommands
  private setupCmds: SetupCommands

  // Shared state
  agent: unknown
  agentInfo: AgentInfo | null
  currentAuthor: Author | null
  prjctDir: string

  constructor() {
    this.workflow = new WorkflowCommands()
    this.planning = new PlanningCommands()
    this.shipping = new ShippingCommands()
    this.analytics = new AnalyticsCommands()
    this.maintenance = new MaintenanceCommands()
    this.analysis = new AnalysisCommands()
    this.setupCmds = new SetupCommands()

    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
  }

  // ========== Workflow Commands ==========

  async now(task: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.now(task, projectPath)
  }

  async done(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.done(projectPath)
  }

  async next(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.next(projectPath)
  }

  async build(taskOrNumber: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.build(taskOrNumber, projectPath)
  }

  // ========== Planning Commands ==========

  async init(idea: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.init(idea, projectPath)
  }

  async feature(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.feature(description, projectPath)
  }

  async bug(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.bug(description, projectPath)
  }

  async architect(action: string = 'execute', projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.architect(action, projectPath)
  }

  // ========== Shipping Commands ==========

  async ship(feature: string | null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.shipping.ship(feature, projectPath)
  }

  // ========== Analytics Commands ==========

  async context(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.context(projectPath)
  }

  async recap(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.recap(projectPath)
  }

  async stuck(issue: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.stuck(issue, projectPath)
  }

  async progress(period: string = 'week', projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.progress(period, projectPath)
  }

  async roadmap(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.roadmap(projectPath)
  }

  async status(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.status(projectPath)
  }

  // ========== Maintenance Commands ==========

  async cleanup(options: CleanupOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.cleanup(options, projectPath)
  }

  async design(target: string | null = null, options: DesignOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.design(target, options, projectPath)
  }

  // ========== Analysis Commands ==========

  async analyze(options: AnalyzeOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analysis.analyze(options, projectPath)
  }

  async sync(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analysis.sync(projectPath)
  }

  // ========== Setup Commands ==========

  async start(): Promise<CommandResult> {
    return this.setupCmds.start()
  }

  async setup(options: SetupOptions = {}): Promise<CommandResult> {
    return this.setupCmds.setup(options)
  }

  async migrateAll(options: MigrateOptions = {}): Promise<CommandResult> {
    return this.setupCmds.migrateAll(options)
  }

  async installStatusLine(): Promise<{ success: boolean; error?: string }> {
    return this.setupCmds.installStatusLine()
  }

  showAsciiArt(): void {
    return this.setupCmds.showAsciiArt()
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

  async logToMemory(projectPath: string, action: string, data: Record<string, unknown>): Promise<void> {
    return this.workflow.logToMemory(projectPath, action, data)
  }
}

// Export both class and singleton instance
const instance = new PrjctCommands()

export default instance
export { PrjctCommands }
export * from './types'
