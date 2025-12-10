/**
 * AgentGenerator - Universal Dynamic Agent Generation
 * Optimized for minimal context usage
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import AgentLoader from './agent-loader'
import log from '../utils/logger'

interface AgentConfig {
  role?: string
  domain?: string
  projectContext?: Record<string, unknown> | string
  expertise?: string
  contextFilter?: string
}

interface TechSummary {
  languages: string[]
  frameworks: string[]
  buildTools: string[]
  testFrameworks: string[]
  databases: string[]
  tools: string[]
  allDependencies: string[]
}

interface GenerateContext {
  detectedTech: TechSummary
  analysisSummary?: string
  projectPath?: string
}

interface Agent {
  name: string
  content?: string
  path?: string
  role?: string | null
  domain?: string
  skills?: string[]
  modified?: Date
}

class AgentGenerator {
  projectId: string | null
  outputDir: string
  loader: AgentLoader

  constructor(projectId: string | null = null) {
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
  async generateDynamicAgent(agentName: string, config: AgentConfig): Promise<{ name: string }> {
    log.debug(`Generating ${agentName} agent...`)
    await fs.mkdir(this.outputDir, { recursive: true })

    // Generate concise, actionable agent prompt
    const content = this.buildAgentPrompt(agentName, config)

    const outputPath = path.join(this.outputDir, `${agentName}.md`)
    await fs.writeFile(outputPath, content, 'utf-8')
    log.debug(`${agentName} agent created`)

    return { name: agentName }
  }

  /**
   * Generate agents from tech analysis - 100% AGENTIC
   * Claude decides what agents are needed based on actual project tech
   * NO HARDCODED LISTS - reads analysis and decides
   */
  async generateAgentsFromTech(context: GenerateContext): Promise<Array<{ name: string }>> {
    const { detectedTech } = context
    const agents: string[] = []

    // Read agent generation template - Claude will use this to decide
    const templatePath = path.join(__dirname, '../../templates/agents/AGENTS.md')
    try {
      await fs.readFile(templatePath, 'utf-8')
    } catch {
      // Fallback if template doesn't exist
    }

    // Build context for Claude to decide
    const techSummary: TechSummary = {
      languages: detectedTech.languages || [],
      frameworks: detectedTech.frameworks || [],
      buildTools: detectedTech.buildTools || [],
      testFrameworks: detectedTech.testFrameworks || [],
      databases: detectedTech.databases || [],
      tools: detectedTech.tools || [],
      allDependencies: detectedTech.allDependencies || [],
    }

    // Generate agents for detected domains
    if (techSummary.languages.length > 0 || techSummary.frameworks.length > 0) {
      await this.generateDynamicAgent('developer', {
        role: 'Development Specialist',
        domain: 'general',
        projectContext: techSummary,
      })
      agents.push('developer')
    }

    return agents.map((name) => ({ name }))
  }

  /**
   * Build comprehensive agent prompt
   */
  buildAgentPrompt(agentName: string, config: AgentConfig): string {
    const domain = config.domain || 'general'

    const projectContext =
      typeof config.projectContext === 'object'
        ? JSON.stringify(config.projectContext || {}, null, 2)
        : config.projectContext || 'No specific project context provided.'

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
`
  }

  /**
   * Remove agents that are no longer needed
   */
  async cleanupObsoleteAgents(requiredAgents: string[]): Promise<string[]> {
    const removed: string[] = []

    try {
      const files = await fs.readdir(this.outputDir)
      const agentFiles = files.filter((f) => f.endsWith('.md') && !f.startsWith('.'))

      for (const file of agentFiles) {
        const type = file.replace('.md', '')

        if (!requiredAgents.includes(type)) {
          const filePath = path.join(this.outputDir, file)
          await fs.unlink(filePath)
          removed.push(type)
          log.debug(`${type} agent removed`)
        }
      }
    } catch (error) {
      log.error('Agent cleanup failed:', (error as Error).message)
    }

    return removed
  }

  /**
   * List all existing agents
   */
  async listAgents(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir)
      return files.filter((f) => f.endsWith('.md') && !f.startsWith('.')).map((f) => f.replace('.md', ''))
    } catch {
      return []
    }
  }

  /**
   * Load an agent from its file
   */
  async loadAgent(agentName: string): Promise<Agent | null> {
    return await this.loader.loadAgent(agentName)
  }

  /**
   * Load all agents for the project
   */
  async loadAllAgents(): Promise<Agent[]> {
    return await this.loader.loadAllAgents()
  }

  /**
   * Check if an agent exists
   */
  async agentExists(agentName: string): Promise<boolean> {
    return await this.loader.agentExists(agentName)
  }
}

export default AgentGenerator
