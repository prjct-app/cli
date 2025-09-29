/**
 * Agent Detection Module for prjct-cli
 * Automatically detects which AI agent is executing commands
 */

const fs = require('fs')
const path = require('path')

class AgentDetector {
  constructor() {
    this.detectedAgent = null
    this.detectionMethods = [
      this.detectByEnvironmentVariables.bind(this),
      this.detectByConfigFiles.bind(this),
      this.detectByRuntimeCapabilities.bind(this),
      this.detectByFileSystem.bind(this),
    ]
  }

  /**
   * Main detection method - tries multiple strategies
   * @returns {Object} Agent information
   */
  async detect() {
    // Return cached result if already detected
    if (this.detectedAgent) {
      return this.detectedAgent
    }

    // Try each detection method
    for (const method of this.detectionMethods) {
      const result = await method()
      if (result) {
        this.detectedAgent = result
        return result
      }
    }

    // Default to terminal if no specific agent detected
    this.detectedAgent = this.getTerminalAgent()
    return this.detectedAgent
  }

  /**
   * Detect agent by environment variables
   */
  async detectByEnvironmentVariables() {
    // Check for OpenAI Codex specific variables
    if (process.env.CODEX_AGENT || process.env.OPENAI_CODEX) {
      return this.getCodexAgent()
    }

    // Check for Claude specific variables
    if (process.env.CLAUDE_AGENT || process.env.ANTHROPIC_CLAUDE) {
      return this.getClaudeAgent()
    }

    // Check for GitHub Codespaces (often used with Codex)
    if (process.env.CODESPACES) {
      return this.getCodexAgent()
    }

    return null
  }

  /**
   * Detect agent by configuration files
   */
  async detectByConfigFiles() {
    const projectRoot = process.cwd()

    // Check for AGENTS.md (OpenAI Codex marker)
    if (fs.existsSync(path.join(projectRoot, 'AGENTS.md'))) {
      // Also check if we're NOT in Claude environment
      if (!fs.existsSync(path.join(projectRoot, '.claude'))) {
        return this.getCodexAgent()
      }
    }

    // Check for CLAUDE.md (Claude Code marker)
    if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
      return this.getClaudeAgent()
    }

    // Check for .claude directory
    if (fs.existsSync(path.join(process.env.HOME || '', '.claude'))) {
      return this.getClaudeAgent()
    }

    return null
  }

  /**
   * Detect agent by runtime capabilities
   */
  async detectByRuntimeCapabilities() {
    // Check for MCP (Model Context Protocol) - Claude specific
    try {
      // Try to detect MCP availability
      if (global.mcp || process.env.MCP_AVAILABLE) {
        return this.getClaudeAgent()
      }
    } catch (e) {
      // MCP not available
    }

    // Check if running in a container (common for Codex)
    if (this.isRunningInContainer()) {
      return this.getCodexAgent()
    }

    return null
  }

  /**
   * Detect agent by filesystem characteristics
   */
  async detectByFileSystem() {
    // Check for sandboxed paths (Codex characteristic)
    if (process.cwd().includes('/sandbox/') || process.cwd().includes('/tmp/codex/')) {
      return this.getCodexAgent()
    }

    // Check for Claude workspace patterns
    if (process.cwd().includes('/.claude/') || process.cwd().includes('/claude-workspace/')) {
      return this.getClaudeAgent()
    }

    return null
  }

  /**
   * Check if running in a container
   */
  isRunningInContainer() {
    // Check for Docker
    if (fs.existsSync('/.dockerenv')) {
      return true
    }

    // Check for container-specific cgroup
    try {
      const cgroup = fs.readFileSync('/proc/self/cgroup', 'utf8')
      if (cgroup.includes('docker') || cgroup.includes('containerd')) {
        return true
      }
    } catch (e) {
      // Not in container or can't read cgroup
    }

    return false
  }

  /**
   * Get Claude agent configuration
   */
  getClaudeAgent() {
    return {
      type: 'claude',
      name: 'Claude Code',
      capabilities: {
        mcp: true,
        filesystem: 'mcp',
        markdown: true,
        emojis: true,
        colors: true,
        interactive: true,
      },
      config: {
        configFile: 'CLAUDE.md',
        commandPrefix: '/p:',
        responseStyle: 'rich',
        dataDir: '.prjct',
      },
      environment: {
        hasMCP: true,
        sandboxed: false,
        persistent: true,
      },
    }
  }

  /**
   * Get Codex agent configuration
   */
  getCodexAgent() {
    return {
      type: 'codex',
      name: 'OpenAI Codex',
      capabilities: {
        mcp: false,
        filesystem: 'native',
        markdown: true,
        emojis: true,
        colors: false,
        interactive: false,
      },
      config: {
        configFile: 'AGENTS.md',
        commandPrefix: '/p:',
        responseStyle: 'structured',
        dataDir: '.prjct',
      },
      environment: {
        hasMCP: false,
        sandboxed: true,
        persistent: false,
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
      },
      config: {
        configFile: null,
        commandPrefix: 'prjct',
        responseStyle: 'cli',
        dataDir: '.prjct',
      },
      environment: {
        hasMCP: false,
        sandboxed: false,
        persistent: true,
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
      case 'codex':
        this.detectedAgent = this.getCodexAgent()
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
}

// Export singleton instance
module.exports = new AgentDetector()
