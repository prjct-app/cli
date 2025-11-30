/**
 * Prompt Builder
 * Builds prompts for Claude based on templates and context
 * Claude decides what to do - NO if/else logic here
 *
 * P1.1: Includes learned patterns from memory system
 * P3.1: Includes think blocks for anti-hallucination
 * P3.3: Includes relevant memories from semantic database
 * P3.4: Includes plan mode instructions
 * P4.1: Includes quality checklists (Claude decides which to apply)
 */

const fs = require('fs')
const path = require('path')

class PromptBuilder {
  constructor() {
    this._checklistsCache = null
    this._checklistRoutingCache = null
  }

  /**
   * Load quality checklists from templates/checklists/
   * Returns checklist content - Claude decides which to apply
   * NO if/else logic here - just load and provide
   */
  loadChecklists() {
    if (this._checklistsCache) return this._checklistsCache

    const checklistsDir = path.join(__dirname, '..', '..', 'templates', 'checklists')
    const checklists = {}

    try {
      if (fs.existsSync(checklistsDir)) {
        const files = fs.readdirSync(checklistsDir).filter(f => f.endsWith('.md'))
        for (const file of files) {
          const name = file.replace('.md', '')
          const content = fs.readFileSync(path.join(checklistsDir, file), 'utf-8')
          checklists[name] = content
        }
      }
    } catch (err) {
      // Silent fail - checklists are optional enhancement
    }

    this._checklistsCache = checklists
    return checklists
  }

