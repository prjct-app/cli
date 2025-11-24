/**
 * AgentLoader - Loads agents from project files
 * 
 * CRITICAL: This ensures agents generated for a project are actually USED
 * 
 * @version 1.0.0
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')

class AgentLoader {
  constructor(projectId = null) {
    this.projectId = projectId
    this.agentsDir = projectId
      ? path.join(os.homedir(), '.prjct-cli', 'projects', projectId, 'agents')
      : path.join(os.homedir(), '.prjct-cli', 'agents')
    this.cache = new Map()
  }

  /**
   * Load an agent from its file
   * @param {string} agentName - Name of the agent (without .md extension)
   * @returns {Promise<Object|null>} - Agent object with name and content, or null if not found
   */
  async loadAgent(agentName) {
    // Check cache first
    const cacheKey = `${this.projectId || 'global'}-${agentName}`
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }

    try {
      const agentPath = path.join(this.agentsDir, `${agentName}.md`)
      const content = await fs.readFile(agentPath, 'utf-8')

      // Parse agent metadata from content
      const agent = {
        name: agentName,
        content,
        path: agentPath,
        // Extract role if present in content
        role: this.extractRole(content),
        // Extract domain if present
        domain: this.extractDomain(content),
        // Extract skills/technologies mentioned
        skills: this.extractSkills(content),
        // Last modified time
        modified: (await fs.stat(agentPath)).mtime
      }

      // Cache it
      this.cache.set(cacheKey, agent)

      return agent
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null // Agent file doesn't exist
      }
      throw error
    }
  }

  /**
   * Load all agents for the project
   * @returns {Promise<Array<Object>>} - Array of agent objects
   */
  async loadAllAgents() {
    try {
      const files = await fs.readdir(this.agentsDir)
      const agentFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'))

      const agents = []
      for (const file of agentFiles) {
        const agentName = file.replace('.md', '')
        const agent = await this.loadAgent(agentName)
        if (agent) {
          agents.push(agent)
        }
      }

      return agents
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [] // Agents directory doesn't exist yet
      }
      throw error
    }
  }

  /**
   * Check if an agent exists
   * @param {string} agentName - Name of the agent
   * @returns {Promise<boolean>} - True if agent file exists
   */
  async agentExists(agentName) {
    try {
      const agentPath = path.join(this.agentsDir, `${agentName}.md`)
      await fs.access(agentPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clear cache (useful after agent updates)
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Extract role from agent content
   * @private
   */
  extractRole(content) {
    const roleMatch = content.match(/Role:\s*(.+)/i)
    return roleMatch ? roleMatch[1].trim() : null
  }

  /**
   * Extract domain from agent content
   * @private
   */
  extractDomain(content) {
    const domainMatch = content.match(/DOMAIN AUTHORITY[\s\S]*?the\s+(\w+)\s+domain/i)
    if (domainMatch) {
      return domainMatch[1].toLowerCase()
    }
    
    // Fallback: try to detect from agent name
    const name = this.projectId ? '' : ''
    if (name.includes('frontend')) return 'frontend'
    if (name.includes('backend')) return 'backend'
    if (name.includes('database')) return 'database'
    if (name.includes('devops')) return 'devops'
    if (name.includes('qa')) return 'qa'
    if (name.includes('architect')) return 'architecture'
    
    return 'general'
  }

  /**
   * Extract skills/technologies mentioned in agent content
   * @private
   */
  extractSkills(content) {
    const skills = []
    
    // Look for common technology mentions
    const techKeywords = [
      'React', 'Vue', 'Angular', 'Svelte',
      'Next.js', 'Nuxt', 'SvelteKit',
      'TypeScript', 'JavaScript',
      'Node.js', 'Express', 'Fastify',
      'Python', 'Django', 'Flask', 'FastAPI',
      'Go', 'Rust', 'Ruby', 'Rails',
      'PostgreSQL', 'MySQL', 'MongoDB',
      'Docker', 'Kubernetes', 'Terraform'
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
   * @returns {string} - Path to agents directory
   */
  getAgentsDir() {
    return this.agentsDir
  }
}

module.exports = AgentLoader

