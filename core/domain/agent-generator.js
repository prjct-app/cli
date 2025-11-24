const fs = require('fs').promises
const path = require('path')
const os = require('os')
const AgentLoader = require('./agent-loader')

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
    this.loader = new AgentLoader(projectId)
  }

  /**
   * Generate specialized agent with deep expertise
   * Universal - works with ANY technology stack
   */
  async generateDynamicAgent(agentName, config) {
    console.log(`   🤖 Generating ${agentName} agent...`)
    await fs.mkdir(this.outputDir, { recursive: true })

    // Generate concise, actionable agent prompt
    const content = this.buildAgentPrompt(agentName, config)

    const outputPath = path.join(this.outputDir, `${agentName}.md`)
    await fs.writeFile(outputPath, content, 'utf-8')
    console.log(`   ✅ ${agentName} agent created`)

    return { name: agentName }
  }

  /**
   * Build comprehensive agent prompt
   */
  buildAgentPrompt(agentName, config) {
    const domain = config.domain || 'general';
    
    const projectContext = (typeof config.projectContext === 'object')
      ? JSON.stringify(config.projectContext || {}, null, 2)
      : (config.projectContext || 'No specific project context provided.');

    return `# AGENT: ${agentName.toUpperCase()}
Role: ${config.role || agentName}

## META-INSTRUCTION
You are an intelligent agent responsible for this domain.
Your first task is to ANALYZE the provided PROJECT CONTEXT to determine:
1. The technology stack being used.
2. The architectural patterns in place.
3. The specific best practices relevant to this stack.

## DOMAIN AUTHORITY
You are the owner of the ${domain} domain.
You have full authority to make technical decisions within this scope.

## DYNAMIC STANDARDS
Instead of following a hardcoded list, you must:
- **DETECT**: Identify the languages, frameworks, and tools from the file extensions and content.
- **ADAPT**: Adopt the persona of a Senior Engineer specializing in the detected stack.
- **ENFORCE**: Apply the idiomatic best practices, naming conventions, and patterns of that stack.

## ORCHESTRATION PROTOCOL
1. **ANALYZE**: Read the context. Determine the stack.
2. **PLAN**: Create a plan that fits the detected architecture.
3. **EXECUTE**: Implement using the detected tools and patterns.
4. **VERIFY**: Ensure code matches the project's existing style.

## PROJECT CONTEXT
${projectContext}

## CONTEXT FOCUS
${config.contextFilter || 'Only relevant files'}

## RULES
- Stay in your domain (${domain})
- Do not assume a specific stack until you see the code.
- Optimize for production.
- No explanations unless asked.
`;
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

  /**
   * Load an agent from its file
   * CRITICAL: This is how agents are actually used in prompts
   * @param {string} agentName - Name of the agent (without .md extension)
   * @returns {Promise<Object|null>} - Agent object with name, content, role, domain, skills, or null if not found
   */
  async loadAgent(agentName) {
    return await this.loader.loadAgent(agentName)
  }

  /**
   * Load all agents for the project
   * @returns {Promise<Array<Object>>} - Array of agent objects
   */
  async loadAllAgents() {
    return await this.loader.loadAllAgents()
  }

  /**
   * Check if an agent exists
   * @param {string} agentName - Name of the agent
   * @returns {Promise<boolean>} - True if agent file exists
   */
  async agentExists(agentName) {
    return await this.loader.agentExists(agentName)
  }
}

module.exports = AgentGenerator
