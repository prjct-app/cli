/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context.
 * Claude decides what to do - NO if/else logic here.
 *
 * Auto-injects unified state, learned patterns, and performance stats.
 *
 * @module agentic/prompt-builder
 * @version 5.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { outcomeAnalyzer } from '../outcomes'
import type { CommandContextEntry } from '../schemas/command-context'
import { queueStorage, stateStorage } from '../storage'
import type {
  LearnedPatterns,
  Memory,
  OrchestratorContext,
  PlanInfo,
  PromptAgent,
  PromptContext,
  PromptProjectState,
  PromptState,
  Template,
  ThinkBlock,
} from '../types'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import { fileExists } from '../utils/fs-helpers'
import { PACKAGE_ROOT } from '../utils/version'
import { buildAntiHallucinationBlock, type ProjectGroundTruth } from './anti-hallucination'
import { loadCommandContextConfig, resolveCommandContextFull } from './command-context'
import { buildEnvironmentBlock } from './environment-block'
import {
  budgetsFromCoordinator,
  DEFAULT_BUDGETS,
  filterSkillsByDomains,
  InjectionBudgetTracker,
  truncateToTokenBudget,
} from './injection-validator'
import { deduplicateTechStack } from './tech-normalizer'
import type { TokenBudgetCoordinator } from './token-budget'

// =============================================================================
// Section Priority (PRJ-301)
// =============================================================================

/**
 * Prompt section priorities for budget trimming.
 * When token budget is tight, optional sections are dropped first.
 *
 * @see PRJ-301
 */
export type SectionPriority = 'critical' | 'important' | 'optional'

/**
 * Canonical section ordering for prompt assembly.
 * Based on research of 25+ system prompts from Claude Code, Gemini, ChatGPT.
 *
 * @see PRJ-301
 */
export const PROMPT_SECTION_ORDER = [
  'identity', // Who the model is (agent + role)
  'environment', // Where: project, git, platform, model
  'ground_truth', // Sealed analysis: ecosystem, stack, patterns
  'capabilities', // Tools, agents, skills, plan mode
  'constraints', // Anti-hallucination rules (BEFORE task context)
  'task_context', // Files, state, memories, learned patterns
  'task', // Template content + subtasks (the actual instructions)
  'output_schema', // Structured response format
  'efficiency', // Token efficiency directive
] as const

// Re-export types for convenience
export type {
  Frontmatter,
  LearnedPatterns,
  Memory,
  PlanInfo,
  Template,
  ThinkBlock,
} from '../types'

// Local type aliases for backward compatibility
type ProjectState = PromptProjectState
type Agent = PromptAgent
type Context = PromptContext
type State = PromptState

/**
 * Cached template entry with TTL support
 * @see PRJ-76
 */
interface CachedTemplate {
  content: string
  loadedAt: number
}

/**
 * Builds prompts for Claude using templates, context, and learned patterns.
 * Supports plan mode, think blocks, and quality checklists.
 * Auto-injects unified state and performance insights.
 *
 * Uses lazy loading for templates with 60s TTL cache.
 * @see PRJ-76
 */
class PromptBuilder {
  private _checklistsCache: Record<string, string> | null = null
  private _checklistsCacheTime: number = 0
  private _checklistRoutingCache: string | null = null
  private _checklistRoutingCacheTime: number = 0
  private _currentContext: Context | null = null
  private _stateCache: Map<string, { state: ProjectState; timestamp: number }> = new Map()
  private _stateCacheTTL = 5000 // 5 seconds
  private _templateCache: Map<string, CachedTemplate> = new Map()
  private readonly TEMPLATE_CACHE_TTL_MS = 60_000 // 60 seconds

  /** Active token budget coordinator (PRJ-266) */
  private _coordinator: TokenBudgetCoordinator | null = null

  /**
   * Get a template with TTL caching.
   * Returns cached content if within TTL, otherwise loads from disk.
   * @see PRJ-76
   */
  async getTemplate(templatePath: string): Promise<string | null> {
    const cached = this._templateCache.get(templatePath)
    const now = Date.now()

    if (cached && now - cached.loadedAt < this.TEMPLATE_CACHE_TTL_MS) {
      return cached.content
    }

    try {
      if (await fileExists(templatePath)) {
        const content = await fs.readFile(templatePath, 'utf-8')
        this._templateCache.set(templatePath, { content, loadedAt: now })
        return content
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error(`Template loading warning: ${getErrorMessage(error)}`)
      }
    }

    return null
  }

