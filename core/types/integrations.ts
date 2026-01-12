/**
 * Integration Types
 * Types for external service integrations
 */

/**
 * MCP Server Configuration
 */
export interface McpServerConfig {
  name: string
  description?: string
  command: string
  args: string[]
  enabled: boolean
  linkedAgents?: string[]
  autoLoad?: boolean
  setupAt?: string
}

/**
 * MCP Servers Configuration for a project
 */
export interface McpServersConfig {
  projectId: string
  version: string
  servers: Record<string, McpServerConfig>
  agentMcpMap: Record<string, string[]>
}

/**
 * Integrations Config
 * Container for all external integrations
 */
export interface IntegrationsConfig {
  mcp?: {
    enabled: boolean
    configPath: string
  }
}
