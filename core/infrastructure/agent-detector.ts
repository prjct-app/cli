/**
 * Agent Detector
 * Detects Claude Code and Claude Desktop environments.
 *
 * @module infrastructure/agent-detector
 */

import fs from 'fs'
import path from 'path'

// ============ Types ============

export interface AgentCapabilities {
  mcp: boolean
  filesystem: string
  markdown: boolean
  emojis: boolean
  colors: boolean
  interactive: boolean
  agents: boolean
}

export interface AgentConfig {
  configFile: string | null
  commandPrefix: string
  responseStyle: string
  dataDir: string
  agentsDir: string | null
  commandsDir: string | null
}

export interface AgentEnvironment {
  hasMCP: boolean
  sandboxed: boolean
  persistent: boolean
  agentSystem: boolean
}

export interface AgentInfo {
  type: string
  name: string
  isSupported: boolean
  capabilities: AgentCapabilities
  config: AgentConfig
  environment: AgentEnvironment
}

declare const global: typeof globalThis & {
  mcp?: { filesystem?: unknown }
}

// ============ Module State (for caching) ============

let cachedAgent: AgentInfo | null = null

// ============ Agent Definitions ============

const CLAUDE_AGENT: AgentInfo = {
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

const TERMINAL_AGENT: AgentInfo = {
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

// ============ Detection Functions ============

export function isClaudeEnvironment(): boolean {
  // Environment variables
  if (process.env.CLAUDE_AGENT || process.env.ANTHROPIC_CLAUDE) return true

  // MCP availability
  if (global.mcp || process.env.MCP_AVAILABLE) return true

  // Configuration files
  const projectRoot = process.cwd()
  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) return true

  // Claude directory in home
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  if (fs.existsSync(path.join(homeDir, '.claude'))) return true

  // Filesystem paths
  const cwd = process.cwd()
  if (cwd.includes('/.claude/') || cwd.includes('/claude-workspace/')) return true

  return false
}

export function getClaudeAgent(): AgentInfo {
  return { ...CLAUDE_AGENT }
}

export function getTerminalAgent(): AgentInfo {
  return { ...TERMINAL_AGENT }
}

export async function detect(): Promise<AgentInfo> {
  if (cachedAgent) return cachedAgent

  cachedAgent = isClaudeEnvironment() ? getClaudeAgent() : getTerminalAgent()
  return cachedAgent
}

export function setAgent(type: string): AgentInfo {
  cachedAgent = type === 'claude' ? getClaudeAgent() : getTerminalAgent()
  return cachedAgent
}

export function reset(): void {
  cachedAgent = null
}

export function isClaude(): boolean {
  if (cachedAgent) return cachedAgent.type === 'claude'
  return isClaudeEnvironment()
}

export function isTerminal(): boolean {
  return !isClaude()
}

// ============ Default Export (backwards compat) ============

export default {
  detect,
  isClaudeEnvironment,
  getClaudeAgent,
  getTerminalAgent,
  setAgent,
  reset,
  isClaude,
  isTerminal
}
