/**
 * Orchestrator Executor
 *
 * EXECUTES orchestration in TypeScript - not just paths.
 * This module:
 * 1. Detects domains from task description
 * 2. Gathers real codebase context, sealed analysis, and velocity
 * 3. Determines if task should be fragmented
 * 4. Creates subtasks in state.json if fragmented
 *
 * @module agentic/orchestrator-executor
 * @version 1.0.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { calculateVelocity, formatVelocityContext } from '../domain/velocity'
import configManager from '../infrastructure/config-manager'
import pathManager from '../infrastructure/path-manager'
import { DEFAULT_VELOCITY_CONFIG } from '../schemas/velocity'
import { analysisStorage } from '../storage/analysis-storage'
import llmAnalysisStorage from '../storage/llm-analysis-storage'
import { stateStorage } from '../storage/state-storage'
import { findRelevantFiles } from '../tools/context/files-tool'
import { getRecentFiles } from '../tools/context/recent-tool'
import { extractSignatures } from '../tools/context/signatures-tool'
import type {
  ContextDegradation,
  OrchestratorContext,
  OrchestratorSubtask,
  DomainClassifierProjectContext as ProjectContext,
  RealCodebaseContext,
  SealedAnalysisContext,
} from '../types/agentic'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { execAsync } from '../utils/exec'
import outcomeRecorder from '../workflows/outcome-recorder'
import domainClassifier from './domain-classifier'

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

    // Step 4: Gather real codebase context, sealed analysis, and velocity in parallel
    // PRJ-277: Use Promise.allSettled so individual failures don't crash the orchestrator
    const settled = await Promise.allSettled([
      this.gatherRealContext(taskDescription, projectPath),
      this.loadSealedAnalysis(projectId),
      this.loadVelocityContext(projectId),
    ])

    const toolNames = ['realContext', 'sealedAnalysis', 'velocity'] as const
    const failedTools: string[] = []
    const results = settled.map((result, i) => {
      if (result.status === 'fulfilled') return result.value
      failedTools.push(toolNames[i])
      console.warn(`Context tool "${toolNames[i]}" failed: ${getErrorMessage(result.reason)}`)
      return undefined
    })

    const [realContext, sealedAnalysis, velocityContext] = results as [
      RealCodebaseContext | undefined,
      SealedAnalysisContext | null | undefined,
      string | null | undefined,
    ]

    const contextDegradation: ContextDegradation = {
      level: failedTools.length === 0 ? 'full' : failedTools.length >= 2 ? 'minimal' : 'partial',
      failedTools,
    }

    // Step 5: Determine if fragmentation is needed
    const requiresFragmentation = this.shouldFragment(domains, taskDescription)

    // Step 6: Create subtasks if fragmentation is required
    let subtasks: OrchestratorSubtask[] | null = null
    if (requiresFragmentation && command === 'task') {
      subtasks = await this.createSubtasks(taskDescription, domains, [], projectId)
    }

    return {
      detectedDomains: domains,
      primaryDomain: primary,
      requiresFragmentation,
      subtasks,
      project: {
        id: projectId,
        ecosystem: repoAnalysis?.ecosystem || 'unknown',
        conventions: repoAnalysis?.conventions || [],
      },
      realContext,
      sealedAnalysis: sealedAnalysis ?? null,
      velocityContext: velocityContext ?? null,
      contextDegradation,
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
      // Prefer LLM analysis (agentic, real data) over heuristic analysis
      const llmAnalysis = llmAnalysisStorage.getActive(projectId)
      if (llmAnalysis) {
        // Derive sourceDir/testDir from conventions if available
        const sourceConvention = llmAnalysis.conventions.find(
          (c) => c.category === 'file-structure' && /source|src/i.test(c.rule)
        )
        const testConvention = llmAnalysis.conventions.find(
          (c) => c.category === 'file-structure' && /test/i.test(c.rule)
        )

        return {
          languages: llmAnalysis.stack?.languages ?? [],
          frameworks: llmAnalysis.stack?.frameworks ?? [],
          packageManager: llmAnalysis.stack?.packageManager,
          sourceDir: sourceConvention?.example,
          testDir: testConvention?.example,
          fileCount: 0, // Not tracked in LLM analysis
          patterns: llmAnalysis.patterns.map((p) => ({
            name: p.name,
            description: p.description,
            location: p.locations?.[0],
          })),
          antiPatterns: llmAnalysis.antiPatterns.map((a) => ({
            issue: a.issue,
            file: a.files?.[0] ?? 'multiple',
            suggestion: a.suggestion,
          })),
          status: 'sealed',
          commitHash: llmAnalysis.commitHash ?? undefined,
        }
      }

      // Fallback to heuristic analysis
      return this.loadHeuristicAnalysis(projectId)
    } catch {
      // Graceful degradation — analysis is optional enhancement
      return null
    }
  }

  /**
   * Fallback: load analysis from heuristic analysis storage.
   */
  private async loadHeuristicAnalysis(projectId: string): Promise<SealedAnalysisContext | null> {
    try {
      const analysis = await analysisStorage.getActive(projectId)
      if (!analysis) return null

      return {
        languages: analysis.languages ?? [],
        frameworks: analysis.frameworks ?? [],
        packageManager: analysis.packageManager,
        sourceDir: analysis.sourceDir,
        testDir: analysis.testDir,
        fileCount: analysis.fileCount ?? 0,
        patterns: analysis.patterns ?? [],
        antiPatterns: analysis.antiPatterns ?? [],
        status: analysis.status ?? 'draft',
        commitHash: analysis.commitHash,
      }
    } catch {
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

    // Load state from SQLite for project domain info
    let projectDomains = {
      hasFrontend: false,
      hasBackend: true,
      hasDatabase: false,
      hasTesting: false,
      hasDocker: false,
    }
    try {
      const state = (await stateStorage.read(projectId)) as Record<string, unknown>
      if (state.domains) {
        projectDomains = state.domains as typeof projectDomains
      }
    } catch {
      // Use defaults
    }

    const context: ProjectContext = {
      domains: projectDomains,
      stack: repoAnalysis ? { language: repoAnalysis.ecosystem } : undefined,
    }

    const { classification } = await domainClassifier.classify(
      taskDescription,
      projectId,
      globalPath,
      context
    )

    const domains = [classification.primaryDomain, ...(classification.secondaryDomains || [])]

    if (domains.length === 0) {
      return { domains: ['general'], primary: 'general' }
    }

    return { domains, primary: domains[0] }
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
    _agents: unknown[],
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
      const agentFile = `${domain}.md`

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
