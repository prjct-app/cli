/**
 * AgentGenerator - Domain and workflow agent generation
 *
 * Extracted from sync-service.ts for single responsibility.
 * Generates agent markdown files based on project stack.
 *
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  hasPreservedSections,
  mergePreservedSections,
  validatePreserveBlocks,
} from '../utils/preserve-sections'
import { defaultToolRetryPolicy } from '../utils/retry'
import type { StackDetection } from './stack-detector'

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

/** Aggregated task feedback for agent generation (PRJ-272) */
export interface TaskFeedbackContext {
  patternsDiscovered: string[]
  knownGotchas: string[]
  agentAccuracy: Array<{ agent: string; rating: string; note?: string }>
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

  /** Task feedback context for agent generation (PRJ-272) */
  private feedbackContext?: TaskFeedbackContext

  /**
   * Generate all agents based on stack detection
   * Optionally accepts task feedback to influence agent content (PRJ-272)
   */
  async generate(
    stack: StackDetection,
    stats: ProjectStats,
    feedbackContext?: TaskFeedbackContext
  ): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = []
    this.feedbackContext = feedbackContext

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
   * Cache of existing agent content (for preserving user sections)
   */
  private existingAgents: Map<string, string> = new Map()

  /**
   * Read existing agents and cache their content for preservation
   * Then remove the files (they'll be regenerated with preserved sections)
   */
  private async purgeOldAgents(): Promise<void> {
    this.existingAgents.clear()

    try {
      const files = await fs.readdir(this.agentsPath)
      const mdFiles = files.filter((file) => file.endsWith('.md'))

      // Read all existing agent files BEFORE deleting
      await Promise.all(
        mdFiles.map(async (file) => {
          const filePath = path.join(this.agentsPath, file)
          try {
            const content = await fs.readFile(filePath, 'utf-8')
            // Only cache if it has user-preserved sections
            if (hasPreservedSections(content)) {
              this.existingAgents.set(file, content)
            }
          } catch {
            // File read failed, skip
          }
        })
      )

      // Now delete the files
      await Promise.all(mdFiles.map((file) => fs.unlink(path.join(this.agentsPath, file))))
    } catch {
      // Directory might not exist yet
    }
  }

  /**
   * Write agent file, preserving user sections from previous version
   */
  private async writeAgentWithPreservation(filename: string, content: string): Promise<void> {
    const existingContent = this.existingAgents.get(filename)

    let finalContent = content
    if (existingContent) {
      // Validate existing preserved blocks
      const validation = validatePreserveBlocks(existingContent)
      if (!validation.valid) {
        console.warn(`⚠️  Agent ${filename} has invalid preserve blocks:`)
        for (const error of validation.errors) {
          console.warn(`   ${error}`)
        }
      }

      // Merge preserved sections from old content
      finalContent = mergePreservedSections(content, existingContent)
    }

    await fs.writeFile(path.join(this.agentsPath, filename), finalContent, 'utf-8')
  }

  /**
   * Generate workflow agents (always included)
   */
  private async generateWorkflowAgents(): Promise<AgentInfo[]> {
    const workflowAgentNames = ['prjct-workflow', 'prjct-planner', 'prjct-shipper']

    await Promise.all(workflowAgentNames.map((name) => this.generateWorkflowAgent(name)))

    return workflowAgentNames.map((name) => ({ name, type: 'workflow' as const }))
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

    // Generate all domain agents IN PARALLEL with individual retry
    // Using Promise.allSettled() so one failure doesn't block others
    const results = await Promise.allSettled(
      agentsToGenerate.map((agent) =>
        defaultToolRetryPolicy.execute(
          async () => await this.generateDomainAgent(agent.name, stats, stack),
          `generate-agent-${agent.name}`
        )
      )
    )

    // Track which agents succeeded and which failed
    const successfulAgents: AgentInfo[] = []
    const failedAgents: string[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const agent = agentsToGenerate[i]

      if (result.status === 'fulfilled') {
        successfulAgents.push({
          name: agent.name,
          type: 'domain' as const,
          skill: agent.skill,
        })
      } else {
        failedAgents.push(agent.name)
        // Log failure but continue (don't throw)
        console.warn(`[prjct] Warning: Failed to generate agent: ${agent.name}`)
        if (result.reason) {
          console.warn(`[prjct]   Reason: ${result.reason.message || result.reason}`)
        }
      }
    }

    return successfulAgents
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

    await this.writeAgentWithPreservation(`${name}.md`, content)
  }

  /**
   * Generate a single domain agent
   * Injects task feedback learnings when available (PRJ-272)
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

    // Inject task feedback learnings (PRJ-272)
    content = this.injectFeedbackSection(content, name)

    await this.writeAgentWithPreservation(`${name}.md`, content)
  }

  /**
   * Inject a "Recent Learnings" section into agent content from task feedback (PRJ-272)
   * Only injects if there are relevant patterns, gotchas, or agent accuracy notes
   */
  private injectFeedbackSection(content: string, agentName: string): string {
    if (!this.feedbackContext) return content

    const { patternsDiscovered, knownGotchas, agentAccuracy } = this.feedbackContext

    // Filter agent accuracy notes relevant to this agent
    const agentNotes = agentAccuracy.filter(
      (a) => a.agent === `${agentName}.md` || a.agent === agentName
    )

    const hasContent =
      patternsDiscovered.length > 0 || knownGotchas.length > 0 || agentNotes.length > 0

    if (!hasContent) return content

    const lines: string[] = ['\n## Recent Learnings (from completed tasks)\n']

    if (patternsDiscovered.length > 0) {
      lines.push('### Discovered Patterns')
      for (const pattern of patternsDiscovered) {
        lines.push(`- ${pattern}`)
      }
      lines.push('')
    }

    if (knownGotchas.length > 0) {
      lines.push('### Known Gotchas')
      for (const gotcha of knownGotchas) {
        lines.push(`- ${gotcha}`)
      }
      lines.push('')
    }

    if (agentNotes.length > 0) {
      lines.push('### Agent Accuracy Notes')
      for (const note of agentNotes) {
        const desc = note.note ? ` — ${note.note}` : ''
        lines.push(`- ${note.rating}${desc}`)
      }
      lines.push('')
    }

    return content + lines.join('\n')
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
