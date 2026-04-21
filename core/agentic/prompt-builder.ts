/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context.
 * Claude decides what to do - NO if/else logic here.
 *
 * Auto-injects unified state, learned patterns, and performance stats.
 *
 * @module agentic/prompt-builder
 * @version 6.0
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { CHARS_PER_TOKEN } from '../constants/token'
import { queueStorage } from '../storage/queue-storage'
import { stateStorage } from '../storage/state-storage'
import type {
  InjectionBudgets,
  LearnedPatterns,
  OrchestratorContext,
  PlanInfo,
  PromptAgent,
  PromptContext,
  PromptProjectState,
  PromptState,
  Template,
  ThinkBlock,
} from '../types/agentic'
import { getErrorMessage, isNotFoundError } from '../types/fs'
import type { Memory } from '../types/memory'
import { fileExists } from '../utils/file-helper'
import { PACKAGE_ROOT } from '../utils/version'
import { getTemplateContent, listTemplates } from './template-loader'

// =============================================================================
// Token Budget Utilities (inlined from injection-validator)
// =============================================================================

const DEFAULT_BUDGETS: InjectionBudgets = {
  autoContext: 500,
  stateData: 1000,
  memories: 600,
  totalPrompt: 8000,
}

function truncateToTokenBudget(text: string, maxTokens: number): string {
  const maxChars = maxTokens * CHARS_PER_TOKEN
  if (text.length <= maxChars) return text
  return `${text.substring(0, maxChars)}\n... (truncated to ~${maxTokens} tokens)`
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

class InjectionBudgetTracker {
  private used = 0
  private budgets: InjectionBudgets

  constructor(budgets: Partial<InjectionBudgets> = {}) {
    this.budgets = { ...DEFAULT_BUDGETS, ...budgets }
  }

  addSection(content: string, sectionBudget: number): string {
    const truncated = truncateToTokenBudget(content, sectionBudget)
    const tokens = estimateTokens(truncated)

    if (this.used + tokens > this.budgets.totalPrompt) {
      const remaining = this.budgets.totalPrompt - this.used
      if (remaining <= 0) return ''
      const fitted = truncateToTokenBudget(truncated, remaining)
      this.used += estimateTokens(fitted)
      return fitted
    }

    this.used += tokens
    return truncated
  }
}

// =============================================================================
// Section Priority (PRJ-301)
// =============================================================================

export const PROMPT_SECTION_ORDER = [
  'identity',
  'environment',
  'ground_truth',
  'capabilities',
  'constraints',
  'task_context',
  'task',
  'output_schema',
  'efficiency',
] as const

/**
 * Cached template entry with TTL support
 */
interface CachedTemplate {
  content: string
  loadedAt: number
}

/**
 * Builds prompts for Claude using templates, context, and learned patterns.
 * Supports plan mode, think blocks, and quality checklists.
 * Auto-injects unified state and performance insights.
 */
class PromptBuilder {
  private _checklistsCache: Record<string, string> | null = null
  private _checklistsCacheTime: number = 0
  private _checklistRoutingCache: string | null = null
  private _checklistRoutingCacheTime: number = 0
  private _stateCache: Map<string, { state: PromptProjectState; timestamp: number }> = new Map()
  private _stateCacheTTL = 5000
  private _templateCache: Map<string, CachedTemplate> = new Map()
  private readonly TEMPLATE_CACHE_TTL_MS = 60_000

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

  clearTemplateCache(): void {
    this._templateCache.clear()
    this._checklistsCache = null
    this._checklistsCacheTime = 0
    this._checklistRoutingCache = null
    this._checklistRoutingCacheTime = 0
  }

  resetContext(): void {}
  setContext(_context: PromptContext | null): void {}

  async loadModule(moduleName: string): Promise<string | null> {
    const bundled = getTemplateContent(`global/modules/${moduleName}`)
    if (bundled) return bundled

    const modulePath = path.join(PACKAGE_ROOT, 'templates/global/modules', moduleName)
    return this.getTemplate(modulePath)
  }

  async loadChecklists(): Promise<Record<string, string>> {
    const now = Date.now()

    if (this._checklistsCache && now - this._checklistsCacheTime < this.TEMPLATE_CACHE_TTL_MS) {
      return this._checklistsCache
    }

    const checklists: Record<string, string> = {}

    try {
      const bundledKeys = listTemplates('checklists/')
      if (bundledKeys.length > 0) {
        for (const key of bundledKeys) {
          if (key.endsWith('.md')) {
            const content = getTemplateContent(key)
            if (content) {
              const name = path.basename(key, '.md')
              checklists[name] = content
            }
          }
        }
      } else {
        const checklistsDir = path.join(PACKAGE_ROOT, 'templates', 'checklists')
        if (await fileExists(checklistsDir)) {
          const files = (await fs.readdir(checklistsDir)).filter((f: string) => f.endsWith('.md'))
          for (const file of files) {
            const name = file.replace('.md', '')
            const templatePath = path.join(checklistsDir, file)
            const content = await this.getTemplate(templatePath)
            if (content) {
              checklists[name] = content
            }
          }
        }
      }
    } catch (error) {
      if (!isNotFoundError(error)) {
        console.error(`Checklist loading warning: ${getErrorMessage(error)}`)
      }
    }

    this._checklistsCache = checklists
    this._checklistsCacheTime = now
    return checklists
  }

  async getProjectState(projectId: string): Promise<PromptProjectState | null> {
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

      const state: PromptProjectState = {
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

  async buildInjectedContext(projectId: string): Promise<string | null> {
    if (!projectId) return null

    const state = await this.getProjectState(projectId)
    if (!state) return null

    const parts: string[] = []

    parts.push('## AUTO-INJECTED CONTEXT')
    parts.push('')

    if (state.currentTask) {
      const elapsed = this.calculateElapsed(state.currentTask.startedAt)
      parts.push(`**Current Task**: ${state.currentTask.description}`)
      parts.push(`- Started: ${elapsed} ago`)
    } else {
      parts.push('**Current Task**: None')
    }
    parts.push('')

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

    // Outcome-pattern detection was backed by the outcome-analyzer
    // subsystem (always empty, zero writers) — removed. Project
    // conventions now live in memory as `pattern` / `decision`
    // entries, surfaced by the persona+memory hook injection.
    void projectId

    parts.push('---')
    parts.push('')

    const result = parts.join('\n')
    return truncateToTokenBudget(result, DEFAULT_BUDGETS.autoContext)
  }

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

  async loadChecklistRouting(): Promise<string | null> {
    const now = Date.now()

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

    const content = await this.getTemplate(routingPath)
    if (content) {
      this._checklistRoutingCache = content
      this._checklistRoutingCacheTime = now
    }

    return this._checklistRoutingCache || null
  }

  async buildWithInjection(
    template: Template,
    context: PromptContext & { projectId?: string },
    state: PromptState,
    agent: PromptAgent | null = null,
    learnedPatterns: LearnedPatterns | null = null,
    thinkBlock: ThinkBlock | null = null,
    relevantMemories: Memory[] | null = null,
    planInfo: PlanInfo | null = null
  ): Promise<string> {
    const parts: string[] = []

    if (context.projectId) {
      const injected = await this.buildInjectedContext(context.projectId)
      if (injected) {
        parts.push(injected)
      }
    }

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
   */
  async build(
    template: Template,
    context: PromptContext,
    state: PromptState,
    agent: PromptAgent | null = null,
    learnedPatterns: LearnedPatterns | null = null,
    thinkBlock: ThinkBlock | null = null,
    relevantMemories: Memory[] | null = null,
    planInfo: PlanInfo | null = null,
    orchestratorContext: OrchestratorContext | null = null,
    options?: { skipNativeContext?: boolean; mcpActive?: boolean }
  ): Promise<string> {
    const skipNativeContext = options?.skipNativeContext ?? false
    const mcpActive = options?.mcpActive ?? false
    const parts: string[] = []

    // Default command context
    const commandName = template.frontmatter?.name?.replace('p:', '') || ''
    const commandContext = {
      agents: true,
      patterns: true,
      checklist: false,
      modules: [] as string[],
    }

    // =========================================================================
    // SECTION 1: IDENTITY
    // =========================================================================

    if (agent && commandContext.agents) {
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
    // SECTION 2: ENVIRONMENT
    // =========================================================================

    const projectPath = (context as { projectPath?: string }).projectPath
    if (projectPath) {
      const projectName = path.basename(projectPath)
      const envLines = [`project: ${projectName}`, `path: ${projectPath}`, `git: true`]
      if (orchestratorContext?.realContext?.gitBranch) {
        envLines.push(`branch: ${orchestratorContext.realContext.gitBranch}`)
      }
      envLines.push(`date: ${new Date().toISOString().split('T')[0]}`)
      parts.push(`\n<env>\n${envLines.join('\n')}\n</env>\n`)
    }

    // =========================================================================
    // SECTION 3: GROUND TRUTH
    // =========================================================================

    if (orchestratorContext) {
      const sa = orchestratorContext.sealedAnalysis
      parts.push('\n## PROJECT ANALYSIS (Sealed)\n')
      parts.push(`**Ecosystem**: ${orchestratorContext.project.ecosystem}\n`)
      parts.push(`**Primary Domain**: ${orchestratorContext.primaryDomain}\n`)
      parts.push(`**Domains**: ${orchestratorContext.detectedDomains.join(', ')}\n`)

      if (sa) {
        if (sa.languages?.length > 0) {
          parts.push(`**Languages**: ${sa.languages.join(', ')}\n`)
        }
        if (sa.frameworks?.length > 0) {
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

        if (!skipNativeContext) {
          if (sa.patterns?.length > 0) {
            parts.push('\n### Code Patterns (Follow These)\n')
            for (const p of sa.patterns) {
              parts.push(
                `- **${p.name}**: ${p.description}${p.location ? ` (${p.location})` : ''}\n`
              )
            }
          }

          if (sa.antiPatterns?.length > 0) {
            parts.push('\n### Anti-Patterns (Avoid These)\n')
            for (const ap of sa.antiPatterns) {
              parts.push(`- **${ap.issue}** in \`${ap.file}\` — ${ap.suggestion}\n`)
            }
          }
        }
      }

      parts.push('\n')
    }

    if (!skipNativeContext) {
      const codePatternsContent = state?.codePatterns || ''
      if (commandContext.patterns && codePatternsContent && codePatternsContent.trim()) {
        const patternSummary = this.extractPatternSummary(codePatternsContent)
        if (patternSummary) {
          parts.push('## CODE PATTERNS\n')
          parts.push(patternSummary)
          parts.push('\nFull patterns: Read analysis/patterns.md\n')
        }
      }

      const analysisContent = state?.analysis || ''
      if (commandContext.patterns && analysisContent && analysisContent.trim()) {
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
    }

    // =========================================================================
    // SECTION 4: CAPABILITIES
    // =========================================================================

    if (commandContext.modules.length > 0) {
      for (const moduleName of commandContext.modules) {
        const moduleContent = await this.loadModule(moduleName)
        if (moduleContent) {
          parts.push('\n')
          parts.push(moduleContent)
        }
      }
    }

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
    // SECTION 5: CONSTRAINTS
    // =========================================================================

    if (projectPath) {
      parts.push(`\n## CONSTRAINTS\nSCOPE: Only files in \`${projectPath}\` are accessible.\n`)

      const sa = orchestratorContext?.sealedAnalysis
      if (sa) {
        const available = [...(sa.languages || []), ...(sa.frameworks || [])].filter(Boolean)
        if (available.length > 0) {
          parts.push(`AVAILABLE: ${available.join(', ')}\n`)
        }
        if (sa.packageManager) {
          parts.push(`PACKAGE MANAGER: ${sa.packageManager}\n`)
        }
      }
    }

    // =========================================================================
    // SECTION 6: TASK CONTEXT
    // =========================================================================

    if (
      orchestratorContext?.contextDegradation?.level !== 'full' &&
      orchestratorContext?.contextDegradation
    ) {
      const deg = orchestratorContext.contextDegradation
      parts.push('\n### CONTEXT DEGRADATION NOTICE\n\n')
      parts.push(`**Level**: ${deg.level}\n`)
      parts.push(`**Unavailable**: ${deg.failedTools.join(', ')}\n`)
      parts.push(
        'Some context tools failed. Explore the codebase manually for missing context.\n\n'
      )
    }

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

    const files = context.files || []
    if (files.length > 0) {
      const top5 = files.slice(0, 5).join(', ')
      parts.push(`\n## FILES: ${files.length} available. Top: ${top5}\n`)
      parts.push('Read BEFORE modifying. Use Glob/Grep to find more.\n\n')
    } else if (projectPath) {
      parts.push(`\n## PROJECT: ${projectPath}\nRead files before modifying.\n\n`)
    }

    const relevantState = this.filterRelevantState(state)
    if (relevantState) {
      parts.push('\n## PRJCT STATE (Project Management Data)\n')
      parts.push(relevantState)
      parts.push('\n')
    }

    if (orchestratorContext?.velocityContext) {
      parts.push('\n### VELOCITY (Historical Estimation Data)\n\n')
      parts.push(orchestratorContext.velocityContext)
      parts.push('\n\n')
    }

    if (learnedPatterns && Object.keys(learnedPatterns).some((k) => learnedPatterns[k])) {
      parts.push('\n## PROJECT DEFAULTS (apply automatically)\n')
      for (const [key, value] of Object.entries(learnedPatterns)) {
        if (value) {
          parts.push(`- ${key}: ${value}\n`)
        }
      }
    }

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

    // Skip memories when MCP prjct is active (available on-demand via tools)
    if (!mcpActive && relevantMemories && relevantMemories.length > 0) {
      parts.push('\n## CONTEXT (apply these)\n')
      for (const memory of relevantMemories) {
        parts.push(`- **${memory.title}**: ${memory.content}\n`)
        if (memory.tags && memory.tags.length > 0) {
          parts.push(`  Tags: ${memory.tags.join(', ')}\n`)
        }
      }
    }

    // =========================================================================
    // SECTION 6.5: RPI PHASE
    // =========================================================================

    if (orchestratorContext?.rpiContext) {
      const rpi = orchestratorContext.rpiContext
      parts.push('\n### RPI PHASE\n\n')

      switch (rpi.phase) {
        case 'research':
          parts.push(
            '**Phase: RESEARCH** — Explore the codebase. Produce a truth snapshot: ' +
              'exact files + lines, function call chains, test locations. ' +
              'Use sub-agents for broad exploration.\n'
          )
          break
        case 'plan':
          parts.push(
            '**Phase: PLAN** — Create an implementation plan with real code snippets. ' +
              'Reference exact files and line numbers from research.\n'
          )
          if (rpi.researchDoc) {
            parts.push(`\n<research-context>\n${rpi.researchDoc}\n</research-context>\n`)
          }
          break
        case 'implement':
          parts.push(
            '**Phase: IMPLEMENT** — Execute the plan. Minimal exploration. ' +
              'Work only with the scoped files below.\n'
          )
          if (rpi.planDoc) {
            parts.push(`\n<plan-context>\n${rpi.planDoc}\n</plan-context>\n`)
          }
          if (rpi.scopedFiles && rpi.scopedFiles.length > 0) {
            parts.push(`\n**Scoped Files**: ${rpi.scopedFiles.map((f) => `\`${f}\``).join(', ')}\n`)
          }
          break
      }
      parts.push('\n')
    }

    parts.push('\n---\n')

    // =========================================================================
    // SECTION 7: TASK
    // =========================================================================

    parts.push(template.content)

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
    // SECTION 8: OUTPUT
    // =========================================================================

    const schemaType = this.getSchemaTypeForCommand(commandName)
    if (schemaType) {
      const { renderSchemaForPrompt } = await import('../schemas/llm-output')
      const schemaBlock = renderSchemaForPrompt(schemaType)
      if (schemaBlock) {
        parts.push(`\n${schemaBlock}\n`)
      }
    }

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
    // SECTION 9: EFFICIENCY
    // =========================================================================

    parts.push('\n## EFFICIENCY\n')
    parts.push('- Be concise. No preamble, no filler.\n')
    parts.push('- Use sub-agents for exploration that produces >5 file reads.\n')
    parts.push('- Prefer file:line references over dumping full file contents.\n')

    return parts.join('')
  }

  filterRelevantState(state: PromptState): string | null {
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
    const result = truncateToTokenBudget(joined, 200)
    return result || null
  }

  private getSchemaTypeForCommand(commandName: string): string | null {
    const schemaMap: Record<string, string> = {
      task: 'subtaskBreakdown',
      bug: 'classification',
    }
    return schemaMap[commandName] ?? null
  }
}

const promptBuilder = new PromptBuilder()
export default promptBuilder
