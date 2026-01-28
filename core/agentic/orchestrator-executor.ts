/**
 * Orchestrator Executor
 *
 * EXECUTES orchestration in TypeScript - not just paths.
 * This module:
 * 1. Detects domains from task description
 * 2. Loads relevant agents from {globalPath}/agents/
 * 3. Loads skills from agent frontmatter
 * 4. Determines if task should be fragmented
 * 5. Creates subtasks in state.json if fragmented
 *
 * @module agentic/orchestrator-executor
 * @version 1.0.0
 */

import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import pathManager from '../infrastructure/path-manager'
import configManager from '../infrastructure/config-manager'
import { stateStorage } from '../storage'
import { isNotFoundError } from '../types/fs'
import { parseFrontmatter } from './template-loader'
import type {
  OrchestratorContext,
  LoadedAgent,
  LoadedSkill,
  OrchestratorSubtask,
} from '../types'

// =============================================================================
// Domain Detection Keywords
// =============================================================================

/**
 * Keywords that indicate a domain is involved in the task
 * These are hints, not absolute rules - context matters
 */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  database: [
    'database', 'db', 'sql', 'query', 'table', 'schema', 'migration',
    'postgres', 'mysql', 'sqlite', 'mongo', 'redis', 'prisma', 'drizzle',
    'orm', 'model', 'entity', 'repository', 'data layer', 'persist',
  ],
  backend: [
    'api', 'endpoint', 'route', 'server', 'controller', 'service',
    'middleware', 'auth', 'authentication', 'authorization', 'jwt', 'oauth',
    'rest', 'graphql', 'trpc', 'express', 'fastify', 'hono', 'nest',
    'validation', 'business logic',
  ],
  frontend: [
    'ui', 'component', 'page', 'form', 'button', 'input', 'modal', 'dialog',
    'react', 'vue', 'svelte', 'angular', 'next', 'nuxt', 'solid',
    'css', 'style', 'tailwind', 'layout', 'responsive', 'animation',
    'hook', 'state', 'context', 'redux', 'zustand', 'jotai',
  ],
  testing: [
    'test', 'spec', 'unit', 'integration', 'e2e', 'jest', 'vitest',
    'playwright', 'cypress', 'mocha', 'chai', 'mock', 'stub', 'fixture',
    'coverage', 'assertion',
  ],
  devops: [
    'docker', 'kubernetes', 'k8s', 'ci', 'cd', 'pipeline', 'deploy',
    'github actions', 'vercel', 'aws', 'gcp', 'azure', 'terraform',
    'nginx', 'caddy', 'env', 'environment', 'config', 'secret',
  ],
  uxui: [
    'design', 'ux', 'user experience', 'accessibility', 'a11y',
    'color', 'typography', 'spacing', 'prototype', 'wireframe',
    'figma', 'user flow', 'interaction',
  ],
}

/**
 * Domain dependency order - earlier domains should complete first
 */
const DOMAIN_DEPENDENCY_ORDER = [
  'database',
  'backend',
  'frontend',
  'testing',
  'devops',
]

// =============================================================================
// Orchestrator Executor Class
// =============================================================================

export class OrchestratorExecutor {
  /**
   * Main entry point - executes full orchestration
   *
   * @param command - The command being executed (e.g., 'task')
   * @param taskDescription - The task description from user
   * @param projectPath - Path to the project
   * @returns Full orchestrator context with loaded agents, skills, and subtasks
   */
  async execute(
    command: string,
    taskDescription: string,
    projectPath: string
  ): Promise<OrchestratorContext> {
    // Step 1: Get project info
    const projectId = await configManager.getProjectId(projectPath)
    const globalPath = pathManager.getGlobalProjectPath(projectId)

    // Step 2: Load repo analysis for ecosystem info
    const repoAnalysis = await this.loadRepoAnalysis(globalPath)

    // Step 3: Detect domains from task + project context
    const { domains, primary } = await this.detectDomains(
      taskDescription,
      projectId,
      repoAnalysis
    )

    // Step 4: Load agents for detected domains
    const agents = await this.loadAgents(domains, projectId)

    // Step 5: Load skills from agent frontmatter
    const skills = await this.loadSkills(agents)

    // Step 6: Determine if fragmentation is needed
    const requiresFragmentation = this.shouldFragment(domains, taskDescription)

    // Step 7: Create subtasks if fragmentation is required
    let subtasks: OrchestratorSubtask[] | null = null
    if (requiresFragmentation && command === 'task') {
      subtasks = await this.createSubtasks(
        taskDescription,
        domains,
        agents,
        projectId
      )
    }

    return {
      detectedDomains: domains,
      primaryDomain: primary,
      agents,
      skills,
      requiresFragmentation,
      subtasks,
      project: {
        id: projectId,
        ecosystem: repoAnalysis?.ecosystem || 'unknown',
        conventions: repoAnalysis?.conventions || [],
      },
    }
  }

