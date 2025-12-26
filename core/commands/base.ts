/**
 * Base class and helpers for PrjctCommands
 */

import commandExecutor from '../agentic/command-executor/index'
import contextBuilder from '../agentic/context-builder'
import toolRegistry from '../agentic/tool-registry'
import AgentRouter from '../agentic/agent-router'
import pathManager from '../infrastructure/path-manager'
import configManager from '../infrastructure/config-manager'
import authorDetector from '../infrastructure/author-detector'
import agentDetector from '../infrastructure/agent-detector'
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
  Context
} from './types'
import { ProjectError, AgentError } from '../errors'

// Valid agent types - whitelist for security (prevents path traversal)
const VALID_AGENT_TYPES = ['claude'] as const
type ValidAgentType = typeof VALID_AGENT_TYPES[number]

// Lazy-loaded to avoid circular dependencies
let _planningCommands: import('./planning').PlanningCommands | null = null
async function getPlanningCommands(): Promise<import('./planning').PlanningCommands> {
  if (!_planningCommands) {
    const { PlanningCommands } = await import('./planning')
    _planningCommands = new PlanningCommands()
  }
  return _planningCommands
}

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
      throw AgentError.notSupported(this.agentInfo.type)
    }

    // Security: validate agent type against whitelist to prevent path traversal
    const agentType = this.agentInfo.type as ValidAgentType
    if (!VALID_AGENT_TYPES.includes(agentType)) {
      throw AgentError.notSupported(this.agentInfo.type)
    }

    const { default: Agent } = await import(`../infrastructure/agents/${agentType}-agent`)
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
    const planning = await getPlanningCommands()
    const initResult = await planning.init(null, projectPath)
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
      name: authorObj.name ?? undefined,
      email: authorObj.email ?? undefined,
      github: authorObj.github ?? undefined
    }
    return this.currentAuthor!
  }

  /**
   * Get global project path
   */
  async getGlobalProjectPath(projectPath: string): Promise<string> {
    const projectId = await configManager.getProjectId(projectPath)
    if (!projectId) {
      throw ProjectError.notInitialized()
    }
    await pathManager.ensureProjectStructure(projectId)
    return pathManager.getGlobalProjectPath(projectId)
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
   * Assign agent for a task using AgentRouter
   * Returns agent info for Claude to delegate work
   */
  async _assignAgentForTask(
    task: string,
    projectPath: string,
    _context: Context
  ): Promise<AgentAssignmentResult> {
    try {
      await this.agentRouter.initialize(projectPath)
      const agents = await this.agentRouter.getAgentNames()

      if (agents.length === 0) {
        return {
          agent: { name: 'generalist' },
          routing: {
            confidence: 1.0,
            reason: 'No specialized agents available',
            availableAgents: [],
          },
        }
      }

      // Simple keyword matching for agent assignment
      // Claude will make the final decision via templates
      const taskLower = task.toLowerCase()
      let bestMatch = 'generalist'

      for (const agentName of agents) {
        const nameLower = agentName.toLowerCase()
        if (taskLower.includes(nameLower) || nameLower.includes('general')) {
          bestMatch = agentName
          break
        }
        // Common domain keywords
        if ((nameLower.includes('fe') || nameLower.includes('frontend')) &&
            (taskLower.includes('ui') || taskLower.includes('component') || taskLower.includes('react'))) {
          bestMatch = agentName
          break
        }
        if ((nameLower.includes('be') || nameLower.includes('backend')) &&
            (taskLower.includes('api') || taskLower.includes('server') || taskLower.includes('database'))) {
          bestMatch = agentName
          break
        }
      }

      await this.agentRouter.logUsage(task, bestMatch, projectPath)

      return {
        agent: { name: bestMatch },
        routing: {
          confidence: 0.7,
          reason: 'Keyword-based agent matching',
          availableAgents: agents,
        },
        _agenticNote: 'Claude should verify this assignment using agent context',
      }
    } catch {
      return {
        agent: { name: 'generalist' },
        routing: {
          confidence: 1.0,
          reason: 'Agent routing unavailable',
        },
      }
    }
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
