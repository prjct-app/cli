/**
 * Agent Detector
 * Detects Claude Code and Claude Desktop environments.
 *
 * @module infrastructure/agent-detector
 * @version 0.5.0
 */

import fs from 'fs'
import path from 'path'

interface AgentCapabilities {
  mcp: boolean
  filesystem: string
  markdown: boolean
  emojis: boolean
  colors: boolean
  interactive: boolean
  agents: boolean
}

interface AgentConfig {
  configFile: string | null
  commandPrefix: string
  responseStyle: string
  dataDir: string
  agentsDir: string | null
  commandsDir: string | null
}

interface AgentEnvironment {
  hasMCP: boolean
  sandboxed: boolean
  persistent: boolean
  agentSystem: boolean
}

interface AgentInfo {
  type: string
  name: string
  isSupported: boolean
  capabilities: AgentCapabilities
  config: AgentConfig
  environment: AgentEnvironment
}

declare const global: typeof globalThis & {
  mcp?: {
    filesystem?: unknown
  }
}

/**
 * Detects the current execution environment (Claude or Terminal).
 * Provides appropriate capabilities and configuration for each environment.
 */
class AgentDetector {
  private detectedAgent: AgentInfo | null = null

  /**
   * Main detection method - Claude or CLI fallback
   */
  async detect(): Promise<AgentInfo> {
    if (this.detectedAgent) {
      return this.detectedAgent
    }

    // Check for Claude environment
    if (this.isClaudeEnvironment()) {
      this.detectedAgent = this.getClaudeAgent()
      return this.detectedAgent
    }

    // Fallback to terminal/CLI
    this.detectedAgent = this.getTerminalAgent()
    return this.detectedAgent
  }

  /**
   * Check if running in Claude environment
   */
  isClaudeEnvironment(): boolean {
    // Environment variables
    if (process.env.CLAUDE_AGENT || process.env.ANTHROPIC_CLAUDE) {
      return true
    }

    // MCP availability
    if (global.mcp || process.env.MCP_AVAILABLE) {
      return true
    }

    // Configuration files
    const projectRoot = process.cwd()
    if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
      return true
    }

    // Claude directory in home
    const homeDir = process.env.HOME || process.env.USERPROFILE || ''
    if (fs.existsSync(path.join(homeDir, '.claude'))) {
      return true
    }

    // Filesystem paths
    const cwd = process.cwd()
    if (cwd.includes('/.claude/') || cwd.includes('/claude-workspace/')) {
      return true
    }

    return false
  }

  /**
   * Get Claude agent configuration
   * Works for both Claude Code and Claude Desktop
   */
  getClaudeAgent(): AgentInfo {
    return {
      type: 'claude',
      name: 'Claude (Code + Desktop)',
      isSupported: true,
      capabilities: {
        mcp: true,
        filesystem: 'mcp',
        markdown: true,
        emojis: true,
        colors: true,
        interactive: true,
        agents: true,
      },
      config: {
        configFile: 'CLAUDE.md',
        commandPrefix: '/p:',
        responseStyle: 'rich',
        dataDir: '.prjct',
        agentsDir: '~/.claude/agents',
        commandsDir: '~/.claude/commands/p',
      },
      environment: {
        hasMCP: true,
        sandboxed: false,
        persistent: true,
        agentSystem: true,
      },
    }
  }

  /**
   * Get terminal agent configuration (fallback)
   */
  getTerminalAgent(): AgentInfo {
    return {
      type: 'terminal',
      name: 'Terminal/CLI',
      isSupported: true,
      capabilities: {
        mcp: false,
        filesystem: 'native',
        markdown: false,
        emojis: true,
        colors: true,
        interactive: true,
        agents: false,
      },
      config: {
        configFile: null,
        commandPrefix: 'prjct',
        responseStyle: 'cli',
        dataDir: '.prjct',
        agentsDir: null,
        commandsDir: null,
      },
      environment: {
        hasMCP: false,
        sandboxed: false,
        persistent: true,
        agentSystem: false,
      },
    }
  }

  /**
   * Force set agent type (for testing)
   */
  setAgent(type: string): AgentInfo {
    switch (type) {
      case 'claude':
        this.detectedAgent = this.getClaudeAgent()
        break
      case 'terminal':
      default:
        this.detectedAgent = this.getTerminalAgent()
        break
    }
    return this.detectedAgent
  }

  /**
   * Reset detection (clear cache)
   */
  reset(): void {
    this.detectedAgent = null
  }

  /**
   * Check if current environment is Claude
   */
  isClaude(): boolean {
    const agent = this.detectedAgent || this.isClaudeEnvironment()
    return agent === true || (typeof agent === 'object' && agent?.type === 'claude')
  }

  /**
   * Check if current environment is Terminal/CLI
   */
  isTerminal(): boolean {
    return !this.isClaude()
  }
}

const agentDetector = new AgentDetector()
export default agentDetector