  /**
   * Load repo-analysis.json for project context
   */
  private async loadRepoAnalysis(
    globalPath: string
  ): Promise<{ ecosystem: string; conventions: string[]; technologies?: string[] } | null> {
    try {
      const analysisPath = path.join(globalPath, 'analysis', 'repo-analysis.json')
      const content = await fs.readFile(analysisPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      if (isNotFoundError(error)) return null
      console.warn('Failed to load repo-analysis.json:', (error as Error).message)
      return null
    }
  }

  /**
   * Detect which domains are relevant for this task
   *
   * Uses keyword matching + project context to determine domains.
   * More intelligent than simple string matching - considers:
   * - Task description keywords
   * - Project technology stack
   * - Available agents
   */
  async detectDomains(
    taskDescription: string,
    projectId: string,
    repoAnalysis: { ecosystem: string; technologies?: string[] } | null
  ): Promise<{ domains: string[]; primary: string }> {
    const taskLower = taskDescription.toLowerCase()
    const detectedDomains: Map<string, number> = new Map()

    // Score each domain based on keyword matches
    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0
      for (const keyword of keywords) {
        if (taskLower.includes(keyword.toLowerCase())) {
          // Weight multi-word matches higher
          score += keyword.includes(' ') ? 3 : 1
        }
      }
      if (score > 0) {
        detectedDomains.set(domain, score)
      }
    }

    // Boost scores for domains that match project technologies
    if (repoAnalysis?.technologies) {
      const techStr = repoAnalysis.technologies.join(' ').toLowerCase()

      // If project has React/Vue/etc, boost frontend
      if (/react|vue|svelte|angular|next|nuxt/.test(techStr)) {
        const current = detectedDomains.get('frontend') || 0
        if (current > 0) detectedDomains.set('frontend', current + 2)
      }

      // If project has Express/Fastify/etc, boost backend
      if (/express|fastify|hono|nest|koa/.test(techStr)) {
        const current = detectedDomains.get('backend') || 0
        if (current > 0) detectedDomains.set('backend', current + 2)
      }

      // If project has Prisma/Drizzle/etc, boost database
      if (/prisma|drizzle|mongoose|typeorm|sequelize/.test(techStr)) {
        const current = detectedDomains.get('database') || 0
        if (current > 0) detectedDomains.set('database', current + 2)
      }
    }

    // Get available agents to filter domains
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const availableAgents = await this.getAvailableAgentNames(globalPath)

    // Only include domains that have corresponding agents
    const validDomains = Array.from(detectedDomains.entries())
      .filter(([domain]) => {
        // Check if agent exists for this domain
        return availableAgents.some(
          agent =>
            agent === domain ||
            agent.includes(domain) ||
            domain.includes(agent.replace('.md', ''))
        )
      })
      .sort((a, b) => b[1] - a[1]) // Sort by score descending
      .map(([domain]) => domain)

    // If no domains detected, default to 'general'
    if (validDomains.length === 0) {
      return { domains: ['general'], primary: 'general' }
    }

    // Primary is the highest scoring domain
    const primary = validDomains[0]

    return { domains: validDomains, primary }
  }

  /**
   * Get list of available agent file names
   */
  private async getAvailableAgentNames(globalPath: string): Promise<string[]> {
    try {
      const agentsDir = path.join(globalPath, 'agents')
      const files = await fs.readdir(agentsDir)
      return files.filter(f => f.endsWith('.md')).map(f => f.replace('.md', ''))
    } catch {
      return []
    }
  }

  /**
   * Load agents for the detected domains
   *
   * Reads agent markdown files from {globalPath}/agents/
   * and extracts their content and skills from frontmatter.
   */
  async loadAgents(domains: string[], projectId: string): Promise<LoadedAgent[]> {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const agentsDir = path.join(globalPath, 'agents')
    const agents: LoadedAgent[] = []

    for (const domain of domains) {
      // Try exact match first, then variations
      const possibleNames = [
        `${domain}.md`,
        `${domain}-agent.md`,
        `prjct-${domain}.md`,
      ]

      for (const fileName of possibleNames) {
        const filePath = path.join(agentsDir, fileName)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const { frontmatter, body } = this.parseAgentFile(content)

          agents.push({
            name: fileName.replace('.md', ''),
            domain,
            content: body,
            skills: frontmatter.skills || [],
            filePath,
          })

          // Found one, no need to try other variations
          break
        } catch {
          // Try next variation
          continue
        }
      }
    }

