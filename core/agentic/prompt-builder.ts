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
import {
  DEFAULT_BUDGETS,
  filterSkillsByDomains,
  InjectionBudgetTracker,
  truncateToTokenBudget,
} from './injection-validator'

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
   * Returns array of module names that should be injected
   */
  getModulesForCommand(commandName: string): string[] {
    const smartCommands: Record<string, string[]> = {
      task: ['CLAUDE-intelligence.md', 'CLAUDE-storage.md'],
      ship: ['CLAUDE-intelligence.md', 'CLAUDE-storage.md'],
      bug: ['CLAUDE-intelligence.md'],
      done: ['CLAUDE-storage.md'],
      work: ['CLAUDE-intelligence.md', 'CLAUDE-storage.md'],
      spec: ['CLAUDE-intelligence.md'],
    }
    return smartCommands[commandName] || []
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
    return truncateToTokenBudget(result, DEFAULT_BUDGETS.autoContext)
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
   * Build a complete prompt for Claude from template, context, and enhancements
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

    // Agent assignment (CONDITIONAL - only for code-modifying commands)
    const commandName = template.frontmatter?.name?.replace('p:', '') || ''
    const agentCommands = [
      'now',
      'build',
      'feature',
      'design',
      'fix',
      'bug',
      'test',
      'work',
      'cleanup',
      'spec',
    ]
    const needsAgent = agentCommands.includes(commandName)

    if (agent && needsAgent) {
      parts.push(`# AGENT: ${agent.name}\n`)
      if (agent.role) parts.push(`Role: ${agent.role}\n`)
      if (agent.skills?.length) parts.push(`Skills: ${agent.skills.join(', ')}\n`)
      parts.push(`\nApply specialized expertise. Read agent file for details if needed.\n\n`)
    }

    // Core instruction (concise)
    parts.push(`TASK: ${template.frontmatter.description}\n`)

    // Tools (inline)
    if (template.frontmatter['allowed-tools']) {
      parts.push(`TOOLS: ${template.frontmatter['allowed-tools'].join(', ')}\n`)
    }

    // Critical parameters only
    const params = context as { params?: { task?: string; description?: string } }
    if (params.params?.task || params.params?.description) {
      parts.push(`INPUT: ${params.params.task || params.params.description}\n`)
    }

    parts.push('\n---\n')

    // Template content (include full template, frontmatter already stripped by loader)
    // This ensures Claude sees ALL instructions including critical rules at the top
    parts.push(template.content)

    // ORCHESTRATOR CONTEXT: Inject loaded agents, skills, and subtasks
    if (orchestratorContext) {
      parts.push('\n## ORCHESTRATOR CONTEXT\n')
      parts.push(`**Primary Domain**: ${orchestratorContext.primaryDomain}\n`)
      parts.push(`**Domains**: ${orchestratorContext.detectedDomains.join(', ')}\n`)
      parts.push(`**Ecosystem**: ${orchestratorContext.project.ecosystem}\n\n`)

      // Inject loaded agent content (truncated for context efficiency)
      if (orchestratorContext.agents.length > 0) {
        parts.push('### LOADED AGENTS (Project-Specific Specialists)\n\n')
        for (const agent of orchestratorContext.agents) {
          parts.push(`#### Agent: ${agent.name} (${agent.domain})\n`)
          if (agent.effort) parts.push(`Effort: ${agent.effort}\n`)
          if (agent.model) parts.push(`Model: ${agent.model}\n`)
          if (agent.skills.length > 0) {
            parts.push(`Skills: ${agent.skills.join(', ')}\n`)
          }
          // Truncate agent content to token budget
          const truncatedContent = truncateToTokenBudget(
            agent.content,
            DEFAULT_BUDGETS.agentContent
          )
          parts.push(`\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`)
        }
      }

      // Filter skills by detected domains, then inject (truncated)
      const relevantSkills = filterSkillsByDomains(
        orchestratorContext.skills,
        orchestratorContext.detectedDomains
      )
      if (relevantSkills.length > 0) {
        parts.push('### LOADED SKILLS (From Agent Frontmatter)\n\n')
        for (const skill of relevantSkills) {
          parts.push(`#### Skill: ${skill.name}\n`)
          // Truncate skill content to token budget
          const truncatedContent = truncateToTokenBudget(
            skill.content,
            DEFAULT_BUDGETS.skillContent
          )
          parts.push(`\`\`\`markdown\n${truncatedContent}\n\`\`\`\n\n`)
        }
      }

      // Inject real codebase context (proactively gathered)
      if (orchestratorContext.realContext) {
        const rc = orchestratorContext.realContext
        parts.push('### CODEBASE CONTEXT (Real — gathered proactively)\n\n')

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

      // Inject subtasks if fragmented
      if (orchestratorContext.requiresFragmentation && orchestratorContext.subtasks) {
        parts.push('### SUBTASKS (Execute in Order)\n\n')
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

        // Find and highlight current subtask
        const currentSubtask = orchestratorContext.subtasks.find((s) => s.status === 'in_progress')
        if (currentSubtask) {
          parts.push(
            `\n**FOCUS ON SUBTASK #${currentSubtask.order}**: ${currentSubtask.description}\n`
          )
          parts.push(`Agent: ${currentSubtask.agent} | Domain: ${currentSubtask.domain}\n`)
          if (currentSubtask.dependsOn.length > 0) {
            parts.push(`Dependencies: ${currentSubtask.dependsOn.join(', ')}\n`)
          }
        }
        parts.push('\n')
      }
    }

    // Current state (only if exists and relevant)
    const relevantState = this.filterRelevantState(state)
    if (relevantState) {
      parts.push('\n## PRJCT STATE (Project Management Data)\n')
      parts.push(relevantState)
      parts.push('\n')
    }

    // COMPRESSED: File list
    const files = context.files || []
    if (files.length > 0) {
      const top5 = files.slice(0, 5).join(', ')
      parts.push(`\n## FILES: ${files.length} available. Top: ${top5}\n`)
      parts.push('Read BEFORE modifying. Use Glob/Grep to find more.\n\n')
    } else if ((context as { projectPath?: string }).projectPath) {
      parts.push(
        `\n## PROJECT: ${(context as { projectPath: string }).projectPath}\nRead files before modifying.\n\n`
      )
    }

    // OPTIMIZED: Only include patterns for code-modifying commands
    const codeCommands = [
      'now',
      'build',
      'feature',
      'design',
      'cleanup',
      'fix',
      'bug',
      'test',
      'init',
      'spec',
      'work',
    ]
    const needsPatterns = codeCommands.includes(commandName)

    // Include code patterns analysis for code-modifying commands
    const codePatternsContent = state?.codePatterns || ''
    if (needsPatterns && codePatternsContent && codePatternsContent.trim()) {
      const patternSummary = this.extractPatternSummary(codePatternsContent)
      if (patternSummary) {
        parts.push('\n## CODE PATTERNS\n')
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

    // CRITICAL: Compressed rules
    parts.push(this.buildCriticalRules())

    // PRJ-94: Inject additional modules for SMART commands
    const additionalModules = this.getModulesForCommand(commandName)
    if (additionalModules.length > 0) {
      for (const moduleName of additionalModules) {
        const moduleContent = await this.loadModule(moduleName)
        if (moduleContent) {
          parts.push('\n')
          parts.push(moduleContent)
        }
      }
    }

    // P1.1: Learned Patterns
    if (learnedPatterns && Object.keys(learnedPatterns).some((k) => learnedPatterns[k])) {
      parts.push('\n## PROJECT DEFAULTS (apply automatically)\n')
      for (const [key, value] of Object.entries(learnedPatterns)) {
        if (value) {
          parts.push(`- ${key}: ${value}\n`)
        }
      }
    }

    // P3.1: Think Block
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

    // P3.3: Relevant Memories
    if (relevantMemories && relevantMemories.length > 0) {
      parts.push('\n## CONTEXT (apply these)\n')
      for (const memory of relevantMemories) {
        parts.push(`- **${memory.title}**: ${memory.content}\n`)
        if (memory.tags && memory.tags.length > 0) {
          parts.push(`  Tags: ${memory.tags.join(', ')}\n`)
        }
      }
    }

    // P3.4: Plan Mode
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

    // P4.1: Quality Checklists
    const checklistCommands = [
      'now',
      'build',
      'feature',
      'design',
      'fix',
      'bug',
      'cleanup',
      'spec',
      'work',
    ]
    if (checklistCommands.includes(commandName)) {
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

    // Simple execution directive
    parts.push('\nEXECUTE: Follow flow. Use tools. Decide.\n')

    return parts.join('')
  }

  /**
   * Filter state data to include only relevant portions for the prompt.
   * Uses InjectionBudgetTracker to enforce cumulative token limits.
   */
  filterRelevantState(state: State): string | null {
    if (!state || Object.keys(state).length === 0) return null

    const tracker = new InjectionBudgetTracker({ totalPrompt: DEFAULT_BUDGETS.stateData })
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
   * Build critical anti-hallucination rules section
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
}

const promptBuilder = new PromptBuilder()
export default promptBuilder
export { PromptBuilder }
