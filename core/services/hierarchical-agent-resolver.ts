/**
 * HierarchicalAgentResolver - Resolves agents from hierarchical AGENTS.md files
 *
 * This service bridges:
 * - NestedContextResolver (discovers AGENTS.md files in directory tree)
 * - AgentLoader (loads generated agent files from global storage)
 *
 * Pattern: "Scope = directory tree. Deeper files take precedence."
 */

import path from 'node:path'
import NestedContextResolver, {
  type AgentDefinition,
  type NestedAgents,
  type ResolvedAgents,
} from './nested-context-resolver'

// ============================================================================
// TYPES
// ============================================================================

export interface HierarchicalAgent {
  /** Agent name (e.g., "frontend", "backend") */
  name: string
  /** Resolved description from hierarchy */
  description: string
  /** Domain specialization */
  domain: string | null
  /** Merged triggers from all levels */
  triggers: string[]
  /** Merged rules from all levels */
  rules: string[]
  /** Merged patterns from all levels */
  patterns: string[]
  /** Sources that contributed to this agent (paths) */
  sources: string[]
  /** Whether this agent was overridden at some level */
  wasOverridden: boolean
  /** Effort level hint for Claude's adaptive reasoning depth */
  effort?: 'low' | 'medium' | 'high' | 'max'
}

export interface AgentResolutionResult {
  /** Resolved agents for the target path */
  agents: HierarchicalAgent[]
  /** Root path of the resolution */
  rootPath: string
  /** Target path that was resolved */
  targetPath: string
  /** All AGENTS.md files discovered */
  discoveredFiles: string[]
  /** Agents that were overridden during resolution */
  overriddenAgents: string[]
}

// ============================================================================
// HIERARCHICAL AGENT RESOLVER
// ============================================================================

export class HierarchicalAgentResolver {
  private resolver: NestedContextResolver
  private rootPath: string
  private initialized = false

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath)
    this.resolver = new NestedContextResolver(this.rootPath)
  }

  /**
   * Initialize the resolver (detects monorepo structure)
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.resolver.initialize()
      this.initialized = true
    }
  }

  /**
   * Resolve agents for a specific directory path
   * Returns merged agents following hierarchical inheritance
   */
  async resolveAgentsForPath(targetPath: string): Promise<AgentResolutionResult> {
    await this.initialize()

    const resolved = await this.resolver.resolveAgentsForPath(targetPath)
    const allAgentFiles = await this.resolver.discoverAgentFiles()

    return {
      agents: resolved.agents.map((agent) => this.toHierarchicalAgent(agent, resolved)),
      rootPath: this.rootPath,
      targetPath: path.resolve(targetPath),
      discoveredFiles: allAgentFiles.map((af) => af.path),
      overriddenAgents: resolved.overrides.map((o) => o.split(':')[1]),
    }
  }

  /**
   * Resolve agents for the root project
   */
  async resolveRootAgents(): Promise<AgentResolutionResult> {
    return this.resolveAgentsForPath(this.rootPath)
  }

  /**
   * Get a specific agent by name for a path
   */
  async getAgentByName(agentName: string, targetPath?: string): Promise<HierarchicalAgent | null> {
    const result = await this.resolveAgentsForPath(targetPath || this.rootPath)
    return result.agents.find((a) => a.name.toLowerCase() === agentName.toLowerCase()) || null
  }

  /**
   * Get all available agent names across the hierarchy
   */
  async getAllAgentNames(): Promise<string[]> {
    await this.initialize()

    const agentFiles = await this.resolver.discoverAgentFiles()
    const names = new Set<string>()

    for (const file of agentFiles) {
      for (const agent of file.agents) {
        names.add(agent.name)
      }
    }

    return Array.from(names).sort()
  }

  /**
   * Check if a specific agent exists anywhere in the hierarchy
   */
  async agentExists(agentName: string): Promise<boolean> {
    const names = await this.getAllAgentNames()
    return names.some((n) => n.toLowerCase() === agentName.toLowerCase())
  }

  /**
   * Get the raw AGENTS.md file tree structure
   */
  async getAgentFileTree(): Promise<NestedAgents[]> {
    await this.initialize()
    return this.resolver.discoverAgentFiles()
  }

  /**
   * Convert AgentDefinition to HierarchicalAgent
   */
  private toHierarchicalAgent(agent: AgentDefinition, resolved: ResolvedAgents): HierarchicalAgent {
    const wasOverridden = resolved.overrides.some((o) => o.split(':')[1] === agent.name)

    return {
      name: agent.name,
      description: agent.description,
      domain: agent.domain || null,
      triggers: agent.triggers || [],
      rules: agent.rules || [],
      patterns: agent.patterns || [],
      sources: resolved.sources,
      wasOverridden,
    }
  }

  /**
   * Generate markdown content for an agent (for use with AgentLoader)
   */
  generateAgentMarkdown(agent: HierarchicalAgent): string {
    const parts: string[] = []

    // Header
    parts.push(`# ${agent.name} Agent`)
    parts.push('')

    // Description
    if (agent.description) {
      parts.push(agent.description)
      parts.push('')
    }

    // Domain
    if (agent.domain) {
      parts.push(`## DOMAIN AUTHORITY`)
      parts.push('')
      parts.push(`This agent specializes in the ${agent.domain} domain.`)
      parts.push('')
    }

    // Triggers
    if (agent.triggers.length > 0) {
      parts.push(`## Triggers`)
      parts.push('')
      for (const trigger of agent.triggers) {
        parts.push(`- ${trigger}`)
      }
      parts.push('')
    }

    // Rules
    if (agent.rules.length > 0) {
      parts.push(`## Rules`)
      parts.push('')
      for (const rule of agent.rules) {
        parts.push(`- ${rule}`)
      }
      parts.push('')
    }

    // Patterns
    if (agent.patterns.length > 0) {
      parts.push(`## Patterns`)
      parts.push('')
      for (const pattern of agent.patterns) {
        parts.push('```')
        parts.push(pattern)
        parts.push('```')
        parts.push('')
      }
    }

    // Source attribution
    if (agent.sources.length > 0) {
      parts.push(`---`)
      parts.push(`*Resolved from: ${agent.sources.join(' → ')}*`)
    }

    return parts.join('\n')
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default HierarchicalAgentResolver
