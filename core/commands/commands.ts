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

import { WorkflowCommands } from './workflow'
import { PlanningCommands } from './planning'
import { ShippingCommands } from './shipping'
import { AnalyticsCommands } from './analytics'
import { MaintenanceCommands } from './maintenance'
import { AnalysisCommands } from './analysis'
import { SetupCommands } from './setup'
import { ContextCommands } from './context'

import type {
  CommandResult,
  AgentInfo,
  Author,
  DesignOptions,
  CleanupOptions,
  SetupOptions,
  AnalyzeOptions
} from '../types'

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
  private contextCmds: ContextCommands

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
    this.contextCmds = new ContextCommands()

    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
  }

  // ========== Workflow Commands ==========

  async done(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.done(projectPath)
  }

  async next(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.next(projectPath)
  }

  async pause(reason: string = '', projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.pause(reason, projectPath)
  }

  async resume(taskId: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.workflow.resume(taskId, projectPath)
  }

  // ========== Planning Commands ==========

  async init(idea: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.init(idea, projectPath)
  }

  async bug(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.bug(description, projectPath)
  }

  async idea(description: string, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.idea(description, projectPath)
  }

  async spec(featureName: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.planning.spec(featureName, projectPath)
  }

  // ========== Shipping Commands ==========

  async ship(feature: string | null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.shipping.ship(feature, projectPath)
  }

  // ========== Analytics Commands ==========

  async dash(view: string = 'default', projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.dash(view, projectPath)
  }

  async help(topic: string = '', projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analytics.help(topic, projectPath)
  }

  // ========== Maintenance Commands ==========

  async cleanup(options: CleanupOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.cleanup(options, projectPath)
  }

  async design(target: string | null = null, options: DesignOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.design(target, options, projectPath)
  }

  async recover(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.recover(projectPath)
  }

  async undo(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.undo(projectPath)
  }

  async redo(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.redo(projectPath)
  }

  async history(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.maintenance.history(projectPath)
  }

  // ========== Analysis Commands ==========

  async analyze(options: AnalyzeOptions = {}, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analysis.analyze(options, projectPath)
  }

  async sync(projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.analysis.sync(projectPath)
  }

  // ========== Context Commands ==========

  async context(input: string | null = null, projectPath: string = process.cwd()): Promise<CommandResult> {
    return this.contextCmds.context(input, projectPath)
  }

  // ========== Setup Commands ==========

  async start(): Promise<CommandResult> {
    return this.setupCmds.start()
  }

  async setup(options: SetupOptions = {}): Promise<CommandResult> {
    return this.setupCmds.setup(options)
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

