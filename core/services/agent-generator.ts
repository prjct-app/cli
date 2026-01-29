/**
 * AgentGenerator - Domain and workflow agent generation
 *
 * Extracted from sync-service.ts for single responsibility.
 * Generates agent markdown files based on project stack.
 *
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import { type StackDetection } from './stack-detector'

// ============================================================================
// TYPES
// ============================================================================

export interface AgentInfo {
  name: string
  type: 'workflow' | 'domain'
  skill?: string
}

export interface ProjectStats {
  fileCount: number
  version: string
  name: string
  ecosystem: string
  projectType: string
  languages: string[]
  frameworks: string[]
}

// ============================================================================
// AGENT GENERATOR CLASS
// ============================================================================

export class AgentGenerator {
  private agentsPath: string
  private templatesPath: string

  constructor(agentsPath: string, templatesPath?: string) {
    this.agentsPath = agentsPath
    this.templatesPath = templatesPath || path.join(__dirname, '..', '..', 'templates', 'subagents')
  }

  /**
   * Generate all agents based on stack detection
   */
  async generate(stack: StackDetection, stats: ProjectStats): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = []

    // Purge old agents
    await this.purgeOldAgents()

    // Workflow agents (always generated) - IN PARALLEL
    const workflowAgents = await this.generateWorkflowAgents()
    agents.push(...workflowAgents)

    // Domain agents (based on stack) - IN PARALLEL
    const domainAgents = await this.generateDomainAgents(stack, stats)
    agents.push(...domainAgents)

    return agents
  }

  /**
   * Remove existing agent files
   */
  private async purgeOldAgents(): Promise<void> {
    try {
      const files = await fs.readdir(this.agentsPath)
      await Promise.all(
        files
          .filter(file => file.endsWith('.md'))
          .map(file => fs.unlink(path.join(this.agentsPath, file)))
      )
    } catch {
      // Directory might not exist yet
    }
  }

  /**
   * Generate workflow agents (always included)
   */
  private async generateWorkflowAgents(): Promise<AgentInfo[]> {
    const workflowAgentNames = ['prjct-workflow', 'prjct-planner', 'prjct-shipper']

    await Promise.all(
      workflowAgentNames.map(name => this.generateWorkflowAgent(name))
    )

    return workflowAgentNames.map(name => ({ name, type: 'workflow' as const }))
  }

  /**
   * Generate domain agents based on stack
   */
  private async generateDomainAgents(
    stack: StackDetection,
    stats: ProjectStats
  ): Promise<AgentInfo[]> {
    const agentsToGenerate: { name: string; skill?: string }[] = []

    if (stack.hasFrontend) {
      agentsToGenerate.push({ name: 'frontend', skill: 'javascript-typescript' })
      agentsToGenerate.push({ name: 'uxui', skill: 'frontend-design' })
    }
    if (stack.hasBackend) {
      agentsToGenerate.push({ name: 'backend', skill: 'javascript-typescript' })
    }
    if (stack.hasDatabase) {
      agentsToGenerate.push({ name: 'database' })
    }
    if (stack.hasTesting) {
      agentsToGenerate.push({ name: 'testing', skill: 'developer-kit' })
    }
    if (stack.hasDocker) {
      agentsToGenerate.push({ name: 'devops', skill: 'developer-kit' })
    }

    // Generate all domain agents IN PARALLEL
    await Promise.all(
      agentsToGenerate.map(agent =>
        this.generateDomainAgent(agent.name, stats, stack)
      )
    )

    return agentsToGenerate.map(agent => ({
      name: agent.name,
      type: 'domain' as const,
      skill: agent.skill,
    }))
  }

  /**
   * Generate a single workflow agent
   */
  private async generateWorkflowAgent(name: string): Promise<void> {
    let content = ''

    try {
      const templatePath = path.join(this.templatesPath, 'workflow', `${name}.md`)
      content = await fs.readFile(templatePath, 'utf-8')
    } catch {
      // Generate minimal agent
      content = this.generateMinimalWorkflowAgent(name)
    }

    await fs.writeFile(path.join(this.agentsPath, `${name}.md`), content, 'utf-8')
  }

  /**
   * Generate a single domain agent
   */
  private async generateDomainAgent(
    name: string,
    stats: ProjectStats,
    stack: StackDetection
  ): Promise<void> {
    let content = ''

    try {
      const templatePath = path.join(this.templatesPath, 'domain', `${name}.md`)
      content = await fs.readFile(templatePath, 'utf-8')

      // Inject project-specific context
      content = content.replace('{projectName}', stats.name)
      content = content.replace('{frameworks}', stack.frameworks.join(', ') || 'None detected')
      content = content.replace('{ecosystem}', stats.ecosystem)
    } catch {
      // Generate minimal agent
      content = this.generateMinimalDomainAgent(name, stats, stack)
    }

    await fs.writeFile(path.join(this.agentsPath, `${name}.md`), content, 'utf-8')
  }

  /**
   * Generate minimal workflow agent content
   */
  private generateMinimalWorkflowAgent(name: string): string {
    const descriptions: Record<string, string> = {
      'prjct-workflow': 'Task lifecycle: now, done, pause, resume',
      'prjct-planner': 'Planning: task, prd, spec, bug',
      'prjct-shipper': 'Shipping: ship, merge, review',
    }

    return `---
name: ${name}
description: ${descriptions[name] || 'Workflow agent'}
tools: Read, Write, Glob
---

# ${name.toUpperCase()}

Workflow agent for prjct operations.

## Project Context

When invoked:
1. Read \`.prjct/prjct.config.json\` → extract \`projectId\`
2. Read \`~/.prjct-cli/projects/{projectId}/storage/state.json\`
3. Execute requested operation
`
  }

  /**
   * Generate minimal domain agent content
   */
  private generateMinimalDomainAgent(
    name: string,
    stats: ProjectStats,
    stack: StackDetection
  ): string {
    return `---
name: ${name}
description: ${name.charAt(0).toUpperCase() + name.slice(1)} specialist for ${stats.name}
tools: Read, Write, Glob, Grep
skills: []
---

# ${name.toUpperCase()} AGENT

Domain specialist for ${name} tasks.

## Project Context

- **Project**: ${stats.name}
- **Ecosystem**: ${stats.ecosystem}
- **Frameworks**: ${stack.frameworks.join(', ') || 'None detected'}

## Your Role

You are the ${name} expert for this project. Apply best practices for the detected stack.
`
  }
}

export const createAgentGenerator = (agentsPath: string) => new AgentGenerator(agentsPath)
export default AgentGenerator
