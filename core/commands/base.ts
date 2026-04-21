/**
 * Base class and helpers for PrjctCommands
 *
 * Delegates to service modules for business logic.
 * This class maintains backward compatibility while services handle implementation.
 */

import UpdateChecker from '../infrastructure/update-checker'
import { agentService } from '../services/agent-service'
import { breakdownService } from '../services/breakdown-service'
import { memoryService } from '../services/memory-service'
import { projectService } from '../services/project-service'
import type { AgentInfo } from '../types/agents'
import type { Author, CommandResult } from '../types/commands'

/**
 * Base class with shared state and utilities
 * Delegates to service modules for implementation
 */
export class PrjctCommandsBase {
  prjctDir: string
  updateChecker: UpdateChecker
  updateNotificationShown: boolean

  constructor() {
    this.prjctDir = '.prjct'
    this.updateChecker = new UpdateChecker()
    this.updateNotificationShown = false
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
}