  /**
   * Clear the template cache (for testing or forced refresh)
   * @see PRJ-76
   */
  clearTemplateCache(): void {
    this._templateCache.clear()
    this._checklistsCache = null
    this._checklistsCacheTime = 0
    this._checklistRoutingCache = null
    this._checklistRoutingCacheTime = 0
  }

  /**
   * Set the token budget coordinator for model-aware budget management.
   * When set, budget allocations flow from the coordinator instead of defaults.
   *
   * @see PRJ-266
   */
  setCoordinator(coordinator: TokenBudgetCoordinator | null): void {
    this._coordinator = coordinator
  }

  /** Get the active coordinator (may be null) */
  getCoordinator(): TokenBudgetCoordinator | null {
    return this._coordinator
  }

  /**
   * Get effective injection budgets.
   * Uses coordinator allocation when available, falls back to DEFAULT_BUDGETS.
   *
   * @see PRJ-266
   */
  private getEffectiveBudgets() {
    if (this._coordinator) {
      return budgetsFromCoordinator(this._coordinator)
    }
    return DEFAULT_BUDGETS
  }

  /**
   * Reset context (for testing)
   */
  resetContext(): void {
    this._currentContext = null
  }

  /**
   * Set context for testing
   */
  setContext(context: Context | null): void {
    this._currentContext = context
  }

  /**
   * Load a specific CLAUDE module for SMART commands (PRJ-94)
   * These modules extend the base global CLAUDE.md for complex operations
   */
  async loadModule(moduleName: string): Promise<string | null> {
    const modulePath = path.join(PACKAGE_ROOT, 'templates/global/modules', moduleName)
    return this.getTemplate(modulePath)
  }

  /**
   * Get additional modules needed for SMART commands (PRJ-94)
   * Now config-driven via command-context.config.json (PRJ-298)
   */
  getModulesForCommand(_commandName: string, commandContext?: CommandContextEntry): string[] {
    if (commandContext) {
      return commandContext.modules
    }
    // Fallback if called without config (shouldn't happen after PRJ-298)
    return []
  }

  /**
   * Load quality checklists from templates/checklists/
   * Uses lazy loading with TTL cache.
   * @see PRJ-76
   */
  async loadChecklists(): Promise<Record<string, string>> {
    const now = Date.now()

    // Check if cache is still valid
    if (this._checklistsCache && now - this._checklistsCacheTime < this.TEMPLATE_CACHE_TTL_MS) {
      return this._checklistsCache
    }

    const checklistsDir = path.join(__dirname, '..', '..', 'templates', 'checklists')
    const checklists: Record<string, string> = {}

    try {
      if (await fileExists(checklistsDir)) {
        const files = (await fs.readdir(checklistsDir)).filter((f: string) => f.endsWith('.md'))
        for (const file of files) {
          const name = file.replace('.md', '')
          const templatePath = path.join(checklistsDir, file)
          // Use getTemplate for individual files to leverage per-file caching
          const content = await this.getTemplate(templatePath)
          if (content) {
            checklists[name] = content
          }
        }
      }
    } catch (error) {
      // Silent fail - checklists are optional enhancement
      if (!isNotFoundError(error)) {
        console.error(`Checklist loading warning: ${getErrorMessage(error)}`)
      }
    }

    this._checklistsCache = checklists
    this._checklistsCacheTime = now
    return checklists
  }

  /**
   * Get unified project state from MD managers.
   */
  async getProjectState(projectId: string): Promise<ProjectState | null> {
    if (!projectId) return null

    const cached = this._stateCache.get(projectId)
    if (cached && Date.now() - cached.timestamp < this._stateCacheTTL) {
      return cached.state
    }

    try {
      const [stateData, queueData] = await Promise.all([
        stateStorage.read(projectId),
        queueStorage.read(projectId),
      ])

      const state: ProjectState = {
        projectId,
        currentTask: stateData.currentTask,
        queue: queueData.tasks,
      }

      this._stateCache.set(projectId, { state, timestamp: Date.now() })
      return state
    } catch (error) {
      if (isNotFoundError(error) || error instanceof SyntaxError) {
        return null
      }
      throw error
    }
  }

