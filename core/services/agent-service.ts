/**
 * AgentService - Agent initialization and task assignment
 *
 * Handles agent detection, initialization, and routing tasks to appropriate agents.
 */

import agentDetector from '../infrastructure/agent-detector'
import AgentRouter from '../agentic/agent-router'
import type { AgentInfo, AgentAssignmentResult, ProjectContext } from '../types'
import { AgentError } from '../errors'

// Valid agent types - whitelist for security (prevents path traversal)
const VALID_AGENT_TYPES = ['claude'] as const
type ValidAgentType = (typeof VALID_AGENT_TYPES)[number]

export class AgentService {
  private agent: unknown = null
  private agentInfo: AgentInfo | null = null
  private agentRouter: AgentRouter

  constructor() {
    this.agentRouter = new AgentRouter()
  }

  /**
   * Initialize agent (Claude Code, Desktop, or Terminal)
   */
  async initialize(): Promise<unknown> {
    if (this.agent) return this.agent

    this.agentInfo = await agentDetector.detect()

    if (!this.agentInfo?.isSupported) {
      throw AgentError.notSupported(this.agentInfo?.type ?? 'unknown')
    }

    // Security: validate agent type against whitelist to prevent path traversal
    const agentType = this.agentInfo.type as ValidAgentType
    if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
      throw AgentError.notSupported(this.agentInfo?.type ?? 'unknown')
    }

    const { default: Agent } = await import(`../infrastructure/${agentType}-agent`)
    this.agent = new Agent()

    return this.agent
  }

  /**
   * Get current agent info
   */
  getInfo(): AgentInfo | null {
    return this.agentInfo
  }

  /**
   * Get initialized agent
   */
  getAgent(): unknown {
    return this.agent
  }

  /**
   * Check if agent is initialized
   */
  isInitialized(): boolean {
    return this.agent !== null
  }

  /**
   * Assign agent for a task using AgentRouter
   * Returns agent info for Claude to delegate work
   */
  async assignForTask(
    task: string,
    projectPath: string,
    _context: ProjectContext
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
        if (
          (nameLower.includes('fe') || nameLower.includes('frontend')) &&
          (taskLower.includes('ui') ||
            taskLower.includes('component') ||
            taskLower.includes('react'))
        ) {
          bestMatch = agentName
          break
        }
        if (
          (nameLower.includes('be') || nameLower.includes('backend')) &&
          (taskLower.includes('api') ||
            taskLower.includes('server') ||
            taskLower.includes('database'))
        ) {
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

  /**
   * Get available agent names
   */
  async getAvailableAgents(projectPath: string): Promise<string[]> {
    try {
      await this.agentRouter.initialize(projectPath)
      return await this.agentRouter.getAgentNames()
    } catch {
      return []
    }
  }

  /**
   * Reset agent state (useful for tests)
   */
  reset(): void {
    this.agent = null
    this.agentInfo = null
  }
}

export const agentService = new AgentService()
export default agentService
