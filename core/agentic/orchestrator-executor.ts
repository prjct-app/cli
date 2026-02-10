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

import { exec as execCallback } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { calculateVelocity, formatVelocityContext } from '../domain/velocity'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { DEFAULT_VELOCITY_CONFIG } from '../schemas/velocity'
import { analysisStorage, stateStorage } from '../storage'
import { findRelevantFiles } from '../tools/context/files-tool'
import { getRecentFiles } from '../tools/context/recent-tool'
import { extractSignatures } from '../tools/context/signatures-tool'
import type {
  LoadedAgent,
  LoadedSkill,
  OrchestratorContext,
  OrchestratorSubtask,
  RealCodebaseContext,
  SealedAnalysisContext,
} from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import outcomeRecorder from '../workflows/outcome-recorder'
import domainClassifier, { type ProjectContext } from './domain-classifier'
import { parseFrontmatter } from './template-loader'

const execAsync = promisify(execCallback)

/**
 * Domain dependency order - earlier domains should complete first
 */
const DOMAIN_DEPENDENCY_ORDER = ['database', 'backend', 'frontend', 'testing', 'devops']

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
    const { domains, primary } = await this.detectDomains(taskDescription, projectId, repoAnalysis)

    // Step 4: Load agents for detected domains
    const agents = await this.loadAgents(domains, projectId)

    // Step 5: Load skills from agent frontmatter
    const skills = await this.loadSkills(agents)

    // Step 6: Gather real codebase context, sealed analysis, and velocity in parallel
    const [realContext, sealedAnalysis, velocityContext] = await Promise.all([
      this.gatherRealContext(taskDescription, projectPath),
      this.loadSealedAnalysis(projectId),
      this.loadVelocityContext(projectId),
    ])

    // Step 7: Determine if fragmentation is needed
    const requiresFragmentation = this.shouldFragment(domains, taskDescription)

    // Step 8: Create subtasks if fragmentation is required
    let subtasks: OrchestratorSubtask[] | null = null
    if (requiresFragmentation && command === 'task') {
      subtasks = await this.createSubtasks(taskDescription, domains, agents, projectId)
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
      realContext,
      sealedAnalysis,
      velocityContext,
    }
  }

  /**
   * Gather real codebase context proactively.
   *
   * Calls existing context tools (files-tool, recent-tool, signatures-tool)
   * to build a briefing so the agent doesn't need to explore first.
   */
  private async gatherRealContext(
    taskDescription: string,
    projectPath: string
  ): Promise<RealCodebaseContext | undefined> {
    try {
      // Run git state + relevant files + recent files in parallel
      const [gitResult, filesResult, recentResult] = await Promise.all([
        this.getGitState(projectPath),
        findRelevantFiles(taskDescription, projectPath, { maxFiles: 10, minScore: 0.15 }),
        getRecentFiles(projectPath, { commits: 10, maxFiles: 10 }),
      ])

      // Extract signatures from top 3 relevant files
      const topFiles = filesResult.files.slice(0, 3)
      const signatureResults = await Promise.all(
        topFiles.map(async (f) => {
          try {
            const result = await extractSignatures(f.path, projectPath)
            if (result.signatures.length === 0) return null
            const sigContent = result.signatures
              .map((s) => `${s.exported ? 'export ' : ''}${s.type} ${s.name}: ${s.signature}`)
              .join('\n')
            return { path: f.path, content: sigContent }
          } catch {
            return null
          }
        })
      )

      return {
        gitBranch: gitResult.branch,
        gitStatus: gitResult.status,
        relevantFiles: filesResult.files.map((f) => ({
          path: f.path,
          score: Math.round(f.score * 100),
          reason: f.reasons.join(', '),
        })),
        recentFiles: recentResult.hotFiles.slice(0, 5).map((f) => ({
          path: f.path,
          lastChanged: f.lastChanged,
          changes: f.changes,
        })),
        signatures: signatureResults.filter(
          (s): s is { path: string; content: string } => s !== null
        ),
      }
    } catch {
      // Non-critical — return undefined if context gathering fails
      return undefined
    }
  }

  /**
   * Get current git state (branch + short status)
   */
  private async getGitState(projectPath: string): Promise<{ branch: string; status: string }> {
    try {
      const [branchResult, statusResult] = await Promise.all([
        execAsync('git branch --show-current', { cwd: projectPath }),
        execAsync('git status --porcelain', { cwd: projectPath }),
      ])

      const branch = branchResult.stdout.trim() || 'main'
      const lines = statusResult.stdout.trim().split('\n').filter(Boolean)

      let modified = 0
      let untracked = 0
      let staged = 0
      for (const line of lines) {
        const code = line.substring(0, 2)
        if (code.startsWith('??')) untracked++
        else if (code[0] !== ' ' && code[0] !== '?') staged++
        else modified++
      }

      const parts: string[] = []
      if (staged > 0) parts.push(`${staged} staged`)
      if (modified > 0) parts.push(`${modified} modified`)
      if (untracked > 0) parts.push(`${untracked} untracked`)
      const status = parts.length > 0 ? parts.join(', ') : 'clean'

      return { branch, status }
    } catch {
      return { branch: 'unknown', status: 'git unavailable' }
    }
  }

  /**
   * Load sealed/active analysis from analysis storage (PRJ-260).
   * Returns sealed if available, otherwise draft as fallback.
   * Returns null if no analysis exists (graceful degradation).
   */
  private async loadSealedAnalysis(projectId: string): Promise<SealedAnalysisContext | null> {
    try {
      const analysis = await analysisStorage.getActive(projectId)
      if (!analysis) return null

      return {
        languages: analysis.languages,
        frameworks: analysis.frameworks,
        packageManager: analysis.packageManager,
        sourceDir: analysis.sourceDir,
        testDir: analysis.testDir,
        fileCount: analysis.fileCount,
        patterns: analysis.patterns,
        antiPatterns: analysis.antiPatterns,
        status: analysis.status ?? 'draft',
        commitHash: analysis.commitHash,
      }
    } catch {
      // Graceful degradation — analysis is optional enhancement
      return null
    }
  }

  /**
   * Load velocity context for estimation guidance (PRJ-296).
   * Returns formatted string for prompt injection, or null if no data.
   */
  private async loadVelocityContext(projectId: string): Promise<string | null> {
    try {
      const outcomes = await outcomeRecorder.getAll(projectId)
      if (outcomes.length === 0) return null

      const metrics = calculateVelocity(outcomes, DEFAULT_VELOCITY_CONFIG)
      if (metrics.sprints.length === 0) return null

      return formatVelocityContext(metrics)
    } catch {
      return null
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
      console.warn('Failed to load repo-analysis.json:', getErrorMessage(error))
      return null
    }
  }

  /**
   * Detect which domains are relevant for this task.
   *
   * Uses LLM-based classification with fallback chain (PRJ-299):
   * cache → confirmed patterns → LLM → heuristic
   */
  async detectDomains(
    taskDescription: string,
    projectId: string,
    repoAnalysis: { ecosystem: string; technologies?: string[] } | null
  ): Promise<{ domains: string[]; primary: string }> {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const availableAgents = await this.getAvailableAgentNames(globalPath)

    // Load state.json for project domain info
    let projectDomains = {
      hasFrontend: false,
      hasBackend: true,
      hasDatabase: false,
      hasTesting: false,
      hasDocker: false,
    }
    try {
      const statePath = path.join(globalPath, 'storage', 'state.json')
      const stateContent = await fs.readFile(statePath, 'utf-8')
      const state = JSON.parse(stateContent)
      if (state.domains) {
        projectDomains = state.domains
      }
    } catch {
      // Use defaults
    }

    const context: ProjectContext = {
      domains: projectDomains,
      agents: availableAgents,
      stack: repoAnalysis ? { language: repoAnalysis.ecosystem } : undefined,
    }

    const { classification } = await domainClassifier.classify(
      taskDescription,
      projectId,
      globalPath,
      context
    )

    const domains = [classification.primaryDomain, ...classification.secondaryDomains]

    // Filter to domains that have corresponding agents
    const validDomains = domains.filter((domain) =>
      availableAgents.some(
        (agent) =>
          agent === domain || agent.includes(domain) || domain.includes(agent.replace('.md', ''))
      )
    )

    if (validDomains.length === 0) {
      return { domains: ['general'], primary: 'general' }
    }

    return { domains: validDomains, primary: validDomains[0] }
  }

  /**
   * Get list of available agent file names
   */
  private async getAvailableAgentNames(globalPath: string): Promise<string[]> {
    try {
      const agentsDir = path.join(globalPath, 'agents')
      const files = await fs.readdir(agentsDir)
      return files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''))
    } catch {
      return []
    }
  }

  /**
   * Load agents for the detected domains
   *
   * Reads agent markdown files from {globalPath}/agents/
   * and extracts their content and skills from frontmatter.
   *
   * Uses parallel file reads for performance (PRJ-110).
   */
  async loadAgents(domains: string[], projectId: string): Promise<LoadedAgent[]> {
    const globalPath = pathManager.getGlobalProjectPath(projectId)
    const agentsDir = path.join(globalPath, 'agents')

    // Load all domain agents in parallel
    const agentPromises = domains.map(async (domain): Promise<LoadedAgent | null> => {
      // Try exact match first, then variations
      const possibleNames = [`${domain}.md`, `${domain}-agent.md`, `prjct-${domain}.md`]

      for (const fileName of possibleNames) {
        const filePath = path.join(agentsDir, fileName)
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          const { frontmatter, body } = this.parseAgentFile(content)

          return {
            name: fileName.replace('.md', ''),
            domain,
            content: body,
            skills: frontmatter.skills || [],
            filePath,
            effort: frontmatter.effort as LoadedAgent['effort'],
            model: frontmatter.model as string | undefined,
          }
        } catch {
          // Try next variation
        }
      }
      return null
    })

    const results = await Promise.all(agentPromises)
    return results.filter((agent): agent is LoadedAgent => agent !== null)
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
      frontmatter.skills = (frontmatter.skills as string).split(',').map((s) => s.trim())
    }

    return {
      frontmatter: frontmatter as { skills?: string[]; [key: string]: unknown },
      body: parsed.content,
    }
  }

  /**
   * Load skills from agent frontmatter
   *
   * Skills are stored in ~/.claude/skills/{name}.md
   *
   * Uses parallel file reads for performance (PRJ-110).
   */
  async loadSkills(agents: LoadedAgent[]): Promise<LoadedSkill[]> {
    const skillsDir = path.join(os.homedir(), '.claude', 'skills')

    // Collect unique skill names from all agents, tracking which agents need them
    const skillToAgents = new Map<string, string[]>()
    for (const agent of agents) {
      for (const skillName of agent.skills) {
        const existing = skillToAgents.get(skillName) || []
        existing.push(agent.name)
        skillToAgents.set(skillName, existing)
      }
    }

    // Load all skills in parallel
    const skillPromises = Array.from(skillToAgents.keys()).map(
      async (skillName): Promise<LoadedSkill | null> => {
        // Check both patterns: flat file and subdirectory (ecosystem standard)
        const flatPath = path.join(skillsDir, `${skillName}.md`)
        const subdirPath = path.join(skillsDir, skillName, 'SKILL.md')

        // Prefer subdirectory format (ecosystem standard)
        try {
          const content = await fs.readFile(subdirPath, 'utf-8')
          return { name: skillName, content, filePath: subdirPath }
        } catch {
          // Fall back to flat file
          try {
            const content = await fs.readFile(flatPath, 'utf-8')
            return { name: skillName, content, filePath: flatPath }
          } catch {
            // Skill not found — log warning with agent context
            const agentNames = skillToAgents.get(skillName) || []
            console.warn(
              `⚠ Skill "${skillName}" not installed (needed by: ${agentNames.join(', ')}). Run \`prjct sync\` to auto-install.`
            )
            return null
          }
        }
      }
    )

    const results = await Promise.all(skillPromises)
    return results.filter((skill): skill is LoadedSkill => skill !== null)
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
      const agent = agents.find((a) => a.domain === domain)
      const agentFile = agent ? `${agent.name}.md` : `${domain}.md`

      // Determine dependencies - each subtask depends on previous ones
      const dependsOn = sortedDomains.slice(0, index).map((_d, i) => `subtask-${i + 1}`)

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
      subtasks.map((st) => ({
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
  private generateSubtaskDescription(fullTask: string, domain: string): string {
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