  /**
   * Build auto-injected context from MD state.
   * This is automatically added to every prompt.
   */
  async buildInjectedContext(projectId: string): Promise<string | null> {
    if (!projectId) return null

    const state = await this.getProjectState(projectId)
    if (!state) return null

    const parts: string[] = []

    // Current state
    parts.push('## AUTO-INJECTED CONTEXT')
    parts.push('')

    // Current task
    if (state.currentTask) {
      const elapsed = this.calculateElapsed(state.currentTask.startedAt)
      parts.push(`**Current Task**: ${state.currentTask.description}`)
      parts.push(`- Started: ${elapsed} ago`)
    } else {
      parts.push('**Current Task**: None')
    }
    parts.push('')

    // Queue summary
    if (state.queue.length > 0) {
      parts.push(`**Queue**: ${state.queue.length} tasks pending`)
      const top3 = state.queue.slice(0, 3)
      for (const task of top3) {
        parts.push(`- [${task.priority}] ${task.description}`)
      }
      if (state.queue.length > 3) {
        parts.push(`- ... and ${state.queue.length - 3} more`)
      }
    }
    parts.push('')

    // Get detected patterns from outcomes
    try {
      const patterns = await outcomeAnalyzer.detectPatterns(projectId)
      if (patterns.length > 0) {
        parts.push('**Project Conventions**')
        for (const pattern of patterns.slice(0, 3)) {
          parts.push(`- ${pattern.description}`)
          if (pattern.suggestedAction) {
            parts.push(`  → ${pattern.suggestedAction}`)
          }
        }
        parts.push('')
      }
    } catch (error) {
      // Outcomes not available yet - expected for new projects
      if (!isNotFoundError(error) && !(error instanceof SyntaxError)) {
        console.error(`Outcome detection warning: ${getErrorMessage(error)}`)
      }
    }

    parts.push('---')
    parts.push('')

    const result = parts.join('\n')
    return truncateToTokenBudget(result, this.getEffectiveBudgets().autoContext)
  }