  /**
   * Load checklist routing template
   * Claude reads this to decide which checklists to apply
   */
  loadChecklistRouting() {
    if (this._checklistRoutingCache) return this._checklistRoutingCache

    const routingPath = path.join(__dirname, '..', '..', 'templates', 'agentic', 'checklist-routing.md')

    try {
      if (fs.existsSync(routingPath)) {
        this._checklistRoutingCache = fs.readFileSync(routingPath, 'utf-8')
      }
    } catch (err) {
      // Silent fail
    }

    return this._checklistRoutingCache || null
  }
  /**
   * Build concise prompt - only essentials
   * CRITICAL: Includes full agent content if agent is provided
   * P1.1: Includes learned patterns to avoid repetitive questions
   * P3.1: Includes think blocks for critical decisions
   * P3.3: Includes relevant memories from semantic database
   * P3.4: Includes plan mode status and constraints
   */
  build(template, context, state, agent = null, learnedPatterns = null, thinkBlock = null, relevantMemories = null, planInfo = null) {
    const parts = []
    
    // Store context for use in helper methods
    this._currentContext = context

    // Agent assignment (CONDITIONAL - only for code-modifying commands)
    // Commands like done, ship, recap, next don't need specialized agents
    const commandName = template.frontmatter?.name?.replace('p:', '') || ''
    const agentCommands = ['now', 'build', 'feature', 'design', 'fix', 'bug', 'test', 'work', 'cleanup', 'spec']
    const needsAgent = agentCommands.includes(commandName)

    if (agent && needsAgent) {
      // COMPRESSED: Only essential agent info (500 bytes vs 3-5KB)
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
    if (context.params?.task || context.params?.description) {
      parts.push(`INPUT: ${context.params.task || context.params.description}\n`)
    }

    parts.push('\n---\n')

    // Template (only the flow section, skip verbose explanations)
    const flowMatch = template.content.match(/## Flow([\s\S]*?)(?=##|$)/)
    if (flowMatch) {
      parts.push(flowMatch[0])
    } else {
      // Fallback to full template if no flow section
      parts.push(template.content)
    }

    // Current state (only if exists and relevant)
    const relevantState = this.filterRelevantState(state)
    if (relevantState) {
      parts.push('\n## PRJCT STATE (Project Management Data)\n')
      parts.push(relevantState)
      parts.push('\n')
    }

    // COMPRESSED: File list (5 files vs 20, saves ~400 bytes)
    if (context.files?.length > 0) {
      const top5 = context.files.slice(0, 5).join(', ')
      parts.push(`\n## FILES: ${context.files.length} available. Top: ${top5}\n`)
      parts.push('Read BEFORE modifying. Use Glob/Grep to find more.\n\n')
    } else if (context.projectPath) {
      parts.push(`\n## PROJECT: ${context.projectPath}\nRead files before modifying.\n\n`)
    }

    // OPTIMIZED: Only include patterns for code-modifying commands
    // Commands like done, ship, recap, next don't need full patterns
    const codeCommands = ['now', 'build', 'feature', 'design', 'cleanup', 'fix', 'bug', 'test', 'init', 'spec', 'work']
    const needsPatterns = codeCommands.includes(commandName)

    // Include code patterns analysis for code-modifying commands
    // COMPRESSED: Extract only conventions and anti-patterns (800 bytes max vs 6KB)
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
      // Extract stack info compactly
      const stackMatch = analysisContent.match(/Stack[:\s]+([^\n]+)/i) ||
                        analysisContent.match(/Technology[:\s]+([^\n]+)/i)
      const stack = stackMatch ? stackMatch[1].trim() : 'detected'

      parts.push(`\n## STACK\nStack: ${stack}\n`)
      if (!codePatternsContent) {
        parts.push('Read analysis/repo-summary.md + similar files before coding. Match patterns exactly.\n')
      }
    }

    // CRITICAL: Compressed rules (replaces 78 lines with 12)
    parts.push(this.buildCriticalRules());

    // P1.1: Learned Patterns (avoid asking user questions we already know)
    if (learnedPatterns && Object.keys(learnedPatterns).some(k => learnedPatterns[k])) {
      parts.push('\n## LEARNED PATTERNS (use these, do NOT ask user)\n')
      for (const [key, value] of Object.entries(learnedPatterns)) {
        if (value) {
          parts.push(`- ${key}: ${value}\n`)
        }
      }
    }

    // P3.1: Think Block (reasoning before action)
    if (thinkBlock && thinkBlock.plan && thinkBlock.plan.length > 0) {
      parts.push('\n## THINK FIRST (reasoning from analysis)\n')
      if (thinkBlock.conclusions && thinkBlock.conclusions.length > 0) {
        parts.push('Conclusions:\n')
        thinkBlock.conclusions.forEach(c => parts.push(`  → ${c}\n`))
      }
      parts.push('Plan:\n')
      thinkBlock.plan.forEach((p, i) => parts.push(`  ${i + 1}. ${p}\n`))
      parts.push(`Confidence: ${Math.round((thinkBlock.confidence || 0.5) * 100)}%\n`)
    }

    // P3.3: Relevant Memories (context from past decisions)
    if (relevantMemories && relevantMemories.length > 0) {
      parts.push('\n## RELEVANT MEMORIES (apply these learnings)\n')
      for (const memory of relevantMemories) {
        parts.push(`- **${memory.title}**: ${memory.content}\n`)
        if (memory.tags && memory.tags.length > 0) {
          parts.push(`  Tags: ${memory.tags.join(', ')}\n`)
        }
      }
    }

    // P3.4: Plan Mode (OPTIMIZED: 30 lines → 5 lines)
    if (planInfo?.isPlanning) {
      parts.push(`\n## PLAN MODE\nRead-only. Gather info → Analyze → Propose plan → Wait for approval.\n`)
      if (planInfo.allowedTools) parts.push(`Tools: ${planInfo.allowedTools.join(', ')}\n`)
    }
    if (planInfo?.requiresApproval) {
      parts.push(`\n## APPROVAL REQUIRED\nShow changes, list affected files, ask for confirmation.\n`)
    }

    // P4.1: Quality Checklists (Claude decides which to apply)
    // Only for code-modifying commands that benefit from quality gates
    const checklistCommands = ['now', 'build', 'feature', 'design', 'fix', 'bug', 'cleanup', 'spec', 'work']
    if (checklistCommands.includes(commandName)) {
      const routing = this.loadChecklistRouting()
      const checklists = this.loadChecklists()

      if (routing && Object.keys(checklists).length > 0) {
        parts.push('\n## QUALITY CHECKLISTS\n')
        parts.push('Apply relevant checklists based on task. Read checklist-routing.md for guidance.\n')
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
   * Filter only relevant state data
   * IMPROVED: Include more context, don't truncate critical info
   */
  filterRelevantState(state) {
    if (!state || Object.keys(state).length === 0) return null

    const relevant = []
    for (const [key, content] of Object.entries(state)) {
      if (content && content.trim()) {
        // Include full content for critical files (now, next, context, patterns)
        const criticalFiles = ['now', 'next', 'context', 'analysis', 'codePatterns']
        if (criticalFiles.includes(key)) {
          // Include full content for critical files (up to 2000 chars)
          const display = content.length > 2000 
            ? content.substring(0, 2000) + '\n... (truncated)'
            : content
          relevant.push(`### ${key}\n${display}`)
        } else if (content.length < 1000) {
          // Include full content for small files
          relevant.push(`### ${key}\n${content}`)
        } else {
          // Truncate large files but show more context
          relevant.push(`### ${key}\n${content.substring(0, 500)}... (truncated, use Read tool for full content)`)
        }
      }
    }

    return relevant.length > 0 ? relevant.join('\n\n') : null
  }

  /**
   * Build analysis prompt
   * Used for tasks that need Claude to analyze before acting
   * @param {string} analysisType - Type of analysis
   * @param {Object} context - Context
   * @returns {string} Analysis prompt
   */
  buildAnalysis(analysisType, context) {
    const parts = []

    parts.push(`# Analyze: ${analysisType}\n\n`)
    parts.push('Read the project context and provide your analysis.\n')
    parts.push('No predetermined patterns - decide based on what you find.\n\n')

    parts.push('## Project Context\n')
    parts.push(`- Path: ${context.projectPath}\n`)
    parts.push(`- ID: ${context.projectId}\n\n`)

    return parts.join('')
  }

  /**
   * Extract pattern summary from full patterns content
   * OPTIMIZED: Returns only conventions + high-priority anti-patterns (800 bytes max)
   */
  extractPatternSummary(content) {
    if (!content) return null

    const parts = []

    // Extract conventions section
    const conventionsMatch = content.match(/## Conventions[\s\S]*?(?=##|$)/i)
    if (conventionsMatch) {
      // Compress to key lines only
      const conventions = conventionsMatch[0]
        .split('\n')
        .filter(line => line.includes(':') || line.startsWith('-'))
        .slice(0, 6)
        .join('\n')
      if (conventions) parts.push(conventions)
    }

    // Extract high priority anti-patterns only
    const antiPatternsMatch = content.match(/### High Priority[\s\S]*?(?=###|##|$)/i)
    if (antiPatternsMatch) {
      const antiPatterns = antiPatternsMatch[0].substring(0, 300)
      parts.push('\nAvoid:\n' + antiPatterns)
    }

    const result = parts.join('\n').substring(0, 800)
    return result || null
  }

  /**
   * Build critical rules - compressed anti-hallucination
   * OPTIMIZED: From 66 lines to 12 lines (~82% reduction)
   */
  buildCriticalRules() {
    const fileCount = this._currentContext?.files?.length || this._currentContext?.filteredSize || 0
    return `
## RULES (CRITICAL)
1. **READ FIRST**: Use Read tool BEFORE modifying any file. Never assume code structure.
2. **MATCH PATTERNS**: Follow existing style, architecture, naming, imports exactly.
3. **NO HALLUCINATIONS**: Don't invent files, functions, or paths. If unsure, READ first.
4. **GIT SAFETY**: Never use checkout/reset --hard/clean. Always check status first.
5. **VERIFY**: After writing, confirm code matches project patterns.
Context: ${fileCount} files available. Read what you need.
`;
  }

}

module.exports = new PromptBuilder()
