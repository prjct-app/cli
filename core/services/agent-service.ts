/**
 * AgentService - Agent initialization and task assignment
 *
 * Handles agent detection, initialization, and routing tasks to appropriate agents.
 */

import AgentRouter from '../agentic/agent-router'
import { AgentError } from '../errors'
import * as agentDetector from '../infrastructure/agent-detector'
import ClaudeAgent from '../infrastructure/claude-agent'
import type { AgentAssignmentResult, AgentInfo } from '../types/agents'
import type { ProjectContext } from '../types/core'
import { defaultAgentRetryPolicy } from '../utils/retry'

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
   * Wrapped with retry policy to handle transient failures
   */
  async initialize(): Promise<unknown> {
    if (this.agent) return this.agent

    // Wrap initialization with retry policy (3 attempts, exponential backoff)
    return await defaultAgentRetryPolicy.execute(async () => {
      this.agentInfo = await agentDetector.detect()

      if (!this.agentInfo?.isSupported) {
        throw AgentError.notSupported(this.agentInfo?.type ?? 'unknown')
      }

      // Security: validate agent type against whitelist to prevent path traversal
      const agentType = this.agentInfo.type as ValidAgentType
      if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
        throw AgentError.notSupported(this.agentInfo?.type ?? 'unknown')
      }

      this.agent = new ClaudeAgent()

      return this.agent
    }, 'agent-initialization')
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
   * Assign agent for a task - AGENTIC APPROACH
   *
   * NO keyword matching. Returns available agents and context
   * for Claude to make the decision via templates/orchestrator.md
   *
   * The agents in {agentsDir} are already project-specific
   * (generated during p. sync with real technologies)
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
        // No agents available - suggest running sync
        return {
          agent: null, // Claude decides - don't default to generalist
          routing: {
            confidence: 0,
            reason: 'No specialized agents available. Run "p. sync" to generate agents.',
            availableAgents: [],
          },
          _agenticNote: 'AGENTIC: Claude reads orchestrator.md and decides how to proceed',
        }
      }

      // AGENTIC: No keyword matching here
      // Claude reads the orchestrator template and decides based on:
      // 1. Task analysis (what domains are involved)
      // 2. Available agents (from agents directory)
      // 3. Whether to fragment into subtasks
      //
      // The TypeScript code just provides the list of available agents

      return {
        agent: null, // Claude decides via templates
        routing: {
          confidence: 0, // Claude determines confidence
          reason: 'AGENTIC: Claude will analyze task and select appropriate specialist agents',
          availableAgents: agents,
        },
        _agenticNote: `
          AGENTIC EXECUTION:
          - Read: templates/agentic/orchestrator.md
          - Analyze task: "${task}"
          - Available specialists: ${agents.join(', ')}
          - Claude decides which agent(s) to use
          - Always prefer specialists over generalist
          - Fragment complex tasks into subtasks
        `,
      }
    } catch (_error) {
      // Agent routing unavailable - expected for new projects
      return {
        agent: null,
        routing: {
          confidence: 0,
          reason: 'Agent routing unavailable - run "p. sync" first',
          availableAgents: [],
        },
        _agenticNote: 'AGENTIC: Suggest running p. sync to generate agents',
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
    } catch (_error) {
      // Agent router unavailable - expected for new projects
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