  /**
   * Calculate elapsed time from ISO timestamp.
   */
  private calculateElapsed(isoTimestamp: string): string {
    const start = new Date(isoTimestamp).getTime()
    const now = Date.now()
    const diffMs = now - start

    const minutes = Math.floor(diffMs / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    return `${minutes}m`
  }

  /**
   * Load checklist routing template for Claude to decide which checklists apply
   * Uses lazy loading with TTL cache.
   * @see PRJ-76
   */
  async loadChecklistRouting(): Promise<string | null> {
    const now = Date.now()

    // Check if cache is still valid
    if (
      this._checklistRoutingCache &&
      now - this._checklistRoutingCacheTime < this.TEMPLATE_CACHE_TTL_MS
    ) {
      return this._checklistRoutingCache
    }

    const routingPath = path.join(
      __dirname,
      '..',
      '..',
      'templates',
      'agentic',
      'checklist-routing.md'
    )

    // Use getTemplate for consistent caching behavior
    const content = await this.getTemplate(routingPath)
    if (content) {
      this._checklistRoutingCache = content
      this._checklistRoutingCacheTime = now
    }

    return this._checklistRoutingCache || null
  }

  /**
   * Build a complete prompt with auto-injected context.
   * This is the preferred method - automatically includes state and insights.
   */
  async buildWithInjection(
    template: Template,
    context: Context & { projectId?: string },
    state: State,
    agent: Agent | null = null,
    learnedPatterns: LearnedPatterns | null = null,
    thinkBlock: ThinkBlock | null = null,
    relevantMemories: Memory[] | null = null,
    planInfo: PlanInfo | null = null
  ): Promise<string> {
    const parts: string[] = []

    // Auto-inject unified context first
    if (context.projectId) {
      const injected = await this.buildInjectedContext(context.projectId)
      if (injected) {
        parts.push(injected)
      }
    }

    // Build the rest using existing method
    const basePrompt = await this.build(
      template,
      context,
      state,
      agent,
      learnedPatterns,
      thinkBlock,
      relevantMemories,
      planInfo
    )

    parts.push(basePrompt)

    return parts.join('')
  }

  /**
   * Build a complete prompt for Claude from template, context, and enhancements.
   *
   * Section ordering follows research-backed pattern (PRJ-301):
   * Identity → Environment → Ground Truth → Capabilities → Constraints →
   * Task Context → Task → Output Schema → Efficiency
   *
   * @deprecated Use buildWithInjection for auto-injected context
   */
  async build(
    template: Template,
    context: Context,
    state: State,
    agent: Agent | null = null,
    learnedPatterns: LearnedPatterns | null = null,
    thinkBlock: ThinkBlock | null = null,
    relevantMemories: Memory[] | null = null,
    planInfo: PlanInfo | null = null,
    orchestratorContext: OrchestratorContext | null = null
  ): Promise<string> {
    const parts: string[] = []

    // Store context for use in helper methods
    this._currentContext = context

    // PRJ-298: Config-driven command context (replaces 4 hardcoded lists)
    const commandName = template.frontmatter?.name?.replace('p:', '') || ''
    let commandContext: CommandContextEntry
    try {
      const config = await loadCommandContextConfig()
      const resolved = resolveCommandContextFull(config, commandName, template)
      commandContext = resolved.entry
    } catch {
      // Fallback: sensible defaults if config fails to load
      commandContext = { agents: true, patterns: true, checklist: false, modules: [] }
    }

    // =========================================================================
    // SECTION 1: IDENTITY (critical)
    // Tell the LLM what it is before anything else.
    // =========================================================================

    const needsAgent = commandContext.agents

    if (agent && needsAgent) {
      parts.push(`# AGENT: ${agent.name}\n`)
      if (agent.role) parts.push(`Role: ${agent.role}\n`)
      if (agent.skills?.length) parts.push(`Skills: ${agent.skills.join(', ')}\n`)
      parts.push(`\nApply specialized expertise. Read agent file for details if needed.\n\n`)
    }

    parts.push(`TASK: ${template.frontmatter.description}\n`)

    if (template.frontmatter['allowed-tools']) {
      parts.push(`TOOLS: ${template.frontmatter['allowed-tools'].join(', ')}\n`)
    }

    const params = context as { params?: { task?: string; description?: string } }
    if (params.params?.task || params.params?.description) {
      parts.push(`INPUT: ${params.params.task || params.params.description}\n`)
    }

    // =========================================================================
    // SECTION 2: ENVIRONMENT (important)
    // Structured env block: project, git, platform, model.
    // =========================================================================

    const projectPath = (context as { projectPath?: string }).projectPath
    if (projectPath) {
      const projectName = orchestratorContext?.project?.id
        ? path.basename(projectPath)
        : path.basename(projectPath)
      const envBlock = buildEnvironmentBlock({
        projectName,
        projectPath,
        isGitRepo: true,
        gitBranch: orchestratorContext?.realContext?.gitBranch,
      })
      parts.push(`\n${envBlock}\n`)
    }

    // =========================================================================
    // SECTION 3: GROUND TRUTH (important)
    // Sealed analysis: ecosystem, domains, stack, code patterns.
    // LLM knows the project reality before seeing task context.
    // =========================================================================

    if (orchestratorContext) {
      const sa = orchestratorContext.sealedAnalysis
      parts.push('\n## PROJECT ANALYSIS (Sealed)\n')
      parts.push(`**Ecosystem**: ${orchestratorContext.project.ecosystem}\n`)
      parts.push(`**Primary Domain**: ${orchestratorContext.primaryDomain}\n`)
      parts.push(`**Domains**: ${orchestratorContext.detectedDomains.join(', ')}\n`)

      // Inject sealed analysis data (PRJ-260)
      if (sa) {
        if (sa.languages.length > 0) {
          parts.push(`**Languages**: ${sa.languages.join(', ')}\n`)
        }
        if (sa.frameworks.length > 0) {
          parts.push(`**Frameworks**: ${sa.frameworks.join(', ')}\n`)
        }
        if (sa.packageManager) {
          parts.push(`**Package Manager**: ${sa.packageManager}\n`)
        }
        if (sa.sourceDir) {
          parts.push(`**Source Dir**: ${sa.sourceDir}\n`)
        }
        if (sa.testDir) {
          parts.push(`**Test Dir**: ${sa.testDir}\n`)
        }
        parts.push(`**Files Analyzed**: ${sa.fileCount}\n`)
        parts.push(
          `**Analysis Status**: ${sa.status}${sa.commitHash ? ` (commit: ${sa.commitHash.slice(0, 8)})` : ''}\n`
        )

        if (sa.patterns.length > 0) {
          parts.push('\n### Code Patterns (Follow These)\n')
          for (const p of sa.patterns) {
            parts.push(`- **${p.name}**: ${p.description}${p.location ? ` (${p.location})` : ''}\n`)
          }
        }

        if (sa.antiPatterns.length > 0) {
          parts.push('\n### Anti-Patterns (Avoid These)\n')
          for (const ap of sa.antiPatterns) {
            parts.push(`- **${ap.issue}** in \`${ap.file}\` — ${ap.suggestion}\n`)
          }
        }
      }

      parts.push('\n')
    }

    const needsPatterns = commandContext.patterns
    const codePatternsContent = state?.codePatterns || ''
    if (needsPatterns && codePatternsContent && codePatternsContent.trim()) {
      const patternSummary = this.extractPatternSummary(codePatternsContent)
      if (patternSummary) {
        parts.push('## CODE PATTERNS\n')
        parts.push(patternSummary)
        parts.push('\nFull patterns: Read analysis/patterns.md\n')
      }
    }

    const analysisContent = state?.analysis || ''
    if (needsPatterns && analysisContent && analysisContent.trim()) {
      const stackMatch =
        analysisContent.match(/Stack[:\s]+([^\n]+)/i) ||
        analysisContent.match(/Technology[:\s]+([^\n]+)/i)
      const stack = stackMatch ? stackMatch[1].trim() : 'detected'

      parts.push(`\n## STACK\nStack: ${stack}\n`)
      if (!codePatternsContent) {
        parts.push(
          'Read analysis/repo-summary.md + similar files before coding. Match patterns exactly.\n'
        )
      }
    }

    // =========================================================================
    // SECTION 4: CAPABILITIES (important)
    // Available agents, skills, modules, plan mode.
    // =========================================================================

    if (orchestratorContext) {
      // Loaded agents
      if (orchestratorContext.agents.length > 0) {
        parts.push('\n### LOADED AGENTS (Project-Specific Specialists)\n\n')
        for (const orcAgent of orchestratorContext.agents) {
          parts.push(`#### Agent: ${orcAgent.name} (${orcAgent.domain})\n`)
          if (orcAgent.effort) parts.push(`Effort: ${orcAgent.effort}\n`)
          if (orcAgent.model) parts.push(`Model: ${orcAgent.model}\n`)
          if (orcAgent.skills.length > 0) {
            parts.push(`Skills: ${orcAgent.skills.join(', ')}\n`)
          }
          const truncatedContent = truncateToTokenBudget(
            orcAgent.content,
            this.getEffectiveBudgets().agentContent
          )
          parts.push(`\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`)
        }
      }

      // Loaded skills (filtered by domain)
      const relevantSkills = filterSkillsByDomains(
        orchestratorContext.skills,
        orchestratorContext.detectedDomains
      )
      if (relevantSkills.length > 0) {
        parts.push('### LOADED SKILLS (From Agent Frontmatter)\n\n')
        for (const skill of relevantSkills) {
          parts.push(`#### Skill: ${skill.name}\n`)
          const truncatedContent = truncateToTokenBudget(
            skill.content,
            this.getEffectiveBudgets().skillContent
          )
          parts.push(`\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`)
        }
      }
    }

    // Additional modules for SMART commands (PRJ-94/PRJ-298)
    const additionalModules = this.getModulesForCommand(commandName, commandContext)
    if (additionalModules.length > 0) {
      for (const moduleName of additionalModules) {
        const moduleContent = await this.loadModule(moduleName)
        if (moduleContent) {
          parts.push('\n')
          parts.push(moduleContent)
        }
      }
    }

    // Plan mode / approval
    if (planInfo?.isPlanning) {
      parts.push(
        `\n## PLAN MODE\nRead-only. Gather info → Analyze → Propose plan → Wait for approval.\n`
      )
      if (planInfo.allowedTools) parts.push(`Tools: ${planInfo.allowedTools.join(', ')}\n`)
    }
    if (planInfo?.requiresApproval) {
      parts.push(
        `\n## APPROVAL REQUIRED\nShow changes, list affected files, ask for confirmation.\n`
      )
    }

    // =========================================================================
    // SECTION 5: CONSTRAINTS (critical)
    // Anti-hallucination rules BEFORE task context.
    // LLM has constraints loaded before processing code/files.
    // =========================================================================

    if (projectPath) {
      const sa = orchestratorContext?.sealedAnalysis
      // PRJ-300: prefer sealed analysis frameworks as primary tech stack,
      // falling back to repo conventions. Deduplicate with normalized matching.
      const rawStack = [
        ...(sa?.frameworks || []),
        ...(orchestratorContext?.project?.conventions || []),
      ]
      const groundTruth: ProjectGroundTruth = {
        projectPath,
        language: orchestratorContext?.project?.ecosystem,
        framework: sa?.frameworks?.[0],
        techStack: deduplicateTechStack(rawStack),
        domains: this.extractDomains(state),
        fileCount: context.files?.length || context.filteredSize || 0,
        availableAgents: orchestratorContext?.agents?.map((a) => a.name) || [],
        // Inject sealed analysis data for enriched grounding (PRJ-260)
        analysisLanguages: sa?.languages || [],
        analysisFrameworks: sa?.frameworks || [],
        analysisPackageManager: sa?.packageManager,
      }
      parts.push(`\n${buildAntiHallucinationBlock(groundTruth)}\n`)
    } else {
      // Fallback: compressed rules when no project context available
      parts.push(this.buildCriticalRules())
    }

    // =========================================================================
    // SECTION 6: TASK CONTEXT (important)
    // Files, codebase context, state, memories, patterns — all the data
    // the LLM needs to work with, presented after it knows the rules.
    // =========================================================================

    // Codebase context (proactively gathered)
    if (orchestratorContext?.realContext) {
      const rc = orchestratorContext.realContext
      parts.push('\n### CODEBASE CONTEXT\n\n')

      parts.push(`**Git State**: Branch \`${rc.gitBranch}\` | ${rc.gitStatus}\n\n`)

      if (rc.relevantFiles.length > 0) {
        parts.push('**Relevant Files** (scored by task relevance):\n')
        parts.push('| Score | File | Why |\n')
        parts.push('|-------|------|-----|\n')
        for (const f of rc.relevantFiles.slice(0, 8)) {
          parts.push(`| ${f.score} | ${f.path} | ${f.reason} |\n`)
        }
        parts.push('\n')
      }

      if (rc.signatures.length > 0) {
        parts.push('**Code Signatures** (top files):\n')
        for (const sig of rc.signatures) {
          parts.push(`\`\`\`typescript\n// ${sig.path}\n${sig.content}\n\`\`\`\n`)
        }
        parts.push('\n')
      }

      if (rc.recentFiles.length > 0) {
        parts.push('**Recently Changed**: ')
        const recentSummary = rc.recentFiles
          .slice(0, 5)
          .map((f) => `${f.path} (${f.lastChanged})`)
          .join(', ')
        parts.push(`${recentSummary}\n\n`)
      }
    }

    // File list
    const files = context.files || []
    if (files.length > 0) {
      const top5 = files.slice(0, 5).join(', ')
      parts.push(`\n## FILES: ${files.length} available. Top: ${top5}\n`)
      parts.push('Read BEFORE modifying. Use Glob/Grep to find more.\n\n')
    } else if (projectPath) {
      parts.push(`\n## PROJECT: ${projectPath}\nRead files before modifying.\n\n`)
    }

    // Project state
    const relevantState = this.filterRelevantState(state)
    if (relevantState) {
      parts.push('\n## PRJCT STATE (Project Management Data)\n')
      parts.push(relevantState)
      parts.push('\n')
    }

    // Velocity context (PRJ-296) — estimation guidance from historical data
    if (orchestratorContext?.velocityContext) {
      parts.push('\n### VELOCITY (Historical Estimation Data)\n\n')
      parts.push(orchestratorContext.velocityContext)
      parts.push('\n\n')
    }

    // Learned patterns
    if (learnedPatterns && Object.keys(learnedPatterns).some((k) => learnedPatterns[k])) {
      parts.push('\n## PROJECT DEFAULTS (apply automatically)\n')
      for (const [key, value] of Object.entries(learnedPatterns)) {
        if (value) {
          parts.push(`- ${key}: ${value}\n`)
        }
      }
    }

    // Think block
    if (thinkBlock?.plan && thinkBlock.plan.length > 0) {
      parts.push('\n## THINK FIRST (reasoning from analysis)\n')
      if (thinkBlock.conclusions && thinkBlock.conclusions.length > 0) {
        parts.push('Conclusions:\n')
        for (const c of thinkBlock.conclusions) {
          parts.push(`  → ${c}\n`)
        }
      }
      parts.push('Plan:\n')
      for (let i = 0; i < thinkBlock.plan.length; i++) {
        parts.push(`  ${i + 1}. ${thinkBlock.plan[i]}\n`)
      }
      parts.push(`Confidence: ${Math.round((thinkBlock.confidence || 0.5) * 100)}%\n`)
    }

    // Relevant memories
    if (relevantMemories && relevantMemories.length > 0) {
      parts.push('\n## CONTEXT (apply these)\n')
      for (const memory of relevantMemories) {
        parts.push(`- **${memory.title}**: ${memory.content}\n`)
        if (memory.tags && memory.tags.length > 0) {
          parts.push(`  Tags: ${memory.tags.join(', ')}\n`)
        }
      }
    }

    parts.push('\n---\n')

    // =========================================================================
    // SECTION 7: TASK (critical)
    // Template content (actual instructions) + subtasks.
    // LLM reads this AFTER knowing identity, env, rules, and context.
    // =========================================================================

    parts.push(template.content)

    // Subtasks (if fragmented)
    if (orchestratorContext?.requiresFragmentation && orchestratorContext.subtasks) {
      parts.push('\n### SUBTASKS (Execute in Order)\n\n')
      parts.push(
        '**IMPORTANT**: Focus on the CURRENT subtask. Use `p. done` when complete to advance.\n\n'
      )
      parts.push('| # | Domain | Description | Status |\n')
      parts.push('|---|--------|-------------|--------|\n')

      for (const subtask of orchestratorContext.subtasks) {
        const statusIcon =
          subtask.status === 'in_progress'
            ? '▶️ **CURRENT**'
            : subtask.status === 'completed'
              ? '✅ Done'
              : subtask.status === 'failed'
                ? '❌ Failed'
                : '⏳ Pending'
        parts.push(
          `| ${subtask.order} | ${subtask.domain} | ${subtask.description} | ${statusIcon} |\n`
        )
      }

      const currentSubtask = orchestratorContext.subtasks.find((s) => s.status === 'in_progress')
      if (currentSubtask) {
        parts.push(
          `\n**FOCUS ON SUBTASK #${currentSubtask.order}**: ${currentSubtask.description}\n`
        )
        parts.push(`Agent: ${currentSubtask.agent} | Domain: ${currentSubtask.domain}\n`)
        if (currentSubtask.dependsOn.length > 0) {
          parts.push(`Dependencies: ${currentSubtask.dependsOn.join(', ')}\n`)
        }

        // Inject previous subtask handoff for context continuity (PRJ-262)
        if (currentSubtask.handoff) {
          const h = currentSubtask.handoff
          parts.push('\n### Previous Subtask Handoff\n\n')
          parts.push(`**From:** ${h.fromSubtask}\n\n`)
          parts.push('**What was done:**\n')
          for (const item of h.whatWasDone) {
            parts.push(`- ${item}\n`)
          }
          if (h.filesChanged.length > 0) {
            parts.push('\n**Files changed:**\n')
            for (const f of h.filesChanged) {
              parts.push(`- \`${f.path}\` (${f.action})\n`)
            }
          }
          parts.push(`\n**Context for this subtask:**\n${h.outputForNextAgent}\n`)
        }
      }
      parts.push('\n')
    }

    // =========================================================================
    // SECTION 8: OUTPUT (important)
    // Output schema and quality checklists.
    // =========================================================================

    // Output schema (PRJ-264)
    const schemaType = this.getSchemaTypeForCommand(commandName)
    if (schemaType) {
      const { renderSchemaForPrompt } = await import('../schemas/llm-output')
      const schemaBlock = renderSchemaForPrompt(schemaType)
      if (schemaBlock) {
        parts.push(`\n${schemaBlock}\n`)
      }
    }

    // Quality checklists (PRJ-298)
    if (commandContext.checklist) {
      const routing = await this.loadChecklistRouting()
      const checklists = await this.loadChecklists()

      if (routing && Object.keys(checklists).length > 0) {
        parts.push('\n## QUALITY CHECKLISTS\n')
        parts.push(
          'Apply relevant checklists based on task. Read checklist-routing.md for guidance.\n'
        )
        parts.push(`Available: ${Object.keys(checklists).join(', ')}\n`)
        parts.push('Path: templates/checklists/{name}.md\n')
        parts.push('Use Read tool to load checklists you determine are relevant.\n')
      }
    }

    // =========================================================================
    // SECTION 9: EFFICIENCY (critical)
    // Token efficiency directive — be concise, no preamble.
    // =========================================================================

    parts.push(this.buildEfficiencyDirective())

    return parts.join('')
  }

  /**
   * Filter state data to include only relevant portions for the prompt.
   * Uses InjectionBudgetTracker to enforce cumulative token limits.
   */
  filterRelevantState(state: State): string | null {
    if (!state || Object.keys(state).length === 0) return null

    const budgets = this.getEffectiveBudgets()
    const tracker = new InjectionBudgetTracker({ totalPrompt: budgets.stateData })
    const criticalFiles = ['now', 'next', 'context', 'analysis', 'codePatterns']
    const relevant: string[] = []

    for (const [key, content] of Object.entries(state)) {
      if (content && (content as string).trim()) {
        const sectionBudget = criticalFiles.includes(key) ? 500 : 250
        const section = tracker.addSection(`### ${key}\n${content}`, sectionBudget)
        if (section) relevant.push(section)
      }
    }

    return relevant.length > 0 ? relevant.join('\n\n') : null
  }

  /**
   * Build an analysis prompt for pre-action investigation tasks
   */
  buildAnalysis(
    analysisType: string,
    context: { projectPath: string; projectId?: string }
  ): string {
    const parts: string[] = []

    parts.push(`# Analyze: ${analysisType}\n\n`)
    parts.push('Read the project context and provide your analysis.\n')
    parts.push('No predetermined patterns - decide based on what you find.\n\n')

    parts.push('## Project Context\n')
    parts.push(`- Path: ${context.projectPath}\n`)
    parts.push(`- ID: ${context.projectId}\n\n`)

    return parts.join('')
  }

  /**
   * Extract compressed pattern summary
   */
  extractPatternSummary(content: string): string | null {
    if (!content) return null

    const parts: string[] = []

    const conventionsMatch = content.match(/## Conventions[\s\S]*?(?=##|$)/i)
    if (conventionsMatch) {
      const conventions = conventionsMatch[0]
        .split('\n')
        .filter((line) => line.includes(':') || line.startsWith('-'))
        .slice(0, 6)
        .join('\n')
      if (conventions) parts.push(conventions)
    }

    const antiPatternsMatch = content.match(/### High Priority[\s\S]*?(?=###|##|$)/i)
    if (antiPatternsMatch) {
      const antiPatterns = antiPatternsMatch[0].substring(0, 300)
      parts.push(`\nAvoid:\n${antiPatterns}`)
    }

    const joined = parts.join('\n')
    const result = truncateToTokenBudget(joined, 200) // ~800 chars
    return result || null
  }

  /**
   * Map command names to their expected output schema type.
   * Returns null for commands that don't need structured output.
   */
  private getSchemaTypeForCommand(commandName: string): string | null {
    const schemaMap: Record<string, string> = {
      task: 'subtaskBreakdown',
      bug: 'classification',
    }
    return schemaMap[commandName] ?? null
  }

  /**
   * Build critical anti-hallucination rules section.
   * Used as fallback when full anti-hallucination block can't be built
   * (e.g., no project path available).
   */
  buildCriticalRules(): string {
    const fileCount = this._currentContext?.files?.length || this._currentContext?.filteredSize || 0
    return `
## RULES (CRITICAL)
1. **READ FIRST**: Use Read tool BEFORE modifying any file. Never assume code structure.
2. **MATCH PATTERNS**: Follow existing style, architecture, naming, imports exactly.
3. **NO HALLUCINATIONS**: Don't invent files, functions, or paths. If unsure, READ first.
4. **GIT SAFETY**: Never use checkout/reset --hard/clean. Always check status first.
5. **VERIFY**: After writing, confirm code matches project patterns.
Context: ${fileCount} files available. Read what you need.
`
  }

  /**
   * Build token efficiency directive (PRJ-301).
   * Instructs the LLM to be concise and avoid wasting tokens on preamble.
   */
  buildEfficiencyDirective(): string {
    return `
## OUTPUT RULES
- Be concise. Maximum 4 lines of explanation unless asked for detail.
- No preamble ("Here is...", "I'll help you...", "Based on...").
- No postamble (summaries, next steps suggestions unless asked).
- When executing code: show the code, not the explanation.
- Prefer structured output (JSON) over free text when applicable.

EXECUTE: Follow flow. Use tools. Decide.
`
  }

  /**
   * Extract domain flags from state data.
   * Returns the domains object if available in the raw state.
   */
  private extractDomains(state: State): ProjectGroundTruth['domains'] | undefined {
    if (!state) return undefined
    // State may contain raw domains from state.json (loaded by context-builder)
    const raw = state as Record<string, unknown>
    if (raw.domains && typeof raw.domains === 'object') {
      const d = raw.domains as Record<string, boolean>
      return {
        hasFrontend: d.hasFrontend ?? false,
        hasBackend: d.hasBackend ?? false,
        hasDatabase: d.hasDatabase ?? false,
        hasTesting: d.hasTesting ?? false,
        hasDocker: d.hasDocker ?? false,
      }
    }
    return undefined
  }
}

const promptBuilder = new PromptBuilder()
export default promptBuilder
export { PromptBuilder }
