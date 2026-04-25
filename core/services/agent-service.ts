/**
 * AgentService - AI agent initialization
 *
 * Handles agent detection and initialization (Claude Code, Desktop, Terminal).
 */

import { AgentError } from '../errors'
import * as agentDetector from '../infrastructure/agent-detector'
import ClaudeAgent from '../infrastructure/claude-agent'
import type { AgentInfo } from '../types/agents'
import { defaultAgentRetryPolicy } from '../utils/retry'

// Valid agent types - whitelist for security (prevents path traversal)
const VALID_AGENT_TYPES = ['claude'] as const
type ValidAgentType = (typeof VALID_AGENT_TYPES)[number]

class AgentService {
  private agent: unknown = null
  private agentInfo: AgentInfo | null = null

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

  getInfo(): AgentInfo | null {
    return this.agentInfo
  }

  getAgent(): unknown {
    return this.agent
  }

  isInitialized(): boolean {
    return this.agent !== null
  }

  reset(): void {
    this.agent = null
    this.agentInfo = null
  }
}

export const agentService = new AgentService()
export default agentService
