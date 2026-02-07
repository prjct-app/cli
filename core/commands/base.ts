/**
 * Base class and helpers for PrjctCommands
 *
 * Delegates to service modules for business logic.
 * This class maintains backward compatibility while services handle implementation.
 */

import commandExecutor from '../agentic/command-executor'
import contextBuilder from '../agentic/context-builder'
import toolRegistry from '../agentic/tool-registry'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import UpdateChecker from '../infrastructure/update-checker'
// Services
import { agentService, breakdownService, memoryService, projectService } from '../services'
import type {
  AgentAssignmentResult,
  AgentInfo,
  Author,
  CommandResult,
  ProjectContext,
} from '../types'
import * as dateHelper from '../utils/date-helper'
import * as fileHelper from '../utils/file-helper'
import * as jsonlHelper from '../utils/jsonl-helper'
import out from '../utils/output'

/**
 * Base class with shared state and utilities
 * Delegates to service modules for implementation
 */
export class PrjctCommandsBase {
  prjctDir: string
  updateChecker: UpdateChecker
  updateNotificationShown: boolean
  commandExecutor: typeof commandExecutor

  constructor() {
    this.prjctDir = '.prjct'
    this.updateChecker = new UpdateChecker()
    this.updateNotificationShown = false
    this.commandExecutor = commandExecutor
  }

  // Agent accessors (delegate to agentService)
  get agent(): unknown {
    return agentService.getAgent()
  }

  get agentInfo(): AgentInfo | null {
    return agentService.getInfo()
  }

  get currentAuthor(): Author | null {
    return projectService.getCurrentAuthor()
  }

  async initializeAgent(): Promise<unknown> {
    return agentService.initialize()
  }

  async ensureProjectInit(projectPath: string): Promise<CommandResult> {
    return projectService.ensureInit(projectPath)
  }

  async ensureAuthor(): Promise<Author> {
    return projectService.ensureAuthor()
  }

  async getGlobalProjectPath(projectPath: string): Promise<string> {
    return projectService.getGlobalPath(projectPath)
  }

  async logToMemory(
    projectPath: string,
    action: string,
    data: Record<string, unknown>
  ): Promise<void> {
    const author = await this.ensureAuthor()
    return memoryService.log(projectPath, action, data, author.name)
  }

  async _detectEmptyDirectory(projectPath: string): Promise<boolean> {
    return projectService.isEmptyDirectory(projectPath)
  }

  async _detectExistingCode(projectPath: string): Promise<boolean> {
    return projectService.hasExistingCode(projectPath)
  }

  _breakdownFeatureTasks(description: string): string[] {
    return breakdownService.breakdownFeature(description)
  }

  _detectBugSeverity(description: string): string {
    return breakdownService.detectBugSeverity(description)
  }

  async _assignAgentForTask(
    task: string,
    projectPath: string,
    context: ProjectContext
  ): Promise<AgentAssignmentResult> {
    return agentService.assignForTask(task, projectPath, context)
  }
}

// Re-export dependencies for use by other modules
export {
  contextBuilder,
  toolRegistry,
  pathManager,
  configManager,
  fileHelper,
  jsonlHelper,
  dateHelper,
  out,
}
