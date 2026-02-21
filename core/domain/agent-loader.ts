/**
 * AgentLoader - Loads agents from project files with hierarchical AGENTS.md support
 *
 * CRITICAL: This ensures agents generated for a project are actually USED
 *
 * Supports two agent sources:
 * 1. Generated agent files in ~/.prjct-cli/projects/{projectId}/agents/
 * 2. Hierarchical AGENTS.md files in the project directory tree
 *
 * @version 2.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import HierarchicalAgentResolver from '../services/hierarchical-agent-resolver'
import { isNotFoundError } from '../types/fs'
import type { HierarchicalAgent } from '../types/services.js'

interface Agent {
  name: string
  content: string
  path: string
  role: string | null
  domain: string
  skills: string[]
  effort?: 'low' | 'medium' | 'high' | 'max'
  model?: string
  modified: Date
  /** Source of this agent: 'file' (generated) or 'hierarchical' (AGENTS.md) */
  source?: 'file' | 'hierarchical'
  /** If hierarchical, the files that contributed to this agent */
  hierarchySources?: string[]
}

class AgentLoader {
  projectId: string | null
  agentsDir: string
  cache: Map<string, Agent>
  private projectPath: string | null
  private hierarchicalResolver: HierarchicalAgentResolver | null = null

  constructor(projectId: string | null = null, projectPath: string | null = null) {
    this.projectId = projectId
    this.projectPath = projectPath
    this.agentsDir = pathManager.getAgentsPath(projectId)
    this.cache = new Map()
  }

  /**
   * Initialize hierarchical agent resolution for a project path
   */
  async initializeHierarchical(projectPath: string): Promise<void> {
    this.projectPath = projectPath
    this.hierarchicalResolver = new HierarchicalAgentResolver(projectPath)
    await this.hierarchicalResolver.initialize()
  }

