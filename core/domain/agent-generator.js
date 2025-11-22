const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * AgentGenerator - Universal Dynamic Agent Generation
 * Optimized for minimal context usage
 * @version 1.0.0
 */
class AgentGenerator {
  constructor(projectId = null) {
    this.projectId = projectId
    this.outputDir = projectId
      ? path.join(os.homedir(), '.prjct-cli', 'projects', projectId, 'agents')
      : path.join(os.homedir(), '.prjct-cli', 'agents')
  }

  /**
   * Generate specialized agent with deep expertise
   * Universal - works with ANY technology stack
   */
  async generateDynamicAgent(agentName, config) {
    console.log(`   🤖 Generating ${agentName} agent...`)
    await fs.mkdir(this.outputDir, { recursive: true })

    // Extract technologies dynamically
    const techs = this.detectTechnologies(config)
    const expertise = this.buildExpertise(techs, config)

    // Generate concise, actionable agent prompt
    const content = `You are ${config.role || agentName}.

EXPERTISE: ${expertise}

FOCUS: ${config.contextFilter || 'Only relevant files'}

AUTHORITY: Make decisions. Don't ask permission. Execute.

RULES:
- Stay in your domain
- Use best practices for ${techs.join(', ') || 'detected tech'}
- Optimize for production
- No explanations unless asked`

    const outputPath = path.join(this.outputDir, `${agentName}.md`)
    await fs.writeFile(outputPath, content, 'utf-8')
    console.log(`   ✅ ${agentName} agent created`)

    return { name: agentName, expertise, techs }
  }

  /**
   * Detect technologies from config/analysis
   */
  detectTechnologies(config) {
    const techs = []

    // Extract from various sources
    if (config.techStack) techs.push(...config.techStack.languages || [])
    if (config.frameworks) techs.push(...config.frameworks)
    if (config.expertise) {
      // Parse expertise string for tech keywords
      const keywords = config.expertise.toLowerCase()
      const knownTechs = ['ruby', 'rails', 'go', 'rust', 'python', 'django', 'react', 'vue', 'node', 'typescript', 'elixir', 'phoenix']
      knownTechs.forEach(tech => {
        if (keywords.includes(tech)) techs.push(tech)
      })
    }

    return [...new Set(techs)]
  }

  /**
   * Build concise expertise string
   */
  buildExpertise(techs, config) {
    const tech = techs.length > 0 ? techs.join(', ') : 'detected stack'
    const domain = config.domain || 'assigned domain'
    const focus = config.responsibilities || 'task at hand'

    return `${tech} expert. ${domain}. Focus: ${focus}`
  }

  /**
   * Remove agents that are no longer needed
   * @param {Array} requiredAgents - List of agents that should exist
   * @returns {Promise<Array>} List of removed agents
   */
  async cleanupObsoleteAgents(requiredAgents) {
    const removed = []

    try {
      const files = await fs.readdir(this.outputDir)
      const agentFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('.'))

      for (const file of agentFiles) {
        const type = file.replace('.md', '')

        if (!requiredAgents.includes(type)) {
          const filePath = path.join(this.outputDir, file)
          await fs.unlink(filePath)
          removed.push(type)
          console.log(`   🗑️  ${type.toUpperCase()} agent removed (no longer needed)`)
        }
      }
    } catch (error) {
      console.error('Error during cleanup:', error.message)
    }

    return removed
  }

  /**
   * List all existing agents
   * @returns {Promise<Array>} List of agent names
   */
  async listAgents() {
    try {
      const files = await fs.readdir(this.outputDir)
      return files
        .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
        .map((f) => f.replace('.md', ''))
    } catch {
      return []
    }
  }
}

module.exports = AgentGenerator
