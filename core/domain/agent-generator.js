const fs = require('fs').promises
const path = require('path')
const os = require('os')

/**
 * AgentGenerator - Dynamic agent generation for prjct-cli
 *
 * 100% AGENTIC - Claude decides which agents to create based on project analysis.
 * NO predetermined patterns, NO if/else logic, NO assumptions.
 *
 * @version 0.6.0 - Fully agentic refactor
 */
class AgentGenerator {
  constructor(projectId = null) {
    this.projectId = projectId

    // Agents are stored in global project directory
    if (projectId) {
      this.outputDir = path.join(os.homedir(), '.prjct-cli', 'projects', projectId, 'agents')
    } else {
      // Fallback for backwards compatibility
      this.outputDir = path.join(os.homedir(), '.prjct-cli', 'agents')
    }
  }

  /**
   * Generate a single agent dynamically
   * Claude (the LLM) decides which agents to create based on project analysis
   *
   * @param {string} agentName - Descriptive name (e.g., 'go-backend', 'vuejs-frontend', 'elixir-api')
   * @param {Object} config - Agent configuration
   * @param {string} config.role - Agent's role description
   * @param {string} config.expertise - Technologies and skills (specific versions, tools)
   * @param {string} config.responsibilities - What the agent handles in THIS project
   * @param {Object} config.projectContext - Project-specific context (optional)
   * @returns {Promise<void>}
   */
  async generateDynamicAgent(agentName, config) {
    console.log(`   🤖 Generating ${agentName} agent...`)

    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true })

    // Create agent content
    const content = `# ${config.role || agentName}

## Role
${config.role || 'Specialist for this project'}

## Expertise
${config.expertise || 'Technologies used in this project'}

## Responsibilities
${config.responsibilities || 'Handle specific aspects of development'}

## Project Context
${config.projectContext ? JSON.stringify(config.projectContext, null, 2) : 'No additional context'}

## Guidelines
- Focus on your area of expertise
- Collaborate with other agents
- Follow project conventions
- Ask clarifying questions when needed
`

    // Write agent file
    const outputPath = path.join(this.outputDir, `${agentName}.md`)
    await fs.writeFile(outputPath, content, 'utf-8')

    console.log(`   ✅ ${agentName} agent created`)
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
