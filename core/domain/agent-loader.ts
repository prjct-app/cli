/**
 * AgentLoader - Loads agents from project files
 *
 * CRITICAL: This ensures agents generated for a project are actually USED
 *
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import pathManager from '../infrastructure/path-manager'
import { isNotFoundError } from '../types/fs'

interface Agent {
  name: string
  content: string
  path: string
  role: string | null
  domain: string
  skills: string[]
  modified: Date
}

class AgentLoader {
  projectId: string | null
  agentsDir: string
  cache: Map<string, Agent>

  constructor(projectId: string | null = null) {
    this.projectId = projectId
    this.agentsDir = pathManager.getAgentsPath(projectId)
    this.cache = new Map()
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

      // Parse agent metadata from content
      const agent: Agent = {
        name: agentName,
        content,
        path: agentPath,
        role: this.extractRole(content),
        domain: this.extractDomain(content),
        skills: this.extractSkills(content),
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
   */
  async loadAllAgents(): Promise<Agent[]> {
    try {
      const files = await fs.readdir(this.agentsDir)
      const agentFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('.'))

      const agents: Agent[] = []
      for (const file of agentFiles) {
        const agentName = file.replace('.md', '')
        const agent = await this.loadAgent(agentName)
        if (agent) {
          agents.push(agent)
        }
      }

      return agents
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
   * Get agents directory path
   */
  getAgentsDir(): string {
    return this.agentsDir
  }
}

export default AgentLoader
