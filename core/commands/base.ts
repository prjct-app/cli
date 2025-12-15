/**
 * Base class and helpers for PrjctCommands
 */

import path from 'path'

import commandExecutor from '../agentic/command-executor'
import contextBuilder from '../agentic/context-builder'
import toolRegistry from '../agentic/tool-registry'
import AgentRouter from '../agentic/agent-router'
import pathManager from '../infrastructure/path-manager'
import configManager from '../infrastructure/config-manager'
import authorDetector from '../infrastructure/author-detector'
import agentDetector from '../infrastructure/agent-detector'
import migrator from '../infrastructure/migrator'
import UpdateChecker from '../infrastructure/update-checker'
import dateHelper from '../utils/date-helper'
import jsonlHelper from '../utils/jsonl-helper'
import * as fileHelper from '../utils/file-helper'
import out from '../utils/output'

import type {
  CommandResult,
  AgentInfo,
  Author,
  AgentAssignmentResult,
  ComplexityResult,
  HealthResult,
  Context
} from './types'

/**
 * Base class with shared state and utilities
 */
export class PrjctCommandsBase {
  agent: unknown
  agentInfo: AgentInfo | null
  currentAuthor: Author | null
  prjctDir: string
  updateChecker: UpdateChecker
  updateNotificationShown: boolean
  commandExecutor: typeof commandExecutor
  agentRouter: AgentRouter

  constructor() {
    this.agent = null
    this.agentInfo = null
    this.currentAuthor = null
    this.prjctDir = '.prjct'
    this.updateChecker = new UpdateChecker()
    this.updateNotificationShown = false
    this.commandExecutor = commandExecutor
    this.agentRouter = new AgentRouter()
  }

  /**
   * Initialize agent (Claude Code, Desktop, or Terminal)
   */
  async initializeAgent(): Promise<unknown> {
    if (this.agent) return this.agent

    this.agentInfo = await agentDetector.detect()

    if (!this.agentInfo.isSupported) {
      throw new Error('Unsupported agent. Please use Claude Code, Claude Desktop, or Terminal.')
    }

    const { default: Agent } = await import(`../infrastructure/agents/${this.agentInfo.type}-agent`)
    this.agent = new Agent()

    return this.agent
  }

  /**
   * Ensure project is initialized
   */
  async ensureProjectInit(projectPath: string): Promise<CommandResult> {
    if (await configManager.isConfigured(projectPath)) {
      return { success: true }
    }

    out.spin('initializing project...')
    // Note: init() will be implemented in planning module
    const initResult = await (this as unknown as { init: (idea: string | null, projectPath: string) => Promise<CommandResult> }).init(null, projectPath)
    if (!initResult.success) {
      return initResult
    }
    return { success: true }
  }

  /**
   * Ensure author information is loaded
   */
  async ensureAuthor(): Promise<Author> {
    if (this.currentAuthor) return this.currentAuthor
    // detectAuthorForLogs returns a string (username), detect() returns full Author
    const authorObj = await authorDetector.detect()
    this.currentAuthor = {
      name: authorObj.name,
      email: authorObj.email,
      github: authorObj.github
    }
    return this.currentAuthor
  }

  /**
   * Get global project path
   */
  async getGlobalProjectPath(projectPath: string): Promise<string> {
    if (await migrator.needsMigration(projectPath)) {
      throw new Error('Project needs migration. Run /p:migrate first.')
    }

    const projectId = await configManager.getProjectId(projectPath)
    await pathManager.ensureProjectStructure(projectId!)
    return pathManager.getGlobalProjectPath(projectId!)
  }

  /**
   * Log to memory
   */
  async logToMemory(projectPath: string, action: string, data: Record<string, unknown>): Promise<void> {
    try {
      const author = await this.ensureAuthor()
      const projectId = await configManager.getProjectId(projectPath)
      const memoryPath = pathManager.getFilePath(projectId!, 'memory', 'context.jsonl')

      const entry = {
        timestamp: dateHelper.getTimestamp(),
        action,
        data,
        author: author.name,
      }

      await jsonlHelper.appendJsonLine(memoryPath, entry)
    } catch {
      // Non-critical - don't fail the command
    }
  }

  /**
   * Detect if directory is empty (excluding common files)
   */
  async _detectEmptyDirectory(projectPath: string): Promise<boolean> {
    try {
      const entries = await fileHelper.listFiles(projectPath)
      const meaningfulFiles = entries.filter(
        (name) =>
          !name.startsWith('.') &&
          name !== 'node_modules' &&
          name !== 'package.json' &&
          name !== 'package-lock.json' &&
          name !== 'README.md'
      )
      return meaningfulFiles.length === 0
    } catch {
      return true
    }
  }

  /**
   * Detect if directory has existing code
   */
  async _detectExistingCode(projectPath: string): Promise<boolean> {
    try {
      const codePatterns = [
        'src', 'lib', 'app', 'components', 'pages', 'api',
        'main.go', 'main.rs', 'main.py',
      ]
      const entries = await fileHelper.listFiles(projectPath)
      return entries.some((name) => codePatterns.includes(name))
    } catch {
      return false
    }
  }

  /**
   * Assign agent for a task
   */
  async _assignAgentForTask(taskDescription: string, projectPath: string, _context: Context): Promise<AgentAssignmentResult> {
    try {
      const projectId = await configManager.getProjectId(projectPath)
      const agentsPath = pathManager.getFilePath(projectId!, 'agents', '')
      const agentFiles = await fileHelper.listFiles(agentsPath, { extension: '.md' })
      const agents = agentFiles.map(f => f.replace('.md', ''))

      return {
        agent: { name: agents[0] || 'generalist', domain: 'auto' },
        routing: {
          confidence: 0.8,
          reason: 'Claude assigns via templates/agent-assignment.md',
          availableAgents: agents
        },
        _agenticNote: 'Use templates/agent-assignment.md for actual assignment'
      }
    } catch {
      return {
        agent: { name: 'generalist', domain: 'general' },
        routing: { confidence: 0.5, reason: 'Fallback - no agents found' }
      }
    }
  }

  /**
   * Detect task complexity
   */
  _detectComplexity(_task: string): ComplexityResult {
    return { level: 'medium', hours: 4, type: 'feature' }
  }

  /**
   * Calculate project health score
   */
  _calculateHealth(stats: { activeTask: boolean; featuresShipped: number }): HealthResult {
    const hasActivity = stats.activeTask || stats.featuresShipped > 0
    return {
      score: hasActivity ? 70 : 50,
      message: hasActivity ? '🟢 Active' : '🟡 Ready to start',
    }
  }

  /**
   * Render ASCII progress bar
   */
  _renderProgressBar(label: string, value: number, max: number): void {
    const percentage = Math.min(100, Math.round((value / max) * 100))
    const barLength = 30
    const filled = Math.round((percentage / 100) * barLength)
    const empty = barLength - filled

    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    console.log(`   ${label}: [${bar}] ${percentage}%`)
  }

  /**
   * Breakdown feature into tasks
   */
  _breakdownFeatureTasks(description: string): string[] {
    return [
      `Analyze and plan: ${description}`,
      'Implement core functionality',
      'Test and validate',
      'Document changes',
    ]
  }

  /**
   * Detect bug severity from description
   */
  _detectBugSeverity(_description: string): string {
    return 'medium'
  }

  /**
   * Auto-assign agent based on task (deprecated)
   */
  _autoAssignAgent(_task: string): string {
    console.warn('DEPRECATED: Use _assignAgentForTask() for proper agent routing')
    return 'generalist'
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
  out
}
