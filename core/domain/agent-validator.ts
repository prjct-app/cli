/**
 * AgentValidator - Validates agents before and after generation
 *
 * Ensures agents are useful and not generic
 * Compares with existing agents before generating
 *
 * @version 1.0.0
 */

interface AgentConfig {
  expertise?: string
  domain?: string
  projectContext?: Record<string, unknown>
}

interface Agent {
  name: string
  content?: string
  skills?: string[]
  domain?: string
  role?: string
}

interface ValidationResult {
  valid: boolean
  issues: string[]
  warnings: string[]
  similarAgent?: Agent | null
  usefulness?: number
}

class AgentValidator {
  /**
   * Validate if agent should be generated
   */
  validateBeforeGeneration(
    agentName: string,
    config: AgentConfig,
    existingAgents: Agent[] = []
  ): ValidationResult {
    const issues: string[] = []
    const warnings: string[] = []

    // Check if similar agent exists
    const similar = this.findSimilarAgent(agentName, config, existingAgents)
    if (similar) {
      warnings.push(`Similar agent exists: ${similar.name}`)
    }

    // Check if agent has specific skills
    if (!config.expertise || config.expertise.length < 10) {
      issues.push('Agent expertise is too generic')
    }

    // Check if agent has project context
    if (!config.projectContext || Object.keys(config.projectContext).length === 0) {
      warnings.push('Agent has no project-specific context')
    }

    // Check if agent name is descriptive
    if (agentName.includes('specialist') && !config.expertise) {
      issues.push('Agent name suggests specialization but has no expertise defined')
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      similarAgent: similar,
    }
  }

  /**
   * Validate agent after generation
   */
  validateAfterGeneration(agent: Agent): ValidationResult {
    const issues: string[] = []
    const warnings: string[] = []

    // Check if agent has content
    if (!agent.content || agent.content.length < 100) {
      issues.push('Agent content is too short or missing')
    }

    // Check if agent has skills extracted
    if (!agent.skills || agent.skills.length === 0) {
      warnings.push('Agent has no skills detected')
    }

    // Check if agent has domain
    if (!agent.domain || agent.domain === 'general') {
      warnings.push('Agent domain is generic')
    }

    // Check if agent is useful (not too generic)
    const usefulness = this.calculateUsefulness(agent)
    if (usefulness < 0.5) {
      issues.push('Agent is too generic to be useful')
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      usefulness,
    }
  }

  /**
   * Find similar existing agent
   */
  findSimilarAgent(agentName: string, config: AgentConfig, existingAgents: Agent[]): Agent | null {
    for (const existing of existingAgents) {
      // Check name similarity
      if (this.namesSimilar(agentName, existing.name)) {
        return existing
      }

      // Check domain similarity
      if (config.domain && existing.domain && config.domain === existing.domain) {
        // Check if skills overlap significantly
        const skillOverlap = this.calculateSkillOverlap(config, existing)
        if (skillOverlap > 0.7) {
          return existing
        }
      }
    }

    return null
  }

  /**
   * Check if agent names are similar
   */
  namesSimilar(name1: string, name2: string): boolean {
    const n1 = name1.toLowerCase()
    const n2 = name2.toLowerCase()

    // Exact match
    if (n1 === n2) return true

    // One contains the other
    if (n1.includes(n2) || n2.includes(n1)) return true

    // Check word overlap
    const words1 = new Set(n1.split('-'))
    const words2 = new Set(n2.split('-'))
    const intersection = new Set([...words1].filter((w) => words2.has(w)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size > 0.5
  }

  /**
   * Calculate skill overlap between config and existing agent
   */
  calculateSkillOverlap(config: AgentConfig, existingAgent: Agent): number {
    if (!existingAgent.skills || existingAgent.skills.length === 0) {
      return 0
    }

    // Extract skills from config expertise
    const configSkills = this.extractSkillsFromText(config.expertise || '')
    if (configSkills.length === 0) {
      return 0
    }

    // Calculate overlap
    const existingSet = new Set(existingAgent.skills.map((s) => s.toLowerCase()))
    const configSet = new Set(configSkills.map((s) => s.toLowerCase()))

    const intersection = new Set([...existingSet].filter((s) => configSet.has(s)))
    const union = new Set([...existingSet, ...configSet])

    return intersection.size / union.size
  }

  /**
   * Extract skills from text
   */
  extractSkillsFromText(text: string): string[] {
    // Common technology keywords
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
    ]

    return techKeywords.filter((tech) => text.toLowerCase().includes(tech.toLowerCase()))
  }

  /**
   * Calculate agent usefulness score
   */
  calculateUsefulness(agent: Agent): number {
    let score = 0

    // Has skills
    if (agent.skills && agent.skills.length > 0) {
      score += 0.3
      if (agent.skills.length > 3) {
        score += 0.1 // Bonus for multiple skills
      }
    }

    // Has specific domain
    if (agent.domain && agent.domain !== 'general') {
      score += 0.2
    }

    // Has content
    if (agent.content && agent.content.length > 200) {
      score += 0.2
    }

    // Has role
    if (agent.role && agent.role.length > 10) {
      score += 0.1
    }

    // Not generic name
    if (agent.name && !agent.name.includes('generalist')) {
      score += 0.1
    }

    return Math.min(score, 1.0)
  }
}

export default AgentValidator