    return agents
  }

  /**
   * Parse agent markdown file to extract frontmatter and body
   */
  private parseAgentFile(content: string): {
    frontmatter: { skills?: string[]; [key: string]: unknown }
    body: string
  } {
    const parsed = parseFrontmatter(content)

    // Convert skills from string to array if needed
    const frontmatter = { ...parsed.frontmatter }
    if (typeof frontmatter.skills === 'string') {
      // Handle comma-separated string
      frontmatter.skills = (frontmatter.skills as string).split(',').map(s => s.trim())
    }

    return {
      frontmatter: frontmatter as { skills?: string[]; [key: string]: unknown },
      body: parsed.content
    }
  }

  /**
   * Load skills from agent frontmatter
   *
   * Skills are stored in ~/.claude/skills/{name}.md
   */
  async loadSkills(agents: LoadedAgent[]): Promise<LoadedSkill[]> {
    const skillsDir = path.join(os.homedir(), '.claude', 'skills')
    const skills: LoadedSkill[] = []
    const loadedSkillNames = new Set<string>()

    for (const agent of agents) {
      for (const skillName of agent.skills) {
        // Skip if already loaded
        if (loadedSkillNames.has(skillName)) continue

        // Check both patterns: flat file and subdirectory (ecosystem standard)
        const flatPath = path.join(skillsDir, `${skillName}.md`)
        const subdirPath = path.join(skillsDir, skillName, 'SKILL.md')

        let content: string | null = null
        let resolvedPath = flatPath

        // Prefer subdirectory format (ecosystem standard)
        try {
          content = await fs.readFile(subdirPath, 'utf-8')
          resolvedPath = subdirPath
        } catch {
          // Fall back to flat file
          try {
            content = await fs.readFile(flatPath, 'utf-8')
            resolvedPath = flatPath
          } catch {
            // Skill not found - not an error, just skip
            console.warn(`Skill not found: ${skillName}`)
          }
        }

        if (content) {
          skills.push({
            name: skillName,
            content,
            filePath: resolvedPath,
          })
          loadedSkillNames.add(skillName)
        }
      }
    }

    return skills
  }

  /**
   * Determine if task should be fragmented into subtasks
   *
   * Fragmentation is needed when:
   * - 3+ domains are involved
   * - Task explicitly mentions multiple areas
   * - Task is complex (many keywords)
   */
  shouldFragment(domains: string[], taskDescription: string): boolean {
    // Always fragment if 3+ domains
    if (domains.length >= 3) return true

    // Check for explicit multi-area keywords
    const multiAreaIndicators = [
      'full stack',
      'fullstack',
      'end to end',
      'e2e',
      'complete feature',
      'from database to ui',
      'across layers',
    ]

    const taskLower = taskDescription.toLowerCase()
    for (const indicator of multiAreaIndicators) {
      if (taskLower.includes(indicator)) return true
    }

    // Check word count - very long tasks often need fragmentation
    const wordCount = taskDescription.split(/\s+/).length
    if (wordCount > 30 && domains.length >= 2) return true

    return false
  }

  /**
   * Create subtasks for a fragmented task
   *
   * Orders subtasks by domain dependency (database -> backend -> frontend)
   * and stores them in state.json
   */
  async createSubtasks(
    taskDescription: string,
    domains: string[],
    agents: LoadedAgent[],
    projectId: string
  ): Promise<OrchestratorSubtask[]> {
    // Sort domains by dependency order
    const sortedDomains = [...domains].sort((a, b) => {
      const orderA = DOMAIN_DEPENDENCY_ORDER.indexOf(a)
      const orderB = DOMAIN_DEPENDENCY_ORDER.indexOf(b)
      // Unknown domains go last
      return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB)
    })

    // Create subtask for each domain
    const subtasks: OrchestratorSubtask[] = sortedDomains.map((domain, index) => {
      // Find the agent for this domain
      const agent = agents.find(a => a.domain === domain)
      const agentFile = agent ? `${agent.name}.md` : `${domain}.md`

      // Determine dependencies - each subtask depends on previous ones
      const dependsOn = sortedDomains.slice(0, index).map((d, i) => `subtask-${i + 1}`)

      return {
        id: `subtask-${index + 1}`,
        description: this.generateSubtaskDescription(taskDescription, domain),
        domain,
        agent: agentFile,
        status: index === 0 ? 'in_progress' : 'pending',
        dependsOn,
        order: index + 1,
      }
    })

    // Store subtasks in state.json via state storage
    await stateStorage.createSubtasks(
      projectId,
      subtasks.map(st => ({
        id: st.id,
        description: st.description,
        domain: st.domain,
        agent: st.agent,
        dependsOn: st.dependsOn,
      }))
    )

    return subtasks
  }

  /**
   * Generate a domain-specific subtask description
   */
  private generateSubtaskDescription(
    fullTask: string,
    domain: string
  ): string {
    const domainDescriptions: Record<string, string> = {
      database: 'Set up data layer: schema, models, migrations',
      backend: 'Implement API: routes, controllers, services, validation',
      frontend: 'Build UI: components, forms, state management',
      testing: 'Write tests: unit, integration, e2e',
      devops: 'Configure deployment: CI/CD, environment, containers',
      uxui: 'Design user experience: flows, accessibility, styling',
    }

    const prefix = domainDescriptions[domain] || `Handle ${domain} aspects`
    return `[${domain.toUpperCase()}] ${prefix} for: ${fullTask.substring(0, 80)}${fullTask.length > 80 ? '...' : ''}`
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const orchestratorExecutor = new OrchestratorExecutor()
export default orchestratorExecutor
