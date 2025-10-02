/**
 * Agent Detection Module for prjct-cli
 *
 * 100% Claude-focused architecture
 * Detects Claude Code and Claude Desktop environments
 *
 * @version 0.5.0
 */

const fs = require('fs')
const path = require('path')

class AgentDetector {
  constructor() {
    this.detectedAgent = null
  }

  /**
   * Main detection method - Claude or CLI fallback
   * @returns {Object} Agent information
   */
  async detect() {
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
   * @returns {boolean} True if Claude detected
   */
  isClaudeEnvironment() {
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
  getClaudeAgent() {
    return {
      type: 'claude',
      name: 'Claude (Code + Desktop)',
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
  getTerminalAgent() {
    return {
      type: 'terminal',
      name: 'Terminal/CLI',
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
  setAgent(type) {
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
  reset() {
    this.detectedAgent = null
  }

  /**
   * Check if current environment is Claude
   * @returns {boolean} True if Claude
   */
  isClaude() {
    const agent = this.detectedAgent || this.isClaudeEnvironment()
    return agent === true || (agent && agent.type === 'claude')
  }

  /**
   * Check if current environment is Terminal/CLI
   * @returns {boolean} True if terminal
   */
  isTerminal() {
    return !this.isClaude()
  }
}

module.exports = new AgentDetector()