  /**
   * Load an agent from its file
   */
  async loadAgent(agentName: string): Promise<Agent | null> {
    // Check cache first
    const cacheKey = `${this.projectId || 'global'}-${agentName}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    try {
      const agentPath = path.join(this.agentsDir, `${agentName}.md`)
      const content = await fs.readFile(agentPath, 'utf-8')

      // Parse agent metadata from content (including frontmatter)
      const { effort, model } = this.extractFrontmatterMeta(content)
      const agent: Agent = {
        name: agentName,
        content,
        path: agentPath,
        role: this.extractRole(content),
        domain: this.extractDomain(content),
        skills: this.extractSkills(content),
        effort,
        model,
        modified: (await fs.stat(agentPath)).mtime,
      }

      // Cache it
      this.cache.set(cacheKey, agent)

      return agent
    } catch (error) {
      if (isNotFoundError(error)) {
        return null // Agent file doesn't exist
      }
      throw error
    }
  }

  /**
   * Load all agents for the project
   *
   * Uses parallel file reads for performance (PRJ-110).
   */
  async loadAllAgents(): Promise<Agent[]> {
    try {
      const files = await fs.readdir(this.agentsDir)
      const agentFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('.'))

      // Load all agents in parallel
      const agentPromises = agentFiles.map((file) => {
        const agentName = file.replace('.md', '')
        return this.loadAgent(agentName)
      })

      const results = await Promise.all(agentPromises)
      return results.filter((agent): agent is Agent => agent !== null)
    } catch (error) {
      if (isNotFoundError(error)) {
        return [] // Agents directory doesn't exist yet
      }
      throw error
    }
  }

  /**
   * Check if an agent exists
   */
  async agentExists(agentName: string): Promise<boolean> {
    try {
      const agentPath = path.join(this.agentsDir, `${agentName}.md`)
      await fs.access(agentPath)
      return true
    } catch (_error) {
      return false
    }
  }

  /**
   * Clear cache (useful after agent updates)
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Extract role from agent content
   */
  private extractRole(content: string): string | null {
    const roleMatch = content.match(/Role:\s*(.+)/i)
    return roleMatch ? roleMatch[1].trim() : null
  }

  /**
   * Extract domain from agent content
   */
  private extractDomain(content: string): string {
    const domainMatch = content.match(/DOMAIN AUTHORITY[\s\S]*?the\s+(\w+)\s+domain/i)
    if (domainMatch) {
      return domainMatch[1].toLowerCase()
    }

    return 'general'
  }

  /**
   * Extract skills/technologies mentioned in agent content
   */
  private extractSkills(content: string): string[] {
    const skills: string[] = []

    // Look for common technology mentions
    const techKeywords = [
      'React',
      'Vue',
      'Angular',
      'Svelte',
      'Next.js',
      'Nuxt',
      'SvelteKit',
      'TypeScript',
      'JavaScript',
      'Node.js',
      'Express',
      'Fastify',
      'Python',
      'Django',
      'Flask',
      'FastAPI',
      'Go',
      'Rust',
      'Ruby',
      'Rails',
      'PostgreSQL',
      'MySQL',
      'MongoDB',
      'Docker',
      'Kubernetes',
      'Terraform',
    ]

    for (const tech of techKeywords) {
      if (content.includes(tech)) {
        skills.push(tech)
      }
    }

    return skills
  }

  /**
   * Extract effort and model from YAML frontmatter
   */
  private extractFrontmatterMeta(content: string): {
    effort?: 'low' | 'medium' | 'high' | 'max'
    model?: string
  } {
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
    if (!frontmatterMatch) return {}

    const fm = frontmatterMatch[1]
    const result: { effort?: 'low' | 'medium' | 'high' | 'max'; model?: string } = {}

    const effortMatch = fm.match(/^effort:\s*(.+)$/m)
    if (effortMatch) {
      const val = effortMatch[1].trim().replace(/['"]/g, '') as 'low' | 'medium' | 'high' | 'max'
      if (['low', 'medium', 'high', 'max'].includes(val)) {
        result.effort = val
      }
    }

    const modelMatch = fm.match(/^model:\s*(.+)$/m)
    if (modelMatch) {
      result.model = modelMatch[1].trim().replace(/['"]/g, '')
    }

    return result
  }

  /**
   * Get agents directory path
   */
  getAgentsDir(): string {
    return this.agentsDir
  }

  // ==========================================================================
  // HIERARCHICAL AGENTS.md SUPPORT
  // ==========================================================================

  /**
   * Load agents from hierarchical AGENTS.md files for a specific path
   * Returns agents resolved from the directory tree
   */
  async loadHierarchicalAgents(targetPath?: string): Promise<Agent[]> {
    if (!this.hierarchicalResolver) {
      if (this.projectPath) {
        await this.initializeHierarchical(this.projectPath)
      } else {
        return [] // No project path, can't resolve hierarchical agents
      }
    }

    const result = await this.hierarchicalResolver!.resolveAgentsForPath(
      targetPath || this.projectPath || process.cwd()
    )

    return result.agents.map((ha) => this.hierarchicalAgentToAgent(ha))
  }

  /**
   * Load a specific agent from AGENTS.md hierarchy
   */
  async loadHierarchicalAgent(agentName: string, targetPath?: string): Promise<Agent | null> {
    if (!this.hierarchicalResolver) {
      if (this.projectPath) {
        await this.initializeHierarchical(this.projectPath)
      } else {
        return null
      }
    }

    const agent = await this.hierarchicalResolver!.getAgentByName(
      agentName,
      targetPath || this.projectPath || undefined
    )

    return agent ? this.hierarchicalAgentToAgent(agent) : null
  }

  /**
   * Load all agents, merging generated files with AGENTS.md definitions
   * Generated files take precedence for content, but AGENTS.md provides
   * additional rules/triggers/patterns
   */
  async loadAllAgentsMerged(targetPath?: string): Promise<Agent[]> {
    // Load both sources
    const fileAgents = await this.loadAllAgents()
    const hierarchicalAgents = await this.loadHierarchicalAgents(targetPath)

    // Create a map for merging
    const mergedMap = new Map<string, Agent>()

    // First, add all hierarchical agents
    for (const agent of hierarchicalAgents) {
      mergedMap.set(agent.name.toLowerCase(), agent)
    }

    // Then, overlay with file agents (they take precedence for content)
    for (const agent of fileAgents) {
      const existing = mergedMap.get(agent.name.toLowerCase())
      if (existing && existing.source === 'hierarchical') {
        // Merge: file content + hierarchical metadata
        mergedMap.set(agent.name.toLowerCase(), {
          ...agent,
          source: 'file',
          hierarchySources: existing.hierarchySources,
          // Append hierarchical rules/patterns to content if present
          content: this.mergeAgentContent(agent.content, existing),
        })
      } else {
        mergedMap.set(agent.name.toLowerCase(), {
          ...agent,
          source: 'file',
        })
      }
    }

    return Array.from(mergedMap.values())
  }

  /**
   * Check if hierarchical agents are available for this project
   */
  async hasHierarchicalAgents(): Promise<boolean> {
    if (!this.hierarchicalResolver && this.projectPath) {
      await this.initializeHierarchical(this.projectPath)
    }

    if (!this.hierarchicalResolver) {
      return false
    }

    const tree = await this.hierarchicalResolver.getAgentFileTree()
    return tree.length > 0
  }

  /**
   * Get all agent names available (from both sources)
   */
  async getAllAgentNames(): Promise<string[]> {
    const names = new Set<string>()

    // From generated files
    const fileAgents = await this.loadAllAgents()
    for (const agent of fileAgents) {
      names.add(agent.name)
    }

    // From AGENTS.md hierarchy
    if (this.hierarchicalResolver || this.projectPath) {
      if (!this.hierarchicalResolver && this.projectPath) {
        await this.initializeHierarchical(this.projectPath)
      }
      if (this.hierarchicalResolver) {
        const hierarchicalNames = await this.hierarchicalResolver.getAllAgentNames()
        for (const name of hierarchicalNames) {
          names.add(name)
        }
      }
    }

    return Array.from(names).sort()
  }

  /**
   * Convert HierarchicalAgent to Agent interface
   */
  private hierarchicalAgentToAgent(ha: HierarchicalAgent): Agent {
    const resolver = this.hierarchicalResolver!
    const content = resolver.generateAgentMarkdown(ha)

    return {
      name: ha.name,
      content,
      path: `AGENTS.md:${ha.name}`,
      role: ha.description.split('\n')[0] || null,
      domain: ha.domain || 'general',
      skills: ha.triggers, // Use triggers as skills for routing
      modified: new Date(),
      source: 'hierarchical',
      hierarchySources: ha.sources,
    }
  }

  /**
   * Merge file agent content with hierarchical metadata
   */
  private mergeAgentContent(fileContent: string, hierarchical: Agent): string {
    // If the hierarchical agent has rules/patterns not in file content,
    // append them as additional sections
    const additions: string[] = []

    // Check if file content already has the hierarchical rules
    if (hierarchical.hierarchySources && hierarchical.hierarchySources.length > 0) {
      additions.push('')
      additions.push('---')
      additions.push(`*Extended from: ${hierarchical.hierarchySources.join(' → ')}*`)
    }

    if (additions.length > 0) {
      return fileContent + additions.join('\n')
    }

    return fileContent
  }
}

export default AgentLoader
